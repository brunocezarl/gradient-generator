"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function WebGLNotSupported() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-gray-900 to-black p-6 text-white">
      <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
      <h2 className="text-2xl font-bold mb-2">WebGL não suportado</h2>
      <p className="text-center mb-6 max-w-md">
        Seu navegador ou dispositivo não suporta WebGL, que é necessário para visualizar os gradientes orgânicos.
      </p>
      <div className="space-y-4">
        <p className="text-sm text-gray-400">Tente as seguintes soluções:</p>
        <ul className="list-disc list-inside text-sm text-gray-300 space-y-2">
          <li>Atualize seu navegador para a versão mais recente</li>
          <li>Tente um navegador diferente como Chrome, Firefox ou Edge</li>
          <li>Verifique se a aceleração de hardware está ativada nas configurações do navegador</li>
          <li>Atualize os drivers de vídeo do seu dispositivo</li>
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
