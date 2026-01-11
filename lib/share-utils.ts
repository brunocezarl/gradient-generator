"use client"

import { GradientStore } from "@/lib/store"
import { z } from "zod"

// Zod schema for shareable gradient validation
const ShareableGradientSchema = z.object({
  speed: z.number().min(0.1).max(3.0),
  complexity: z.number().int().min(1).max(10),
  noiseScale: z.number().min(0.5).max(5.0),
  colorScheme: z.string().max(100),
  isCustomMode: z.boolean(),
  customColors: z.object({
    color1: z.array(z.number().min(0).max(1)).length(3),
    color2: z.array(z.number().min(0).max(1)).length(3),
  }),
})

// Define the shape of shareable data
export interface ShareableGradient {
  speed: number
  complexity: number
  noiseScale: number
  colorScheme: string
  isCustomMode: boolean
  customColors: {
    color1: number[]
    color2: number[]
  }
}

// Create a shareable URL for the current gradient settings
export function createShareableURL(state: Partial<GradientStore>): string {
  // Extract only the properties we want to share
  const shareableData: ShareableGradient = {
    speed: state.speed || 1.0,
    complexity: state.complexity || 3,
    noiseScale: state.noiseScale || 2.0,
    colorScheme: state.colorScheme || "redBlue",
    isCustomMode: state.isCustomMode || false,
    customColors: state.customColors || {
      color1: [0.9, 0.1, 0.1],
      color2: [0.0, 0.0, 0.9],
    },
  }

  // Convert to JSON and encode for URL
  const encodedData = encodeURIComponent(JSON.stringify(shareableData))
  
  // Create URL with data as a query parameter
  const url = `${window.location.origin}${window.location.pathname}?gradient=${encodedData}`
  
  return url
}

// Parse a shareable URL to extract gradient settings
export function parseShareableURL(url: string): ShareableGradient | null {
  try {
    // Extract the query parameters
    const urlObj = new URL(url)
    const encodedData = urlObj.searchParams.get("gradient")

    if (!encodedData) return null

    // Add size limit (10KB) to prevent extremely large payloads
    if (encodedData.length > 10240) {
      console.error("Gradient data exceeds size limit")
      return null
    }

    // Decode and parse the data
    const decodedData = decodeURIComponent(encodedData)
    const parsedData = JSON.parse(decodedData)

    // Validate with Zod schema
    const validatedData = ShareableGradientSchema.parse(parsedData)

    return validatedData
  } catch (error) {
    console.error("Error parsing shareable URL:", error)
    return null
  }
}

// Generate a short code for sharing
export function generateShareCode(): string {
  // Generate a random 6-character alphanumeric code
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let code = ""
  
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length)
    code += characters.charAt(randomIndex)
  }
  
  return code
}
