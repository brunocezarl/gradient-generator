"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { parseShareableURL } from "@/lib/share-utils"
import { useGradientStore } from "@/lib/store"
import GradientGenerator from "@/components/gradient-generator"

export default function ShareHandler() {
  const searchParams = useSearchParams()
  const importSettings = useGradientStore(state => state.importSettings)
  const [isProcessingShare, setIsProcessingShare] = useState(true)

  useEffect(() => {
    const gradientParam = searchParams.get("gradient")

    if (gradientParam) {
      try {
        const fullUrl = `${window.location.origin}${window.location.pathname}?gradient=${gradientParam}`
        const sharedSettings = parseShareableURL(fullUrl)

        if (sharedSettings) {
          importSettings(sharedSettings)
          console.log("Imported shared gradient settings", sharedSettings)
        }
      } catch (error) {
        console.error("Error processing shared gradient:", error)
      } finally {
        setIsProcessingShare(false)
      }
    } else {
      setIsProcessingShare(false)
    }
  }, [searchParams, importSettings])

  if (isProcessingShare) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
      </div>
    )
  }

  return <GradientGenerator />
}
