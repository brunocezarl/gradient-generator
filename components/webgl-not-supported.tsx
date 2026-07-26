"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function WebGLNotSupported() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-gray-900 to-black p-6 text-white">
      <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
      <h2 className="text-2xl font-bold mb-2">WebGL not supported</h2>
      <p className="text-center mb-6 max-w-md">
        This browser or device does not support WebGL, which is required to render the organic gradients.
      </p>
      <div className="space-y-4">
        <p className="text-sm text-neutral-400">Things to try:</p>
        <ul className="list-disc list-inside text-sm text-gray-300 space-y-2">
          <li>Update the browser to the latest version</li>
          <li>Tente um navegador diferente como Chrome, Firefox ou Edge</li>
          <li>Check that hardware acceleration is enabled in the browser settings</li>
          <li>Update the device graphics drivers</li>
        </ul>
        <Button 
          className="mt-4 bg-blue-600 hover:bg-blue-700"
          onClick={() => window.location.reload()}
        >
          Tentar novamente
        </Button>
      </div>
    </div>
  )
}
