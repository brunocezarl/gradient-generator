import { create } from "zustand"
import { persist } from "zustand/middleware"
import { ShareableGradient } from "@/lib/share-utils"
import { AnimationPreset, animationPresets } from "@/lib/animation-presets"
import { GradientLayer, createDefaultLayer, generateLayerId } from "@/lib/layer-utils"
import { z } from "zod"

// Define color type
type GradientColor = [number, number, number]

// Define color scheme type
type ColorScheme = {
  color1: GradientColor
  color2: GradientColor
  name?: string
}

// Zod schema for persisted state validation
const PersistedStateSchema = z.object({
  speed: z.number().min(0.1).max(3.0),
  complexity: z.number().int().min(1).max(10),
  noiseScale: z.number().min(0.5).max(5.0),
  colorScheme: z.string().max(100),
  isCustomMode: z.boolean(),
  customColors: z.object({
    color1: z.tuple([z.number(), z.number(), z.number()]),
    color2: z.tuple([z.number(), z.number(), z.number()]),
  }),
  colorSchemes: z.record(z.object({
    color1: z.tuple([z.number(), z.number(), z.number()]),
    color2: z.tuple([z.number(), z.number(), z.number()]),
    name: z.string().optional(),
  })),
  grainScale: z.number().min(1).max(2000),
}).partial()

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
  grainAmount: number // Grain intensity
  grainScale: number  // Grain pattern scale
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
  saveCustomScheme: (name: string) => void
  resetToDefaults: () => void
  importSettings: (settings: ShareableGradient) => void
  applyAnimationPreset: (presetId: string) => void

  // Advanced controls
  setAdvancedMode: (value: boolean) => void
  setFlowIntensity: (value: number) => void
  setGrainAmount: (value: number) => void
  setGrainScale: (value: number) => void // Setter for grain scale
  setThresholdMin: (value: number) => void
  setThresholdMax: (value: number) => void

  // Multi-layer actions
  setMultiLayerMode: (value: boolean) => void
  setActiveLayer: (id: string) => void
  addLayer: () => void
  removeLayer: (id: string) => void
  updateLayer: (id: string, updates: Partial<GradientLayer>) => void
  moveLayer: (id: string, direction: 'up' | 'down') => void
}

// Define the type for actions to omit them from defaultState
type StoreActions = Pick<GradientStore, 
  'setIsPlaying' | 'setSpeed' | 'setComplexity' | 'setNoiseScale' | 'setColorScheme' | 
  'toggleMenu' | 'setCustomMode' | 'setCustomColor1' | 'setCustomColor2' | 
  'saveCustomScheme' | 'resetToDefaults' | 'importSettings' | 'applyAnimationPreset' |
  'setAdvancedMode' | 'setFlowIntensity' | 'setGrainAmount' | 'setGrainScale' | 'setThresholdMin' | 'setThresholdMax' | // Added setGrainScale
  'setMultiLayerMode' | 'setActiveLayer' | 'addLayer' | 'removeLayer' | 'updateLayer' | 'moveLayer'
>;

// Default state explicitly typed
const defaultState: Omit<GradientStore, keyof StoreActions> = { // Use Omit to exclude actions
  isPlaying: true,
  speed: 1.0,
  complexity: 3,
  noiseScale: 2.0,
  colorScheme: "redBlue",
  menuOpen: true,
  isCustomMode: false,
  customColors: { // Ensure GradientColor type
    color1: [0.9, 0.1, 0.1] as GradientColor,
    color2: [0.0, 0.0, 0.9] as GradientColor,
  },

  // Advanced parameters with default values
  advancedMode: false,
  flowIntensity: 0.3,
  grainAmount: 0.05,
  grainScale: 500.0, // Default grain scale
  thresholdMin: 0.3,
  thresholdMax: 0.7,

  // Multi-layer support
  multiLayerMode: false,
  layers: [createDefaultLayer(generateLayerId())],
  activeLayerId: "", // Will be set in initialization
  colorSchemes: {
    redBlue: {
      color1: [0.9, 0.1, 0.1],
      color2: [0.0, 0.0, 0.9],
      name: "Vermelho & Azul"
    },
    greenPurple: {
      color1: [0.1, 0.9, 0.1],
      color2: [0.7, 0.0, 0.7],
      name: "Verde & Roxo"
    },
    multiColor: {
      color1: [1.0, 0.2, 0.8],
      color2: [0.1, 0.9, 1.0],
      name: "Multi Cor"
    },
    neon: {
      color1: [1.0, 0.6, 0.0],
      color2: [0.0, 1.0, 1.0],
      name: "Neon"
    },
    yellowPink: {
      color1: [1.0, 0.9, 0.1],
      color2: [1.0, 0.1, 0.5],
      name: "Amarelo & Rosa"
    },
  }
}

// Create the store with persistence
export const useGradientStore = create<GradientStore>()( // Added () to correctly call create
  persist(
    (set, get) => ({
      // Start with the initial state derived from defaultState
      ...defaultState,
      activeLayerId: defaultState.layers[0].id, // Set initial active layer

      // Actions
      setIsPlaying: (value) => set({ isPlaying: value }),
      setSpeed: (value) => set({ speed: value }),
      setComplexity: (value) => set({ complexity: value }),
      setNoiseScale: (value) => set({ noiseScale: value }),
      setColorScheme: (value) => set({ colorScheme: value }),
      toggleMenu: () => set((state) => ({ menuOpen: !state.menuOpen })),
      setCustomMode: (value) => set({ isCustomMode: value }),

      // Advanced controls
      setAdvancedMode: (value) => set({ advancedMode: value }),
  setFlowIntensity: (value) => set({ flowIntensity: value }),
  setGrainAmount: (value) => set({ grainAmount: value }),
  setGrainScale: (value) => set({ grainScale: value }), // Added setter logic
  setThresholdMin: (value) => set({ thresholdMin: value }),
  setThresholdMax: (value) => set({ thresholdMax: Math.max(value, get().thresholdMin + 0.1) }),

      // Custom color actions
      setCustomColor1: (color) => set((state) => ({
        customColors: {
          ...state.customColors,
          color1: color
        }
      })),

      setCustomColor2: (color) => set((state) => ({
        customColors: {
          ...state.customColors,
          color2: color
        }
      })),

      // Save custom scheme
      saveCustomScheme: (name) => set((state) => {
        // Generate a unique key for the new scheme
        const key = `custom_${Date.now()}`

        // Create new color schemes object with the custom scheme added
        const newColorSchemes = {
          ...state.colorSchemes,
          [key]: {
            ...state.customColors,
            name
          }
        }

        return {
          colorSchemes: newColorSchemes,
          colorScheme: key, // Switch to the new scheme
          isCustomMode: false // Exit custom mode
        }
      }),

      // Reset to defaults
      resetToDefaults: () => set(defaultState),

      // Import settings from shared URL
      importSettings: (settings: ShareableGradient) => {
        // Validate the imported settings
        const validatedSettings: Partial<GradientStore> = { // Ensure correct type
          speed: Math.min(Math.max(settings.speed, 0.1), 3.0),
          complexity: Math.min(Math.max(Math.round(settings.complexity), 1), 10),
          noiseScale: Math.min(Math.max(settings.noiseScale, 0.5), 5.0),
          colorScheme: settings.colorScheme,
          isCustomMode: settings.isCustomMode,
          customColors: {
            color1: settings.customColors.color1 as GradientColor, // Type assertion
            color2: settings.customColors.color2 as GradientColor, // Type assertion
          }
        }

        set(validatedSettings)
      },

      // Apply animation preset
      applyAnimationPreset: (presetId: string) => {
        const preset = animationPresets[presetId]

        if (preset) {
          set({
            speed: preset.speed,
            complexity: preset.complexity,
            noiseScale: preset.noiseScale,
            colorScheme: preset.colorScheme,
            isCustomMode: false
          })
        }
      },

      // Multi-layer actions
      setMultiLayerMode: (value) => set({ multiLayerMode: value }),

      setActiveLayer: (id) => set({ activeLayerId: id }),

      addLayer: () => set((state) => {
        const newLayer = createDefaultLayer(generateLayerId())
        return {
          layers: [...state.layers, newLayer],
          activeLayerId: newLayer.id
        }
      }),

      removeLayer: (id) => set((state) => {
        // Don't remove the last layer
        if (state.layers.length <= 1) return state

        const newLayers = state.layers.filter(layer => layer.id !== id)
        let newActiveId = state.activeLayerId

        // If we're removing the active layer, select another one
        if (id === state.activeLayerId) {
          newActiveId = newLayers[0].id
        }

        return {
          layers: newLayers,
          activeLayerId: newActiveId
        }
      }),

      updateLayer: (id, updates) => set((state) => {
        const newLayers = state.layers.map(layer =>
          layer.id === id ? { ...layer, ...updates } : layer
        )

        return { layers: newLayers }
      }),

      moveLayer: (id, direction) => set((state) => {
        const index = state.layers.findIndex(layer => layer.id === id)
        if (index === -1) return state

        const newLayers = [...state.layers]

        if (direction === 'up' && index > 0) {
          // Move layer up (visually down in the stack)
          [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]]
        } else if (direction === 'down' && index < newLayers.length - 1) {
          // Move layer down (visually up in the stack)
          [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]]
        }

        return { layers: newLayers }
      }), // Close the main store object
    }), // Closing parenthesis for the main store function body
    {
      name: "gradient-store", // Name for localStorage
      partialize: (state: GradientStore) => { // Use explicit block body
        return { // Explicit return
          // Only persist these fields
          speed: state.speed,
          complexity: state.complexity,
          noiseScale: state.noiseScale,
          colorScheme: state.colorScheme,
          isCustomMode: state.isCustomMode,
          customColors: state.customColors,
          colorSchemes: state.colorSchemes,
          // Persist grainScale as well
          grainScale: state.grainScale,
        }
      },
      merge: (persistedState, currentState) => {
        try {
          // Validate persisted state with Zod
          const validatedState = PersistedStateSchema.parse(persistedState)
          return { ...currentState, ...validatedState }
        } catch (error) {
          console.error("Invalid persisted state, using defaults:", error)
          return currentState
        }
      }
    } 
  ) // Closing parenthesis for persist
) // Closing parenthesis for create
