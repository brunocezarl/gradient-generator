import { create } from "zustand"
import { persist } from "zustand/middleware"
import { ShareableGradient } from "@/lib/share-utils"
import { AnimationPreset, animationPresets } from "@/lib/animation-presets"
import { GradientLayer, createDefaultLayer, generateLayerId } from "@/lib/layer-utils"

// Define color type
type GradientColor = [number, number, number]

// Define color scheme type (agora com 3 cores)
export type ColorScheme = {
  color1: GradientColor
  color2: GradientColor
  color3: GradientColor
  name?: string
}

// Snapshot para undo/redo
type StateSnapshot = {
  speed: number
  complexity: number
  noiseScale: number
  colorScheme: string
  isCustomMode: boolean
  customColors: ColorScheme
  flowIntensity: number
  grainAmount: number
  grainScale: number
  thresholdMin: number
  thresholdMax: number
}

// Coalescência de histórico: edições contínuas (arrastar um slider) geram um
// único snapshot em vez de um por evento de mudança
const HISTORY_COALESCE_MS = 1000
let lastHistoryKey: string | null = null
let lastHistoryTime = 0

function captureSnapshot(state: GradientStore): StateSnapshot {
  return {
    speed: state.speed,
    complexity: state.complexity,
    noiseScale: state.noiseScale,
    colorScheme: state.colorScheme,
    isCustomMode: state.isCustomMode,
    customColors: {
      color1: [...state.customColors.color1] as GradientColor,
      color2: [...state.customColors.color2] as GradientColor,
      color3: [...state.customColors.color3] as GradientColor,
    },
    flowIntensity: state.flowIntensity,
    grainAmount: state.grainAmount,
    grainScale: state.grainScale,
    thresholdMin: state.thresholdMin,
    thresholdMax: state.thresholdMax,
  }
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
  customColors: ColorScheme

  // Advanced parameters
  advancedMode: boolean
  flowIntensity: number
  grainAmount: number
  grainScale: number
  thresholdMin: number
  thresholdMax: number

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

  // Actions
  setIsPlaying: (value: boolean) => void
  setSpeed: (value: number) => void
  setComplexity: (value: number) => void
  setNoiseScale: (value: number) => void
  setColorScheme: (value: string) => void
  toggleMenu: () => void
  setCustomMode: (value: boolean) => void
  setCustomColor1: (color: GradientColor) => void
  setCustomColor2: (color: GradientColor) => void
  setCustomColor3: (color: GradientColor) => void
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
  | "setCustomColor1"
  | "setCustomColor2"
  | "setCustomColor3"
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
  customColors: {
    color1: [0.9, 0.1, 0.1] as GradientColor,
    color2: [0.0, 0.0, 0.9] as GradientColor,
    color3: [0.5, 0.0, 0.5] as GradientColor,
  },

  advancedMode: false,
  flowIntensity: 0.3,
  grainAmount: 0.05,
  grainScale: 500.0,
  thresholdMin: 0.3,
  thresholdMax: 0.7,

  multiLayerMode: false,
  layers: [createDefaultLayer(generateLayerId())],
  activeLayerId: "",

  past: [],
  future: [],

  colorSchemes: {
    redBlue: {
      color1: [0.9, 0.1, 0.1],
      color2: [0.0, 0.0, 0.9],
      color3: [0.5, 0.0, 0.5],
      name: "Vermelho & Azul",
    },
    greenPurple: {
      color1: [0.1, 0.9, 0.1],
      color2: [0.7, 0.0, 0.7],
      color3: [0.0, 0.4, 0.8],
      name: "Verde & Roxo",
    },
    multiColor: {
      color1: [1.0, 0.2, 0.8],
      color2: [0.1, 0.9, 1.0],
      color3: [0.5, 1.0, 0.2],
      name: "Multi Cor",
    },
    neon: {
      color1: [1.0, 0.6, 0.0],
      color2: [0.0, 1.0, 1.0],
      color3: [0.8, 0.0, 1.0],
      name: "Neon",
    },
    yellowPink: {
      color1: [1.0, 0.9, 0.1],
      color2: [1.0, 0.1, 0.5],
      color3: [1.0, 0.5, 0.1],
      name: "Amarelo & Rosa",
    },
  },
}

// Resolve o esquema de cores ativo com fallback seguro — o nome do esquema
// pode vir de uma URL compartilhada ou de um store persistido apontando para
// um esquema que não existe mais
export function resolveActiveColors(
  state: Pick<GradientStore, "isCustomMode" | "customColors" | "colorScheme" | "colorSchemes">
): ColorScheme {
  if (state.isCustomMode) return state.customColors
  return (
    state.colorSchemes[state.colorScheme] ??
    state.colorSchemes.redBlue ??
    defaultState.colorSchemes.redBlue
  )
}

// Create the store with persistence
export const useGradientStore = create<GradientStore>()(
  persist(
    (set, get) => {
      // Tira um snapshot antes da primeira edição de uma sequência contínua
      // (ex.: arrastar um slider). Edições do mesmo controle dentro da janela
      // de coalescência não geram novos snapshots.
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
          ...prev,
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
          ...next,
          past: [...state.past, current],
          future: remainingFuture,
        })
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

      // ─── Custom color actions ──────────────────────────────────────────────

      setCustomColor1: (color) => {
        recordEdit("customColor1")
        set((state) => ({ customColors: { ...state.customColors, color1: color } }))
      },

      setCustomColor2: (color) => {
        recordEdit("customColor2")
        set((state) => ({ customColors: { ...state.customColors, color2: color } }))
      },

      setCustomColor3: (color) => {
        recordEdit("customColor3")
        set((state) => ({ customColors: { ...state.customColors, color3: color } }))
      },

      // ─── Save custom scheme ────────────────────────────────────────────────

      saveCustomScheme: (name) =>
        set((state) => {
          const key = `custom_${Date.now()}`
          return {
            colorSchemes: {
              ...state.colorSchemes,
              [key]: { ...state.customColors, name },
            },
            colorScheme: key,
            isCustomMode: false,
          }
        }),

      // ─── Reset to defaults ─────────────────────────────────────────────────

      // Restaura apenas os parâmetros de animação e cores. Esquemas salvos
      // pelo usuário, camadas e estado da UI são preservados.
      resetToDefaults: () => {
        get().pushHistory()
        set({
          isPlaying: defaultState.isPlaying,
          speed: defaultState.speed,
          complexity: defaultState.complexity,
          noiseScale: defaultState.noiseScale,
          colorScheme: defaultState.colorScheme,
          isCustomMode: defaultState.isCustomMode,
          customColors: {
            color1: [...defaultState.customColors.color1] as GradientColor,
            color2: [...defaultState.customColors.color2] as GradientColor,
            color3: [...defaultState.customColors.color3] as GradientColor,
          },
          flowIntensity: defaultState.flowIntensity,
          grainAmount: defaultState.grainAmount,
          grainScale: defaultState.grainScale,
          thresholdMin: defaultState.thresholdMin,
          thresholdMax: defaultState.thresholdMax,
        })
      },

      // ─── Import settings ───────────────────────────────────────────────────

      importSettings: (settings: ShareableGradient) => {
        const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1)
        const validateColor = (
          color: number[] | undefined,
          fallback: GradientColor
        ): GradientColor =>
          Array.isArray(color) && color.length >= 3 && color.every((c) => typeof c === "number")
            ? [clamp01(color[0]), clamp01(color[1]), clamp01(color[2])]
            : fallback

        // URLs compartilhadas podem referenciar um esquema que não existe
        // neste cliente (ex.: esquema custom de outro usuário)
        const colorScheme =
          settings.colorScheme in get().colorSchemes ? settings.colorScheme : "redBlue"

        const validatedSettings: Partial<GradientStore> = {
          speed: Math.min(Math.max(settings.speed, 0.1), 3.0),
          complexity: Math.min(Math.max(Math.round(settings.complexity), 1), 10),
          noiseScale: Math.min(Math.max(settings.noiseScale, 0.5), 5.0),
          colorScheme,
          isCustomMode: Boolean(settings.isCustomMode),
          customColors: {
            color1: validateColor(settings.customColors?.color1, [0.9, 0.1, 0.1]),
            color2: validateColor(settings.customColors?.color2, [0.0, 0.0, 0.9]),
            color3: validateColor(settings.customColors?.color3, [0.5, 0.0, 0.5]),
          },
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
        const randColor = (): GradientColor => [
          Math.random(),
          Math.random(),
          Math.random(),
        ]

        const tMin = rand(0.1, 0.45)
        const tMax = Math.min(0.9, tMin + rand(0.2, 0.5))

        set({
          speed: parseFloat(rand(0.2, 2.5).toFixed(1)),
          complexity: randInt(1, 8),
          noiseScale: parseFloat(rand(0.5, 4.5).toFixed(1)),
          flowIntensity: parseFloat(rand(0.1, 0.9).toFixed(2)),
          grainAmount: parseFloat(rand(0, 0.15).toFixed(2)),
          thresholdMin: parseFloat(tMin.toFixed(2)),
          thresholdMax: parseFloat(tMax.toFixed(2)),
          isCustomMode: true,
          customColors: {
            color1: randColor(),
            color2: randColor(),
            color3: randColor(),
          },
        })
      },

      // ─── Multi-layer actions ───────────────────────────────────────────────

      setMultiLayerMode: (value) => set({ multiLayerMode: value }),

      setActiveLayer: (id) => set({ activeLayerId: id }),

      addLayer: () =>
        set((state) => {
          const newLayer = createDefaultLayer(generateLayerId())
          return { layers: [...state.layers, newLayer], activeLayerId: newLayer.id }
        }),

      removeLayer: (id) =>
        set((state) => {
          if (state.layers.length <= 1) return state
          const newLayers = state.layers.filter((layer) => layer.id !== id)
          const newActiveId =
            id === state.activeLayerId ? newLayers[0].id : state.activeLayerId
          return { layers: newLayers, activeLayerId: newActiveId }
        }),

      updateLayer: (id, updates) =>
        set((state) => ({
          layers: state.layers.map((layer) =>
            layer.id === id ? { ...layer, ...updates } : layer
          ),
        })),

      moveLayer: (id, direction) =>
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
        }),

      reorderLayers: (ids: string[]) =>
        set((state) => {
          const layerMap = new Map(state.layers.map((l) => [l.id, l]))
          const newLayers = ids
            .map((id) => layerMap.get(id))
            .filter((l): l is GradientLayer => l !== undefined)
          return { layers: newLayers }
        }),
      }
    },
    {
      name: "gradient-store",
      partialize: (state: GradientStore) => ({
        speed: state.speed,
        complexity: state.complexity,
        noiseScale: state.noiseScale,
        colorScheme: state.colorScheme,
        isCustomMode: state.isCustomMode,
        customColors: state.customColors,
        colorSchemes: state.colorSchemes,
        grainScale: state.grainScale,
        // past/future NÃO são persistidos
      }),
    }
  )
)
