import { create } from "zustand"
import { persist } from "zustand/middleware"
import { ShareableGradient } from "@/lib/share-utils"
import { AnimationPreset, animationPresets } from "@/lib/animation-presets"
import {
  GradientLayer,
  blendModes,
  createDefaultLayer,
  generateLayerId,
  generateSeed,
} from "@/lib/layer-utils"
import { colorBlendSpaces, type ColorBlendSpace } from "@/lib/color"
import { defaultArtboardId, getArtboard } from "@/lib/artboards"
import { oklchToSrgb, randomPalette } from "@/lib/oklch"
import { parseLibrary, serializeLibrary } from "@/lib/library"
import {
  cloneStops,
  insertStop,
  legacyColorsToStops,
  normalizeStops,
  removeStopAt,
  sortStops,
  stopsFromColors,
  updateStopColor,
  updateStopPosition,
  type ColorStop,
} from "@/lib/color-stops"

// Define color type
type GradientColor = [number, number, number]

// Color scheme: stops with positions (these used to be three colors pinned at 0,
// 0.5 and 1)
export type ColorScheme = {
  stops: ColorStop[]
  name?: string
}

// Snapshot of the gradient's "look": colors + animation parameters + layers.
// Used by undo/redo, saved presets and the randomizer history.
export type StateSnapshot = {
  speed: number
  complexity: number
  noiseScale: number
  colorScheme: string
  isCustomMode: boolean
  customStops: ColorStop[]
  flowIntensity: number
  grainAmount: number
  grainScale: number
  thresholdMin: number
  thresholdMax: number
  vibrance: number
  exposure: number
  brightness: number
  contrast: number
  blendSpace: ColorBlendSpace
  seed: [number, number]
  loopDuration: number
  // Layers are part of the snapshot so creating, removing, reordering and
  // editing a layer are undoable. Optional because presets saved before this
  // version do not carry them.
  multiLayerMode?: boolean
  layers?: GradientLayer[]
}

// A full user-saved preset: colors + every animation parameter
export type GradientPreset = {
  id: string
  name: string
  createdAt: number
  snapshot: StateSnapshot
}

const RANDOM_HISTORY_LIMIT = 10

// Monotonic counter for ids: `Date.now()` alone collides when two creations land
// in the same millisecond (importing the same library twice in a row, say)
let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${Date.now()}_${idCounter}`
}

// History coalescing: continuous edits (dragging a slider) produce a single
// snapshot instead of one per change event
const HISTORY_COALESCE_MS = 1000
let lastHistoryKey: string | null = null
let lastHistoryTime = 0



function cloneLayers(layers: GradientLayer[]): GradientLayer[] {
  return layers.map((layer) => ({
    ...layer,
    seed: [...layer.seed] as [number, number],
    customStops: layer.customStops ? cloneStops(layer.customStops) : undefined,
  }))
}

function captureSnapshot(state: GradientStore): StateSnapshot {
  return {
    speed: state.speed,
    complexity: state.complexity,
    noiseScale: state.noiseScale,
    colorScheme: state.colorScheme,
    isCustomMode: state.isCustomMode,
    customStops: cloneStops(state.customStops),
    flowIntensity: state.flowIntensity,
    grainAmount: state.grainAmount,
    grainScale: state.grainScale,
    thresholdMin: state.thresholdMin,
    thresholdMax: state.thresholdMax,
    vibrance: state.vibrance,
    exposure: state.exposure,
    brightness: state.brightness,
    contrast: state.contrast,
    blendSpace: state.blendSpace,
    seed: [...state.seed] as [number, number],
    loopDuration: state.loopDuration,
    multiLayerMode: state.multiLayerMode,
    layers: cloneLayers(state.layers),
  }
}

// Turns a snapshot into a state patch. Old snapshots (presets saved before
// layers joined the snapshot) carry no `layers`; in that case the current layers
// are preserved rather than wiped.
function snapshotToState(
  snapshot: StateSnapshot,
  currentActiveLayerId?: string
): Partial<GradientStore> {
  const patch: Partial<GradientStore> = {
    speed: snapshot.speed,
    complexity: snapshot.complexity,
    noiseScale: snapshot.noiseScale,
    colorScheme: snapshot.colorScheme,
    isCustomMode: snapshot.isCustomMode,
    customStops: cloneStops(snapshot.customStops),
    flowIntensity: snapshot.flowIntensity,
    grainAmount: snapshot.grainAmount,
    grainScale: snapshot.grainScale,
    thresholdMin: snapshot.thresholdMin,
    thresholdMax: snapshot.thresholdMax,
    vibrance: snapshot.vibrance,
    // Presets written before the tone controls fall back to neutral rather than
    // to NaN — a snapshot is data from an older version, not a promise
    exposure: snapshot.exposure ?? defaultState.exposure,
    brightness: snapshot.brightness ?? defaultState.brightness,
    contrast: snapshot.contrast ?? defaultState.contrast,
    blendSpace: snapshot.blendSpace,
    seed: [...snapshot.seed] as [number, number],
    loopDuration: snapshot.loopDuration,
  }

  if (snapshot.layers && snapshot.layers.length > 0) {
    const layers = cloneLayers(snapshot.layers)
    patch.layers = layers
    patch.multiLayerMode = snapshot.multiLayerMode ?? false
    // Keeps the selected layer when it survives the restored snapshot
    patch.activeLayerId = layers.some((layer) => layer.id === currentActiveLayerId)
      ? currentActiveLayerId
      : layers[0].id
  }

  return patch
}

// Define the store type
export type GradientStore = {
  // Animation parameters
  isPlaying: boolean
  speed: number
  complexity: number
  noiseScale: number
  colorScheme: string
  menuOpen: boolean
  isCustomMode: boolean
  customStops: ColorStop[]

  // Advanced parameters
  advancedMode: boolean
  flowIntensity: number
  grainAmount: number
  grainScale: number
  thresholdMin: number
  thresholdMax: number
  vibrance: number
  // Tone. Exposure is light (linear multiply, in stops); brightness and contrast
  // move Oklab lightness, so they never drag hue with them.
  exposure: number
  brightness: number
  contrast: number
  blendSpace: ColorBlendSpace
  // Loop duration in animation seconds. 0 = free animation (drifts without
  // repeating); > 0 brings the drawing back exactly to the start over that
  // period, which is what allows seamless video export.
  loopDuration: number
  // Offset into the noise field: decides *which* organic shape gets drawn. Kept
  // in snapshots and links, so a good result is reproducible.
  seed: [number, number]

  // Artboard (composition ratio and export target)
  artboardId: string
  showSafeAreas: boolean

  // Multi-layer support
  multiLayerMode: boolean
  layers: GradientLayer[]
  activeLayerId: string

  // Color schemes
  colorSchemes: {
    [key: string]: ColorScheme
  }

  // Undo/Redo
  past: StateSnapshot[]
  future: StateSnapshot[]

  // Full presets and randomizer history
  savedPresets: GradientPreset[]
  randomHistory: StateSnapshot[]

  // Actions
  setIsPlaying: (value: boolean) => void
  setSpeed: (value: number) => void
  setComplexity: (value: number) => void
  setNoiseScale: (value: number) => void
  setColorScheme: (value: string) => void
  toggleMenu: () => void
  setCustomMode: (value: boolean) => void
  setStopColor: (index: number, color: GradientColor) => void
  setStopPosition: (index: number, position: number) => void
  setStops: (stops: ColorStop[]) => void
  addStop: () => void
  removeStop: (index: number) => void
  saveCustomScheme: (name: string) => void
  resetToDefaults: () => void
  importSettings: (settings: ShareableGradient) => void
  applyAnimationPreset: (presetId: string) => void
  randomize: () => void

  // Advanced controls
  setAdvancedMode: (value: boolean) => void
  setFlowIntensity: (value: number) => void
  setGrainAmount: (value: number) => void
  setGrainScale: (value: number) => void
  setThresholdMin: (value: number) => void
  setThresholdMax: (value: number) => void
  setVibrance: (value: number) => void
  setExposure: (value: number) => void
  setBrightness: (value: number) => void
  setContrast: (value: number) => void
  setBlendSpace: (value: ColorBlendSpace) => void
  setLoopDuration: (value: number) => void
  shuffleSeed: () => void
  setArtboard: (id: string) => void
  setShowSafeAreas: (value: boolean) => void

  // Multi-layer actions
  setMultiLayerMode: (value: boolean) => void
  setActiveLayer: (id: string) => void
  addLayer: () => void
  removeLayer: (id: string) => void
  updateLayer: (id: string, updates: Partial<GradientLayer>) => void
  moveLayer: (id: string, direction: "up" | "down") => void
  reorderLayers: (ids: string[]) => void

  // Undo/Redo actions
  pushHistory: () => void
  undo: () => void
  redo: () => void

  // Presets and randomizer history
  saveCurrentPreset: (name: string) => void
  exportLibrary: () => string
  importLibrary: (json: string) => { presets: number; schemes: number }
  applyPreset: (id: string) => void
  deletePreset: (id: string) => void
  applySnapshot: (snapshot: StateSnapshot) => void
}

// Define the type for actions to omit them from defaultState
type StoreActions = Pick<
  GradientStore,
  | "setIsPlaying"
  | "setSpeed"
  | "setComplexity"
  | "setNoiseScale"
  | "setColorScheme"
  | "toggleMenu"
  | "setCustomMode"
  | "setStopColor"
  | "setStopPosition"
  | "setStops"
  | "addStop"
  | "removeStop"
  | "saveCustomScheme"
  | "resetToDefaults"
  | "importSettings"
  | "applyAnimationPreset"
  | "randomize"
  | "setAdvancedMode"
  | "setFlowIntensity"
  | "setGrainAmount"
  | "setGrainScale"
  | "setThresholdMin"
  | "setThresholdMax"
  | "setVibrance"
  | "setExposure"
  | "setBrightness"
  | "setContrast"
  | "setBlendSpace"
  | "setLoopDuration"
  | "shuffleSeed"
  | "setArtboard"
  | "setShowSafeAreas"
  | "setMultiLayerMode"
  | "setActiveLayer"
  | "addLayer"
  | "removeLayer"
  | "updateLayer"
  | "moveLayer"
  | "reorderLayers"
  | "pushHistory"
  | "undo"
  | "redo"
  | "saveCurrentPreset"
  | "exportLibrary"
  | "importLibrary"
  | "applyPreset"
  | "deletePreset"
  | "applySnapshot"
>

// Default state
const defaultState: Omit<GradientStore, keyof StoreActions> = {
  isPlaying: true,
  speed: 1.0,
  complexity: 3,
  noiseScale: 2.0,
  colorScheme: "redBlue",
  menuOpen: true,
  isCustomMode: false,
  customStops: stopsFromColors([
    [0.9, 0.1, 0.1],
    [0.0, 0.0, 0.9],
    [0.5, 0.0, 0.5],
  ]),

  advancedMode: false,
  flowIntensity: 0.3,
  grainAmount: 0.05,
  grainScale: 500.0,
  thresholdMin: 0.3,
  thresholdMax: 0.7,
  // Neutral vibrance by default: the HEX picked in the picker is exactly the
  // exported pixel. Anyone who wants more saturation raises it deliberately.
  vibrance: 0,
  // Neutral tone, for the same reason as vibrance: untouched, the pipeline hands
  // back exactly the color that went in
  exposure: 0,
  brightness: 0,
  contrast: 1,
  blendSpace: "oklab",
  loopDuration: 0,
  seed: [0, 0],

  artboardId: defaultArtboardId,
  showSafeAreas: false,

  multiLayerMode: false,
  layers: [createDefaultLayer(generateLayerId())],
  activeLayerId: "",

  past: [],
  future: [],

  savedPresets: [],
  randomHistory: [],

  // Default schemes. The even positions reproduce the three-color shader's
  // distribution, so the historical look is preserved.
  colorSchemes: {
    redBlue: {
      stops: stopsFromColors([
        [0.9, 0.1, 0.1],
        [0.0, 0.0, 0.9],
        [0.5, 0.0, 0.5],
      ]),
      name: "Red & Blue",
    },
    greenPurple: {
      stops: stopsFromColors([
        [0.1, 0.9, 0.1],
        [0.7, 0.0, 0.7],
        [0.0, 0.4, 0.8],
      ]),
      name: "Green & Purple",
    },
    multiColor: {
      stops: stopsFromColors([
        [1.0, 0.2, 0.8],
        [0.1, 0.9, 1.0],
        [0.5, 1.0, 0.2],
      ]),
      name: "Multicolor",
    },
    neon: {
      stops: stopsFromColors([
        [1.0, 0.6, 0.0],
        [0.0, 1.0, 1.0],
        [0.8, 0.0, 1.0],
      ]),
      name: "Neon",
    },
    yellowPink: {
      stops: stopsFromColors([
        [1.0, 0.9, 0.1],
        [1.0, 0.1, 0.5],
        [1.0, 0.5, 0.1],
      ]),
      name: "Yellow & Pink",
    },
  },
}

// Resolves the active color stops with a safe fallback — the scheme name can
// come from a shared URL or from a persisted store pointing at a scheme that no
// longer exists
export function resolveActiveStops(
  state: Pick<GradientStore, "isCustomMode" | "customStops" | "colorScheme" | "colorSchemes">
): ColorStop[] {
  if (state.isCustomMode) return state.customStops
  const scheme =
    state.colorSchemes[state.colorScheme] ??
    state.colorSchemes.redBlue ??
    defaultState.colorSchemes.redBlue
  return scheme.stops
}

// ─── Persistence migration ───────────────────────────────────────────────────
// Without a version + migration, a localStorage entry written by an earlier
// version reaches the app with fields missing, and the code needs `?? fallback`
// sprinkled over every read to survive. Migration normalizes once, on hydration.

export const PERSIST_VERSION = 1

function migrateSeed(seed: unknown): [number, number] {
  return Array.isArray(seed) &&
    typeof seed[0] === "number" &&
    Number.isFinite(seed[0]) &&
    typeof seed[1] === "number" &&
    Number.isFinite(seed[1])
    ? [seed[0], seed[1]]
    : [0, 0]
}

// Schemes stored in the three-color format (color1/color2/color3) become stops at
// 0, 0.5 and 1 — the same distribution the old shader used
function migrateScheme(scheme: unknown): ColorScheme | undefined {
  if (!scheme || typeof scheme !== "object") return undefined
  const source = scheme as Record<string, unknown>

  const legacy = legacyColorsToStops(source as never)
  const stops = normalizeStops(source.stops, legacy ?? [])
  if (stops.length < 2) return undefined

  return typeof source.name === "string" ? { stops, name: source.name } : { stops }
}

function migrateLayer(layer: unknown): unknown {
  if (!layer || typeof layer !== "object") return layer
  const source = layer as Record<string, unknown>
  const legacy = legacyColorsToStops(source.customColors as never)
  const stops = source.customStops ?? legacy ?? undefined

  const migrated: Record<string, unknown> = {
    ...source,
    seed: migrateSeed(source.seed),
  }
  delete migrated.customColors
  if (stops) migrated.customStops = normalizeStops(stops, legacy ?? [])
  return migrated
}

function migrateSnapshot(snapshot: unknown): unknown {
  if (!snapshot || typeof snapshot !== "object") return snapshot
  const source = snapshot as Record<string, unknown>
  const legacy = legacyColorsToStops(source.customColors as never)
  const customStops = normalizeStops(
    source.customStops ?? legacy,
    legacy ?? defaultState.customStops
  )
  return {
    ...source,
    vibrance: typeof source.vibrance === "number" ? source.vibrance : defaultState.vibrance,
    exposure: typeof source.exposure === "number" ? source.exposure : defaultState.exposure,
    brightness:
      typeof source.brightness === "number" ? source.brightness : defaultState.brightness,
    contrast: typeof source.contrast === "number" ? source.contrast : defaultState.contrast,
    blendSpace:
      typeof source.blendSpace === "string" && source.blendSpace in colorBlendSpaces
        ? source.blendSpace
        : defaultState.blendSpace,
    seed: migrateSeed(source.seed),
    loopDuration:
      typeof source.loopDuration === "number" && Number.isFinite(source.loopDuration)
        ? source.loopDuration
        : defaultState.loopDuration,
    customStops,
    customColors: undefined,
    ...(Array.isArray(source.layers) ? { layers: source.layers.map(migrateLayer) } : {}),
  }
}

// Normalizes a persisted state into the current format: fills what is missing
// (stops, seed, color pipeline parameters) and drops what is invalid. It is
// idempotent on purpose — it runs on every hydration, not only on a version
// change (see the persist `merge` option below).
export function normalizePersistedState(persisted: unknown): unknown {
  if (!persisted || typeof persisted !== "object") return persisted
  const state = { ...(persisted as Record<string, unknown>) }

  if (typeof state.vibrance !== "number") state.vibrance = defaultState.vibrance
  if (typeof state.exposure !== "number") state.exposure = defaultState.exposure
  if (typeof state.brightness !== "number") state.brightness = defaultState.brightness
  if (typeof state.contrast !== "number") state.contrast = defaultState.contrast
  if (typeof state.blendSpace !== "string" || !(state.blendSpace in colorBlendSpaces)) {
    state.blendSpace = defaultState.blendSpace
  }
  if (typeof state.loopDuration !== "number" || !Number.isFinite(state.loopDuration)) {
    state.loopDuration = defaultState.loopDuration
  }
  state.seed = migrateSeed(state.seed)
  if (typeof state.artboardId !== "string" || getArtboard(state.artboardId).id !== state.artboardId) {
    state.artboardId = defaultArtboardId
  }
  if (typeof state.showSafeAreas !== "boolean") state.showSafeAreas = false

  const legacyStops = legacyColorsToStops(state.customColors as never)
  state.customStops = normalizeStops(
    state.customStops ?? legacyStops,
    legacyStops ?? defaultState.customStops
  )
  delete state.customColors

  if (state.colorSchemes && typeof state.colorSchemes === "object") {
    state.colorSchemes = Object.fromEntries(
      Object.entries(state.colorSchemes as Record<string, unknown>).flatMap(
        ([key, scheme]) => {
          const migrated = migrateScheme(scheme)
          return migrated ? [[key, migrated]] : []
        }
      )
    )
  }

  if (Array.isArray(state.layers)) state.layers = state.layers.map(migrateLayer)

  if (Array.isArray(state.savedPresets)) {
    state.savedPresets = state.savedPresets.map((preset) =>
      preset && typeof preset === "object"
        ? { ...preset, snapshot: migrateSnapshot((preset as Record<string, unknown>).snapshot) }
        : preset
    )
  }

  if (Array.isArray(state.randomHistory)) {
    state.randomHistory = state.randomHistory.map(migrateSnapshot)
  }

  return state
}

export function migratePersistedState(persisted: unknown, version: number): unknown {
  // v0 → v1: color pipeline (vibrance + blend space), reproducible seed, color
  // stops and a per-layer seed
  const from = typeof version === "number" && Number.isFinite(version) ? version : 0
  return from < PERSIST_VERSION ? normalizePersistedState(persisted) : persisted
}

// Create the store with persistence
export const useGradientStore = create<GradientStore>()(
  persist(
    (set, get) => {
      // Takes a snapshot before the first edit of a continuous sequence (e.g.
      // dragging a slider). Edits of the same control inside the coalescing
      // window do not create new snapshots.
      const recordEdit = (key: string) => {
        const now = Date.now()
        if (key !== lastHistoryKey || now - lastHistoryTime > HISTORY_COALESCE_MS) {
          get().pushHistory()
        }
        lastHistoryKey = key
        lastHistoryTime = now
      }

      return {
      ...defaultState,
      activeLayerId: defaultState.layers[0].id,

      // ─── Undo/Redo ────────────────────────────────────────────────────────

      pushHistory: () => {
        const state = get()
        const snapshot = captureSnapshot(state)
        const newPast = [...state.past, snapshot].slice(-50)
        lastHistoryKey = null
        set({ past: newPast, future: [] })
      },

      undo: () => {
        const state = get()
        if (state.past.length === 0) return
        const current = captureSnapshot(state)
        const newPast = state.past.slice(0, -1)
        const prev = state.past[state.past.length - 1]
        lastHistoryKey = null
        set({
          ...snapshotToState(prev, state.activeLayerId),
          past: newPast,
          future: [current, ...state.future],
        })
      },

      redo: () => {
        const state = get()
        if (state.future.length === 0) return
        const current = captureSnapshot(state)
        const [next, ...remainingFuture] = state.future
        lastHistoryKey = null
        set({
          ...snapshotToState(next, state.activeLayerId),
          past: [...state.past, current],
          future: remainingFuture,
        })
      },

      // ─── Full presets and randomizer history ─────────────────────────────

      applySnapshot: (snapshot) => {
        get().pushHistory()
        set(snapshotToState(snapshot, get().activeLayerId))
      },

      saveCurrentPreset: (name) =>
        set((state) => {
          const preset: GradientPreset = {
            id: nextId("preset"),
            name,
            createdAt: Date.now(),
            snapshot: captureSnapshot(state),
          }
          return { savedPresets: [preset, ...state.savedPresets] }
        }),

      applyPreset: (id) => {
        const preset = get().savedPresets.find((p) => p.id === id)
        if (preset) get().applySnapshot(preset.snapshot)
      },

      deletePreset: (id) =>
        set((state) => ({
          savedPresets: state.savedPresets.filter((p) => p.id !== id),
        })),

      exportLibrary: () => serializeLibrary(get().savedPresets, get().colorSchemes),

      // Presets and schemes from the file go through the same normalization as an
      // old localStorage entry: a file exported by an earlier version gets
      // migrated instead of rejected
      importLibrary: (json) => {
        const { presets, colorSchemes } = parseLibrary(json)

        const importedPresets = presets.map((preset) => {
          const source = preset as GradientPreset
          return {
            ...source,
            // Fresh ids: importing twice neither overwrites nor collides
            id: nextId("preset"),
            snapshot: migrateSnapshot(source.snapshot) as StateSnapshot,
          }
        })

        const importedSchemes = Object.fromEntries(
          Object.entries(colorSchemes).flatMap(([key, scheme]) => {
            const migrated = migrateScheme(scheme)
            return migrated ? [[key, migrated]] : []
          })
        )

        set((state) => ({
          savedPresets: [...importedPresets, ...state.savedPresets],
          colorSchemes: { ...state.colorSchemes, ...importedSchemes },
        }))

        return {
          presets: importedPresets.length,
          schemes: Object.keys(importedSchemes).length,
        }
      },

      // ─── Animation parameters ─────────────────────────────────────────────

      setIsPlaying: (value) => set({ isPlaying: value }),
      setSpeed: (value) => {
        recordEdit("speed")
        set({ speed: value })
      },
      setComplexity: (value) => {
        recordEdit("complexity")
        set({ complexity: value })
      },
      setNoiseScale: (value) => {
        recordEdit("noiseScale")
        set({ noiseScale: value })
      },

      setColorScheme: (value) => {
        get().pushHistory()
        set({ colorScheme: value })
      },

      toggleMenu: () => set((state) => ({ menuOpen: !state.menuOpen })),

      setCustomMode: (value) => {
        get().pushHistory()
        set({ isCustomMode: value })
      },

      // ─── Advanced controls ─────────────────────────────────────────────────

      setAdvancedMode: (value) => set({ advancedMode: value }),
      setFlowIntensity: (value) => {
        recordEdit("flowIntensity")
        set({ flowIntensity: value })
      },
      setGrainAmount: (value) => {
        recordEdit("grainAmount")
        set({ grainAmount: value })
      },
      setGrainScale: (value) => {
        recordEdit("grainScale")
        set({ grainScale: value })
      },
      setThresholdMin: (value) => {
        recordEdit("thresholdMin")
        set({ thresholdMin: value })
      },
      setThresholdMax: (value) => {
        recordEdit("thresholdMax")
        set({ thresholdMax: Math.max(value, get().thresholdMin + 0.1) })
      },
      setVibrance: (value) => {
        recordEdit("vibrance")
        set({ vibrance: value })
      },
      setExposure: (value) => {
        recordEdit("exposure")
        set({ exposure: value })
      },
      setBrightness: (value) => {
        recordEdit("brightness")
        set({ brightness: value })
      },
      setContrast: (value) => {
        recordEdit("contrast")
        set({ contrast: value })
      },
      setBlendSpace: (value) => {
        get().pushHistory()
        set({ blendSpace: value })
      },
      setLoopDuration: (value) => {
        get().pushHistory()
        set({ loopDuration: Math.max(0, value) })
      },
      shuffleSeed: () => {
        get().pushHistory()
        set({ seed: generateSeed() })
      },

      // The artboard is framing, not part of the gradient's look: it stays out of
      // history and presets, like an editor's zoom level
      setArtboard: (id) => set({ artboardId: getArtboard(id).id }),
      setShowSafeAreas: (value) => set({ showSafeAreas: value }),

      // ─── Color stops ───────────────────────────────────────────────────────

      setStopColor: (index, color) => {
        recordEdit(`stopColor:${index}`)
        set((state) => ({ customStops: updateStopColor(state.customStops, index, color) }))
      },

      setStopPosition: (index, position) => {
        recordEdit(`stopPosition:${index}`)
        set((state) => ({
          customStops: updateStopPosition(state.customStops, index, position),
        }))
      },

      // Used by harmonies, palette extraction and presets: replaces the whole
      // palette at once, as a single history step
      setStops: (stops) => {
        get().pushHistory()
        set({ customStops: sortStops(normalizeStops(stops, get().customStops)) })
      },

      addStop: () => {
        get().pushHistory()
        set((state) => ({ customStops: insertStop(state.customStops) }))
      },

      removeStop: (index) => {
        get().pushHistory()
        set((state) => ({ customStops: removeStopAt(state.customStops, index) }))
      },

      // ─── Save custom scheme ────────────────────────────────────────────────

      saveCustomScheme: (name) =>
        set((state) => {
          const key = nextId("custom")
          return {
            colorSchemes: {
              ...state.colorSchemes,
              [key]: { stops: cloneStops(state.customStops), name },
            },
            colorScheme: key,
            isCustomMode: false,
          }
        }),

      // ─── Reset to defaults ─────────────────────────────────────────────────

      // Restores only the animation parameters and colors. User-saved schemes,
      // layers and UI state are preserved.
      resetToDefaults: () => {
        get().pushHistory()
        set({
          isPlaying: defaultState.isPlaying,
          speed: defaultState.speed,
          complexity: defaultState.complexity,
          noiseScale: defaultState.noiseScale,
          colorScheme: defaultState.colorScheme,
          isCustomMode: defaultState.isCustomMode,
          customStops: cloneStops(defaultState.customStops),
          flowIntensity: defaultState.flowIntensity,
          grainAmount: defaultState.grainAmount,
          grainScale: defaultState.grainScale,
          thresholdMin: defaultState.thresholdMin,
          thresholdMax: defaultState.thresholdMax,
          vibrance: defaultState.vibrance,
          exposure: defaultState.exposure,
          brightness: defaultState.brightness,
          contrast: defaultState.contrast,
          blendSpace: defaultState.blendSpace,
          loopDuration: defaultState.loopDuration,
          seed: [...defaultState.seed] as [number, number],
        })
      },

      // ─── Import settings ───────────────────────────────────────────────────

      importSettings: (settings: ShareableGradient) => {
        // Shared URLs can reference a scheme that does not exist in this client
        // (e.g. another user's custom scheme)
        const colorScheme =
          settings.colorScheme in get().colorSchemes ? settings.colorScheme : "redBlue"

        const clampNum = (n: unknown, min: number, max: number, fallback: number) =>
          typeof n === "number" && Number.isFinite(n)
            ? Math.min(Math.max(n, min), max)
            : fallback

        const validateSeed = (seed: unknown): [number, number] =>
          Array.isArray(seed) && seed.length >= 2
            ? [clampNum(seed[0], -1000, 1000, 0), clampNum(seed[1], -1000, 1000, 0)]
            : [0, 0]

        const validatedSettings: Partial<GradientStore> = {
          speed: Math.min(Math.max(settings.speed, 0.1), 3.0),
          complexity: Math.min(Math.max(Math.round(settings.complexity), 1), 10),
          noiseScale: Math.min(Math.max(settings.noiseScale, 0.5), 5.0),
          colorScheme,
          isCustomMode: Boolean(settings.isCustomMode),
          // v3 links carry stops with positions; earlier ones only three colors
          customStops: normalizeStops(
            settings.stops ?? legacyColorsToStops(settings.customColors),
            defaultState.customStops
          ),
        }

        // Advanced parameters (v2 links) — old links omit them, so they only
        // override when present
        if (settings.flowIntensity !== undefined)
          validatedSettings.flowIntensity = clampNum(settings.flowIntensity, 0.1, 1.0, 0.3)
        if (settings.grainAmount !== undefined)
          validatedSettings.grainAmount = clampNum(settings.grainAmount, 0, 0.2, 0.05)
        if (settings.grainScale !== undefined)
          validatedSettings.grainScale = clampNum(settings.grainScale, 50, 1500, 500)
        if (settings.thresholdMin !== undefined || settings.thresholdMax !== undefined) {
          const tMin = clampNum(settings.thresholdMin, 0.1, 0.8, 0.3)
          const tMax = clampNum(settings.thresholdMax, tMin + 0.1, 0.9, 0.7)
          validatedSettings.thresholdMin = tMin
          validatedSettings.thresholdMax = Math.max(tMax, tMin + 0.1)
        }
        if (settings.vibrance !== undefined)
          validatedSettings.vibrance = clampNum(settings.vibrance, -1, 1, 0)
        if (settings.exposure !== undefined)
          validatedSettings.exposure = clampNum(settings.exposure, -2, 2, 0)
        if (settings.brightness !== undefined)
          validatedSettings.brightness = clampNum(settings.brightness, -0.3, 0.3, 0)
        if (settings.contrast !== undefined)
          validatedSettings.contrast = clampNum(settings.contrast, 0.5, 2, 1)
        if (settings.blendSpace !== undefined)
          validatedSettings.blendSpace =
            settings.blendSpace in colorBlendSpaces
              ? (settings.blendSpace as ColorBlendSpace)
              : "oklab"
        if (settings.seed !== undefined)
          validatedSettings.seed = validateSeed(settings.seed)
        if (settings.loopDuration !== undefined)
          validatedSettings.loopDuration = clampNum(settings.loopDuration, 0, 120, 0)

        // Layers (v2 links with multi-layer on): validates each layer and
        // regenerates ids so they cannot collide with local layers
        if (settings.multiLayerMode && Array.isArray(settings.layers) && settings.layers.length > 0) {
          const validatedLayers: GradientLayer[] = settings.layers.map((layer, index) => ({
            id: `${generateLayerId()}_${index}`,
            opacity: clampNum(layer?.opacity, 0, 1, 1),
            blendMode: typeof layer?.blendMode === "string" && layer.blendMode in blendModes
              ? layer.blendMode
              : "normal",
            visible: layer?.visible !== false,
            colorScheme:
              typeof layer?.colorScheme === "string" && layer.colorScheme in get().colorSchemes
                ? layer.colorScheme
                : "redBlue",
            isCustomMode: Boolean(layer?.isCustomMode),
            // Layers in v2 links carried three colors; v3 carries stops
            customStops: (() => {
              const source = layer as Record<string, unknown> | undefined
              const legacy = legacyColorsToStops(source?.customColors as never)
              const stops = source?.customStops ?? legacy
              return stops ? normalizeStops(stops, defaultState.customStops) : undefined
            })(),
            noiseScale: clampNum(layer?.noiseScale, 0.5, 5.0, 2.0),
            flowIntensity: clampNum(layer?.flowIntensity, 0.1, 1.0, 0.3),
            thresholdMin: clampNum(layer?.thresholdMin, 0.1, 0.8, 0.3),
            thresholdMax: clampNum(layer?.thresholdMax, 0.2, 0.9, 0.7),
            seed: validateSeed(layer?.seed),
          }))
          validatedSettings.multiLayerMode = true
          validatedSettings.layers = validatedLayers
          validatedSettings.activeLayerId = validatedLayers[0].id
        }

        set(validatedSettings)
      },

      // ─── Apply animation preset ────────────────────────────────────────────

      applyAnimationPreset: (presetId: string) => {
        const preset = animationPresets[presetId]
        if (preset) {
          get().pushHistory()
          set({
            speed: preset.speed,
            complexity: preset.complexity,
            noiseScale: preset.noiseScale,
            colorScheme: preset.colorScheme,
            isCustomMode: false,
          })
        }
      },

      // ─── Randomize ─────────────────────────────────────────────────────────

      randomize: () => {
        get().pushHistory()
        const rand = (min: number, max: number) => Math.random() * (max - min) + min
        const randInt = (min: number, max: number) =>
          Math.floor(Math.random() * (max - min + 1)) + min

        const tMin = rand(0.1, 0.45)
        const tMax = Math.min(0.9, tMin + rand(0.2, 0.5))

        // Palette drawn in OKLCH by harmony: drawing R, G and B independently
        // almost always lands on desaturated colors with no relationship to each
        // other — visually, mud
        const palette = randomPalette({ count: randInt(2, 4) })

        set({
          speed: parseFloat(rand(0.2, 2.5).toFixed(1)),
          complexity: randInt(1, 8),
          noiseScale: parseFloat(rand(0.5, 4.5).toFixed(1)),
          flowIntensity: parseFloat(rand(0.1, 0.9).toFixed(2)),
          grainAmount: parseFloat(rand(0, 0.15).toFixed(2)),
          thresholdMin: parseFloat(tMin.toFixed(2)),
          thresholdMax: parseFloat(tMax.toFixed(2)),
          // Draw the shape too, not just the colors and the rhythm
          seed: generateSeed(),
          isCustomMode: true,
          customStops: stopsFromColors(palette.map(oklchToSrgb)),
        })

        // Keeps the result in the randomizer history so a good roll is not lost
        // on the next click
        const rolled = captureSnapshot(get())
        set((state) => ({
          randomHistory: [rolled, ...state.randomHistory].slice(0, RANDOM_HISTORY_LIMIT),
        }))
      },

      // ─── Multi-layer actions ───────────────────────────────────────────────

      // Layers join the history: removing a layer by accident is exactly the kind
      // of action that needs Ctrl+Z
      setMultiLayerMode: (value) => {
        get().pushHistory()
        set({ multiLayerMode: value })
      },

      // Selecting a layer is navigation, not editing — outside the history
      setActiveLayer: (id) => set({ activeLayerId: id }),

      addLayer: () => {
        get().pushHistory()
        set((state) => {
          // Its own seed: a new layer with default parameters draws a different
          // shape instead of stacking the same image
          const newLayer = createDefaultLayer(generateLayerId(), generateSeed())
          return { layers: [...state.layers, newLayer], activeLayerId: newLayer.id }
        })
      },

      removeLayer: (id) => {
        if (get().layers.length <= 1) return
        get().pushHistory()
        set((state) => {
          const newLayers = state.layers.filter((layer) => layer.id !== id)
          const newActiveId =
            id === state.activeLayerId ? newLayers[0].id : state.activeLayerId
          return { layers: newLayers, activeLayerId: newActiveId }
        })
      },

      updateLayer: (id, updates) => {
        // Coalescing per layer+property: dragging one layer's opacity slider
        // produces a single snapshot, not one per event
        recordEdit(`layer:${id}:${Object.keys(updates).sort().join(",")}`)
        set((state) => ({
          layers: state.layers.map((layer) =>
            layer.id === id ? { ...layer, ...updates } : layer
          ),
        }))
      },

      moveLayer: (id, direction) => {
        get().pushHistory()
        set((state) => {
          const index = state.layers.findIndex((layer) => layer.id === id)
          if (index === -1) return state
          const newLayers = [...state.layers]
          if (direction === "up" && index > 0) {
            ;[newLayers[index], newLayers[index - 1]] = [
              newLayers[index - 1],
              newLayers[index],
            ]
          } else if (direction === "down" && index < newLayers.length - 1) {
            ;[newLayers[index], newLayers[index + 1]] = [
              newLayers[index + 1],
              newLayers[index],
            ]
          }
          return { layers: newLayers }
        })
      },

      reorderLayers: (ids: string[]) => {
        get().pushHistory()
        set((state) => {
          const layerMap = new Map(state.layers.map((l) => [l.id, l]))
          const newLayers = ids
            .map((id) => layerMap.get(id))
            .filter((l): l is GradientLayer => l !== undefined)
          return { layers: newLayers }
        })
      },
      }
    },
    {
      name: "gradient-store",
      version: PERSIST_VERSION,
      migrate: migratePersistedState,
      // zustand only calls `migrate` when the stored JSON has a numeric
      // `version` — and earlier versions persisted without that field, so real
      // user localStorage would slip past migration and reach the shader without
      // stops. `merge` runs on every hydration and is where the (idempotent)
      // normalization actually catches those states.
      merge: (persisted, current) =>
        ({
          ...current,
          ...(normalizePersistedState(persisted) as Partial<GradientStore>),
        }) as GradientStore,
      partialize: (state: GradientStore) => ({
        speed: state.speed,
        complexity: state.complexity,
        noiseScale: state.noiseScale,
        colorScheme: state.colorScheme,
        isCustomMode: state.isCustomMode,
        customStops: state.customStops,
        colorSchemes: state.colorSchemes,
        flowIntensity: state.flowIntensity,
        grainAmount: state.grainAmount,
        grainScale: state.grainScale,
        thresholdMin: state.thresholdMin,
        thresholdMax: state.thresholdMax,
        vibrance: state.vibrance,
        exposure: state.exposure,
        brightness: state.brightness,
        contrast: state.contrast,
        blendSpace: state.blendSpace,
        loopDuration: state.loopDuration,
        seed: state.seed,
        artboardId: state.artboardId,
        showSafeAreas: state.showSafeAreas,
        multiLayerMode: state.multiLayerMode,
        layers: state.layers,
        activeLayerId: state.activeLayerId,
        savedPresets: state.savedPresets,
        randomHistory: state.randomHistory,
        // past/future are NOT persisted
      }),
    }
  )
)
