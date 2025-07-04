"use client"

import { GradientStore } from "@/lib/store"

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
    
    // Decode and parse the data
    const decodedData = decodeURIComponent(encodedData)
    const parsedData = JSON.parse(decodedData) as ShareableGradient
    
    return parsedData
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
