"use client"

import { useState, useEffect } from "react"

export function useMediaQuery(query: string): boolean {
  // Default to false on the server or in environments without window
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    // Check if window is available (client-side)
    if (typeof window === "undefined") return

    // Create a media query list
    const mediaQuery = window.matchMedia(query)

    // Set the initial value
    setMatches(mediaQuery.matches)

    // Define a callback function to handle changes
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Add the callback as a listener for changes to the media query
    mediaQuery.addEventListener("change", handleChange)

    // Clean up
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [query])

  return matches
}
