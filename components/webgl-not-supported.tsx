"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function WebGLNotSupported() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-gray-900 to-black p-6 text-white">
      <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
      <h2 className="text-2xl font-bold mb-2">WebGL 2 unavailable</h2>
      <p className="text-center mb-6 max-w-md">
        Rendering gradients requires WebGL 2. This browser could not create a WebGL 2 context.
      </p>
      <div className="space-y-4">
        <p className="text-sm text-neutral-400">Things to try:</p>
        <ul className="list-disc list-inside text-sm text-gray-300 space-y-2">
          <li>Update the browser to the latest version</li>
          <li>Try another browser such as Chrome, Firefox, or Edge</li>
          <li>Check that hardware acceleration is enabled in the browser settings</li>
          <li>Update the device graphics drivers</li>
        </ul>
        <Button 
          className="mt-4 bg-blue-600 hover:bg-blue-700"
          onClick={() => window.location.reload()}
        >
          Try again
        </Button>
      </div>
    </div>
  )
}
