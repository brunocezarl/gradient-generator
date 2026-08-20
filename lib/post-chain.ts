import * as THREE from "three"
import {
  brightPassFragmentShader,
  downsampleFragmentShader,
  postVertexShader,
  resolveFragmentShader,
  resolveVertexShader,
  upsampleFragmentShader,
} from "@/lib/shaders/post"

// The bloom chain, owning its render targets and materials.
//
// Deliberately free of React: the on-screen scene, the layer compositor and the
// off-screen thumbnail renderer all need the same passes, and only two of those
// three live inside a component tree. What varies between them is the source
// texture and the size — everything else is this object's business.

export interface BloomParams {
  /** Luminance where the glow starts, in linear light */
  threshold: number
  /** How much of the halo is added back */
  intensity: number
  /** Scales the upsample taps: wider taps, wider halo */
  radius: number
  grainAmount: number
  grainScale: number
  seed: [number, number]
  /** The scene texture holds sRGB rather than linear light */
  sceneIsSrgb?: boolean
}

// How far down the pyramid goes. Five levels reach 1/32 of the drawing buffer,
// which is a halo wide enough to read as light rather than as a blurred copy;
// past that the levels are a few pixels across and add nothing but passes.
const MAX_LEVELS = 5

// Below this a level is too small for the filters to mean anything, and the
// pyramid stops early — a 240×135 preview should not run the same five levels a
// 4K export does.
const MIN_LEVEL_SIZE = 8

const SOFT_KNEE = 0.5

function createTarget(type: THREE.TextureDataType): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type,
    depthBuffer: false,
    stencilBuffer: false,
  })
}

// Half float is what carries values above 1.0, which is the whole point of
// feeding the chain linear light: exposure at +1 EV puts the core of a bright
// region at roughly 2.0, and on an 8-bit target that core would arrive already
// clamped and bloom no harder than a dull one. Where the extension is missing
// the chain still runs, just without that headroom.
export function supportsHdrTargets(renderer: THREE.WebGLRenderer): boolean {
  return renderer.extensions.has("EXT_color_buffer_half_float")
}

export class BloomChain {
  private levels: THREE.WebGLRenderTarget[] = []
  private sceneTarget: THREE.WebGLRenderTarget
  private textureType: THREE.TextureDataType

  private brightPass: THREE.ShaderMaterial
  private downsample: THREE.ShaderMaterial
  private upsample: THREE.ShaderMaterial
  private resolve: THREE.ShaderMaterial

  private quadScene: THREE.Scene
  private quadCamera: THREE.Camera
  private quadMaterialSlot: THREE.Mesh

  private resolveMesh: THREE.Mesh
  private resolveScene: THREE.Scene

  private width = 0
  private height = 0

  constructor(renderer: THREE.WebGLRenderer) {
    this.textureType = supportsHdrTargets(renderer)
      ? THREE.HalfFloatType
      : THREE.UnsignedByteType

    this.sceneTarget = createTarget(this.textureType)
    for (let i = 0; i < MAX_LEVELS; i++) this.levels.push(createTarget(this.textureType))

    const base = { depthTest: false, depthWrite: false }

    this.brightPass = new THREE.ShaderMaterial({
      ...base,
      vertexShader: postVertexShader,
      fragmentShader: brightPassFragmentShader,
      uniforms: {
        uScene: { value: null },
        uThreshold: { value: 1 },
        uSoftKnee: { value: SOFT_KNEE },
      },
    })

    this.downsample = new THREE.ShaderMaterial({
      ...base,
      vertexShader: postVertexShader,
      fragmentShader: downsampleFragmentShader,
      uniforms: {
        uSource: { value: null },
        uTexelSize: { value: new THREE.Vector2() },
      },
    })

    // Additive: the pyramid is summed on the way up, each level laying its
    // wider, softer contribution over the sharper one below it
    this.upsample = new THREE.ShaderMaterial({
      ...base,
      vertexShader: postVertexShader,
      fragmentShader: upsampleFragmentShader,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uSource: { value: null },
        uTexelSize: { value: new THREE.Vector2() },
        uRadius: { value: 1 },
      },
    })

    this.resolve = new THREE.ShaderMaterial({
      ...base,
      vertexShader: resolveVertexShader,
      fragmentShader: resolveFragmentShader,
      uniforms: {
        uScene: { value: null },
        uBloom: { value: null },
        uIntensity: { value: 1 },
        uGrainAmount: { value: 0 },
        uGrainScale: { value: 500 },
        uSeed: { value: new THREE.Vector2() },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uSceneIsSrgb: { value: 0 },
      },
    })

    // One quad reused by every intermediate pass: the material is swapped
    // between draws, which is cheaper than keeping a mesh per pass and keeps the
    // pass order readable as a list of draws
    this.quadMaterialSlot = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.brightPass)
    this.quadMaterialSlot.frustumCulled = false
    this.quadScene = new THREE.Scene()
    this.quadScene.add(this.quadMaterialSlot)
    this.quadCamera = new THREE.Camera()

    // The resolve pass rides the gradient's own geometry — same plane, same
    // camera — so its uv keeps the meaning grain depends on
    this.resolveMesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), this.resolve)
    this.resolveMesh.frustumCulled = false
    this.resolveScene = new THREE.Scene()
    this.resolveScene.add(this.resolveMesh)
  }

  /** Target the scene should be rendered into before `apply` runs. */
  get sceneRenderTarget(): THREE.WebGLRenderTarget {
    return this.sceneTarget
  }

  /** True when the intermediate targets can hold values above 1.0. */
  get hasHdrHeadroom(): boolean {
    return this.textureType === THREE.HalfFloatType
  }

  /**
   * Sizes the targets to the drawing buffer. Must be called *before* the caller
   * renders into `sceneRenderTarget`.
   *
   * Sizing inside `apply` instead is a trap the first version fell into: the
   * target starts 1×1, the scene gets drawn into that, and only then does the
   * resize reallocate — and wipe — it. On screen that hides, because the next
   * frame finds the target already the right size; a single-shot render has no
   * next frame, so a preset thumbnail came out black and an export at a
   * resolution the preview had not used would have too.
   */
  prepare(renderer: THREE.WebGLRenderer) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2())
    this.resize(Math.max(1, Math.floor(size.x)), Math.max(1, Math.floor(size.y)))
  }

  private resize(width: number, height: number) {
    if (this.width === width && this.height === height) return
    this.width = width
    this.height = height

    this.sceneTarget.setSize(width, height)
    for (let i = 0; i < MAX_LEVELS; i++) {
      const divisor = 2 ** (i + 1)
      this.levels[i].setSize(
        Math.max(1, Math.floor(width / divisor)),
        Math.max(1, Math.floor(height / divisor))
      )
    }
  }

  private activeLevels(): number {
    let count = 0
    for (let i = 0; i < MAX_LEVELS; i++) {
      const level = this.levels[i]
      if (level.width < MIN_LEVEL_SIZE || level.height < MIN_LEVEL_SIZE) break
      count++
    }
    // One level is still a bloom, just a tight one; zero would leave the halo
    // texture undefined, so the pyramid never shrinks below a single step
    return Math.max(1, count)
  }

  private draw(
    renderer: THREE.WebGLRenderer,
    material: THREE.ShaderMaterial,
    target: THREE.WebGLRenderTarget | null,
    clear: boolean
  ) {
    this.quadMaterialSlot.material = material
    renderer.setRenderTarget(target)
    if (clear) renderer.clear(true, false, false)
    renderer.render(this.quadScene, this.quadCamera)
  }

  /**
   * Runs the chain over whatever is already in `sceneRenderTarget` and draws the
   * finished image into `output` (null = the screen).
   *
   * `camera` has to be the one the gradient was drawn with: the resolve pass
   * shares the gradient's plane so that grain lands in the same place with the
   * chain on as with it off, and that only holds under the same projection.
   */
  apply(
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    params: BloomParams,
    output: THREE.WebGLRenderTarget | null = null
  ) {
    // Idempotent, and the caller was supposed to have done it already — but a
    // resize here would silently wipe the scene it is about to read
    this.prepare(renderer)
    const width = this.width
    const height = this.height

    const levels = this.activeLevels()
    const previousTarget = renderer.getRenderTarget()
    const previousAutoClear = renderer.autoClear
    renderer.autoClear = false

    // Bright pass, straight into the first (half size) level
    this.brightPass.uniforms.uScene.value = this.sceneTarget.texture
    this.brightPass.uniforms.uThreshold.value = params.threshold
    this.draw(renderer, this.brightPass, this.levels[0], true)

    // Down the pyramid
    for (let i = 1; i < levels; i++) {
      const source = this.levels[i - 1]
      this.downsample.uniforms.uSource.value = source.texture
      this.downsample.uniforms.uTexelSize.value.set(1 / source.width, 1 / source.height)
      this.draw(renderer, this.downsample, this.levels[i], true)
    }

    // And back up, adding each level into the one below it. Additive blending
    // means the target keeps what the descent left there, so these draws must
    // not clear.
    this.upsample.uniforms.uRadius.value = params.radius
    for (let i = levels - 1; i > 0; i--) {
      const source = this.levels[i]
      this.upsample.uniforms.uSource.value = source.texture
      this.upsample.uniforms.uTexelSize.value.set(1 / source.width, 1 / source.height)
      this.draw(renderer, this.upsample, this.levels[i - 1], false)
    }

    this.resolve.uniforms.uScene.value = this.sceneTarget.texture
    this.resolve.uniforms.uBloom.value = this.levels[0].texture
    this.resolve.uniforms.uIntensity.value = params.intensity
    this.resolve.uniforms.uGrainAmount.value = params.grainAmount
    this.resolve.uniforms.uGrainScale.value = params.grainScale
    this.resolve.uniforms.uSeed.value.set(params.seed[0], params.seed[1])
    this.resolve.uniforms.uResolution.value.set(width, height)
    this.resolve.uniforms.uSceneIsSrgb.value = params.sceneIsSrgb ? 1 : 0

    renderer.setRenderTarget(output)
    renderer.clear(true, false, false)
    renderer.render(this.resolveScene, camera)

    renderer.autoClear = previousAutoClear
    renderer.setRenderTarget(previousTarget)
  }

  dispose() {
    this.sceneTarget.dispose()
    for (const level of this.levels) level.dispose()
    this.brightPass.dispose()
    this.downsample.dispose()
    this.upsample.dispose()
    this.resolve.dispose()
    this.quadMaterialSlot.geometry.dispose()
    this.resolveMesh.geometry.dispose()
  }
}
