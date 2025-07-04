"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { ImageIcon, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface ExportOptionsProps {
  onExport: (format: string, quality: number, scale: number) => Promise<void>
}

export function ExportOptions({ onExport }: ExportOptionsProps) {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState("png")
  const [quality, setQuality] = useState(1)
  const [scale, setScale] = useState(1)
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  const handleExport = async () => {
    try {
      setIsExporting(true)
      await onExport(format, quality, scale)
      setOpen(false)
    } catch (error) {
      console.error("Export error:", error)
      toast({
        title: "Erro na Exportação",
        description: "Ocorreu um erro ao exportar a imagem. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="w-full bg-gray-900 text-white border-gray-700 hover:bg-gray-800"
      >
        <ImageIcon className="mr-2 h-4 w-4" />
        Exportar Imagem
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-gray-900 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle>Opções de Exportação</DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {/* Format Selection */}
            <div className="space-y-2">
              <Label htmlFor="format" className="text-white">Formato</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger id="format" className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Selecione o formato" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="png">PNG (Transparência)</SelectItem>
                  <SelectItem value="jpeg">JPEG (Menor tamanho)</SelectItem>
                  <SelectItem value="webp">WebP (Moderno)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Quality Selection - only for JPEG and WebP */}
            {format !== "png" && (
              <div className="space-y-2">
                <Label htmlFor="quality" className="text-white">Qualidade</Label>
                <Select value={quality.toString()} onValueChange={(value) => setQuality(Number(value))}>
                  <SelectTrigger id="quality" className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Selecione a qualidade" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="0.6">Baixa (60%)</SelectItem>
                    <SelectItem value="0.8">Média (80%)</SelectItem>
                    <SelectItem value="0.9">Alta (90%)</SelectItem>
                    <SelectItem value="1">Máxima (100%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Scale Selection */}
            <div className="space-y-2">
              <Label htmlFor="scale" className="text-white">Tamanho</Label>
              <Select value={scale.toString()} onValueChange={(value) => setScale(Number(value))}>
                <SelectTrigger id="scale" className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Selecione o tamanho" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="0.5">Pequeno (50%)</SelectItem>
                  <SelectItem value="1">Original (100%)</SelectItem>
                  <SelectItem value="2">Grande (200%)</SelectItem>
                  <SelectItem value="4">Extra Grande (400%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700">
                Cancelar
              </Button>
            </DialogClose>
            <Button 
              onClick={handleExport}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Exportar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
