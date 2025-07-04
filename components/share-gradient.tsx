"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Share, Copy, Check, QrCode } from "lucide-react"
import { useGradientStore } from "@/lib/store"
import { createShareableURL } from "@/lib/share-utils"
import { useToast } from "@/components/ui/use-toast"
import QRCode from "qrcode.react"

export function ShareGradient() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("link")
  const gradientState = useGradientStore()
  const { toast } = useToast()
  
  // Generate shareable URL
  const shareableURL = createShareableURL(gradientState)
  
  // Handle copy to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareableURL)
      setCopied(true)
      
      toast({
        title: "Link copiado!",
        description: "O link foi copiado para a área de transferência.",
      })
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link. Tente selecionar e copiar manualmente.",
        variant: "destructive",
      })
    }
  }
  
  // Handle share via Web Share API if available
  const shareViaWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Meu Gradiente Orgânico",
          text: "Confira este gradiente orgânico que eu criei!",
          url: shareableURL,
        })
        
        toast({
          title: "Compartilhado com sucesso!",
          description: "O gradiente foi compartilhado.",
        })
      } catch (error) {
        console.error("Error sharing:", error)
      }
    } else {
      copyToClipboard()
    }
  }
  
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="w-full bg-gray-900 text-white border-gray-700 hover:bg-gray-800"
      >
        <Share className="mr-2 h-4 w-4" />
        Compartilhar Gradiente
      </Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-gray-900 text-white border-gray-700 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Compartilhar Gradiente</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="link" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="link" className="text-white data-[state=active]:bg-gray-700">
                Link
              </TabsTrigger>
              <TabsTrigger value="qrcode" className="text-white data-[state=active]:bg-gray-700">
                QR Code
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="link" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="share-url" className="text-white">Link para compartilhar</Label>
                <div className="flex space-x-2">
                  <Input
                    id="share-url"
                    value={shareableURL}
                    readOnly
                    className="bg-gray-800 border-gray-700 text-white flex-1"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    size="icon"
                    onClick={copyToClipboard}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              {navigator.share && (
                <Button
                  onClick={shareViaWebShare}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Share className="mr-2 h-4 w-4" />
                  Compartilhar
                </Button>
              )}
            </TabsContent>
            
            <TabsContent value="qrcode" className="mt-4 space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-md">
                <QRCode value={shareableURL} size={200} />
              </div>
              <p className="text-sm text-gray-400 text-center">
                Escaneie o código QR com a câmera do seu dispositivo para abrir este gradiente.
              </p>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button
              onClick={() => setOpen(false)}
              className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
