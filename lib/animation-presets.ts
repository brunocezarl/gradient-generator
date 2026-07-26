"use client"

// Define the animation preset type
export interface AnimationPreset {
  name: string
  description: string
  speed: number
  complexity: number
  noiseScale: number
  colorScheme: string
}

// Define a collection of animation presets
export const animationPresets: Record<string, AnimationPreset> = {
  calm: {
    name: "Calm",
    description: "Slow, soft motion with restful colors",
    speed: 0.5,
    complexity: 2,
    noiseScale: 1.5,
    colorScheme: "redBlue"
  },
  energetic: {
    name: "Energetic",
    description: "Fast, vivid motion with intense colors",
    speed: 2.0,
    complexity: 5,
    noiseScale: 3.0,
    colorScheme: "neon"
  },
  subtle: {
    name: "Subtle",
    description: "Very gentle motion with delicate transitions",
    speed: 0.3,
    complexity: 1,
    noiseScale: 1.0,
    colorScheme: "greenPurple"
  },
  chaotic: {
    name: "Chaotic",
    description: "Fast, complex motion with unpredictable patterns",
    speed: 2.5,
    complexity: 8,
    noiseScale: 4.0,
    colorScheme: "multiColor"
  },
  dreamy: {
    name: "Dreamy",
    description: "Medium motion with fluid patterns and soft colors",
    speed: 1.2,
    complexity: 4,
    noiseScale: 2.0,
    colorScheme: "yellowPink"
  },
  cosmic: {
    name: "Cosmic",
    description: "Complex patterns recalling nebulae and galaxies",
    speed: 1.0,
    complexity: 7,
    noiseScale: 2.5,
    colorScheme: "multiColor"
  },
  ocean: {
    name: "Oceanic",
    description: "Rolling motion recalling sea waves",
    speed: 0.8,
    complexity: 3,
    noiseScale: 2.2,
    colorScheme: "redBlue" // mostly blue
  },
  lava: {
    name: "Lava",
    description: "Slow, intense motion like volcanic magma",
    speed: 0.6,
    complexity: 4,
    noiseScale: 1.8,
    colorScheme: "yellowPink" // red and yellow
  }
}
