"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { parseShareableURL } from "@/lib/share-utils"
import { useGradientStore } from "@/lib/store"

// Dynamically import the GradientGenerator to avoid SSR issues
const GradientGenerator = dynamic(() => import("@/components/gradient-generator"), {
  ssr: false,
})

export default function Home() {
  const searchParams = useSearchParams()
  const importSettings = useGradientStore(state => state.importSettings)
  const [isProcessingShare, setIsProcessingShare] = useState(false)

  // Process shared gradient from URL parameters
  useEffect(() => {
    const gradientParam = searchParams.get("gradient")

    if (gradientParam) {
      setIsProcessingShare(true)
      try {
        // Reconstruct full URL to parse
        const fullUrl = `${window.location.origin}${window.location.pathname}?gradient=${gradientParam}`
        const sharedSettings = parseShareableURL(fullUrl)

        if (sharedSettings) {
          // Import the shared settings
          importSettings(sharedSettings)
          console.log("Imported shared gradient settings", sharedSettings)
        }
      } catch (error) {
        console.error("Error processing shared gradient:", error)
      } finally {
        setIsProcessingShare(false)
      }
    }
  }, [searchParams, importSettings])

  return (
    <main className="w-full h-screen p-0 m-0 overflow-hidden bg-black">
      {isProcessingShare ? (
        <div className="flex items-center justify-center h-full">
          <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
        </div>
      ) : (
        <GradientGenerator />
      )}
    </main>
  )
}
