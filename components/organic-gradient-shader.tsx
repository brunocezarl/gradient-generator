"use client"

import { useRef, useMemo, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Vector2 } from "three"
import type * as THREE from "three"
import { useGradientStore } from "@/lib/store"

// Shader code for organic gradients
const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uComplexity;
  uniform float uNoiseScale;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uFlowIntensity;
  uniform float uThresholdMin;
  uniform float uThresholdMax;

  varying vec2 vUv;

  // Simplex 2D noise
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
      dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // Curl noise for organic flow
  vec2 curl(float x, float y) {
    float eps = 0.01;
    float n1 = snoise(vec2(x + eps, y));
    float n2 = snoise(vec2(x - eps, y));
    float n3 = snoise(vec2(x, y + eps));
    float n4 = snoise(vec2(x, y - eps));
    float dy = (n1 - n2) / (2.0 * eps);
    float dx = (n3 - n4) / (2.0 * eps);
    return vec2(dy, -dx);
  }

  void main() {
    vec2 uv = vUv;
    float time = uTime * 0.5;

    // Create multiple layers of noise with different frequencies
    float noise = 0.0;

    // Use complexity to determine how many layers to use
    float maxLayers = max(1.0, uComplexity * 1.5);

    for (float i = 1.0; i <= 10.0; i++) {
      if (i > maxLayers) break;

      // Get flow direction from curl noise
      vec2 flow = curl(uv.x * i * uNoiseScale, uv.y * i * uNoiseScale) * (0.3 + uNoiseScale * 0.1);

      // Animate the UV coordinates along the flow
      vec2 animatedUV = uv + flow * (sin(time * i * 0.5) * 0.2);

      // Add noise with different frequencies
      float layerNoise = snoise(animatedUV * i * uNoiseScale + time * i * 0.3);

      // Weight the noise layers (higher frequencies have less influence)
      noise += layerNoise * (1.0 / i);
    }

    // Normalize noise to 0-1 range
    noise = noise * 0.5 + 0.5;

    // Create organic shapes by applying threshold
    float shape = smoothstep(0.3, 0.7, noise);

    // Mix colors based on the shape value
    vec3 color = mix(uColor1, uColor2, shape);

    // Add some grain/noise texture
    float grain = snoise(uv * 500.0) * 0.05;
    color += grain;

    gl_FragColor = vec4(color, 1.0);
  }
`

interface OrganicGradientShaderProps {
  isPlaying: boolean
  speed: number
  complexity: number
  noiseScale: number
  colorScheme: {
    color1: number[]
    color2: number[]
  } | string
  flowIntensity?: number
  thresholdMin?: number
  thresholdMax?: number
}

export function OrganicGradientShader({
  isPlaying,
  speed,
  complexity,
  noiseScale,
  colorScheme,
  flowIntensity = 0.3,
  thresholdMin = 0.3,
  thresholdMax = 0.7,
}: OrganicGradientShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { size } = useThree()
  const timeRef = useRef(0)
  const colorSchemes = useGradientStore(state => state.colorSchemes)
  const customColors = useGradientStore(state => state.customColors)

  // Handle string colorScheme (from layer manager)
  const colors = useMemo(() => {
    if (typeof colorScheme === 'string') {
      // Look up the color scheme from the store
      const scheme = colorSchemes[colorScheme]
      if (scheme) {
        return {
          color1: scheme.color1,
          color2: scheme.color2
        }
      }
      // Fallback to custom colors if scheme not found
      return customColors
    }
    return colorScheme
  }, [colorScheme, colorSchemes, customColors])

  // Create uniforms for the shader
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new Vector2(size.width, size.height) },
      uComplexity: { value: complexity },
      uNoiseScale: { value: noiseScale },
      uColor1: { value: colors.color1 },
      uColor2: { value: colors.color2 },
      uFlowIntensity: { value: flowIntensity },
      uThresholdMin: { value: thresholdMin },
      uThresholdMax: { value: thresholdMax },
    }),
    [size],
  )

  // Update uniforms directly when props change
  useEffect(() => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial
      if (material && material.uniforms) {
        material.uniforms.uComplexity.value = complexity
        material.uniforms.uNoiseScale.value = noiseScale
        material.uniforms.uColor1.value = colors.color1
        material.uniforms.uColor2.value = colors.color2
        material.uniforms.uFlowIntensity.value = flowIntensity
        material.uniforms.uThresholdMin.value = thresholdMin
        material.uniforms.uThresholdMax.value = thresholdMax
      }
    }
  }, [complexity, noiseScale, colors, flowIntensity, thresholdMin, thresholdMax])

  // Animation loop
  useFrame((_, delta) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial
      if (material && material.uniforms) {
        if (isPlaying) {
          timeRef.current += delta * speed
        }
        material.uniforms.uTime.value = timeRef.current
      }
    }
  })

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[20, 20]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
      />
    </mesh>
  )
}
