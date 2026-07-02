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
    name: "Calmo",
    description: "Movimento suave e lento com cores relaxantes",
    speed: 0.5,
    complexity: 2,
    noiseScale: 1.5,
    colorScheme: "redBlue"
  },
  energetic: {
    name: "Energético",
    description: "Movimento rápido e vibrante com cores intensas",
    speed: 2.0,
    complexity: 5,
    noiseScale: 3.0,
    colorScheme: "neon"
  },
  subtle: {
    name: "Sutil",
    description: "Movimento muito suave com transições delicadas",
    speed: 0.3,
    complexity: 1,
    noiseScale: 1.0,
    colorScheme: "greenPurple"
  },
  chaotic: {
    name: "Caótico",
    description: "Movimento rápido e complexo com padrões imprevisíveis",
    speed: 2.5,
    complexity: 8,
    noiseScale: 4.0,
    colorScheme: "multiColor"
  },
  dreamy: {
    name: "Sonhador",
    description: "Movimento médio com padrões fluidos e cores suaves",
    speed: 1.2,
    complexity: 4,
    noiseScale: 2.0,
    colorScheme: "yellowPink"
  },
  cosmic: {
    name: "Cósmico",
    description: "Padrões complexos que lembram nebulosas e galáxias",
    speed: 1.0,
    complexity: 7,
    noiseScale: 2.5,
    colorScheme: "multiColor"
  },
  ocean: {
    name: "Oceânico",
    description: "Movimento ondulado que lembra as ondas do mar",
    speed: 0.8,
    complexity: 3,
    noiseScale: 2.2,
    colorScheme: "redBlue" // Azul predominante
  },
  lava: {
    name: "Lava",
    description: "Movimento lento e intenso como magma vulcânico",
    speed: 0.6,
    complexity: 4,
    noiseScale: 1.8,
    colorScheme: "yellowPink" // Vermelho e amarelo
  }
}
