"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VideoIcon, Loader2, StopCircle, Info } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useDeviceOptimizations } from "@/hooks/use-device-optimizations"

type VideoFormat = "webm" | "mp4"

// Nem todo navegador suporta todos os contêineres/codecs no MediaRecorder
// (ex.: Chrome/Firefox não gravam MP4). Detectar em runtime.
const MIME_CANDIDATES: Record<VideoFormat, string[]> = {
  webm: ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"],
  mp4: ["video/mp4;codecs=avc1", "video/mp4"],
}

function getSupportedMimeType(format: VideoFormat): string | null {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return null
  return MIME_CANDIDATES[format].find((mime) => MediaRecorder.isTypeSupported(mime)) ?? null
}

interface VideoExportProps {
  containerRef: React.RefObject<HTMLDivElement | null> // Allow null
}

export function VideoExport({ containerRef }: VideoExportProps) {
  const [open, setOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(5)
  const [fps, setFps] = useState(30)
  const [quality, setQuality] = useState("high")
  const [format, setFormat] = useState<VideoFormat>("webm")
  const [activeTab, setActiveTab] = useState("basic")
  const [filename, setFilename] = useState(`gradient-animation-${Date.now()}`)

  // Configurações avançadas
  const [resolution, setResolution] = useState("original") // original, 720p, 1080p, etc.
  const [bitrate, setBitrate] = useState(8) // em Mbps

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const animationFrameRef = useRef<number | null>(null)
  const scaleFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const { toast } = useToast()

  // Verificar otimizações de dispositivo
  const { isMobile, quality: deviceQuality } = useDeviceOptimizations()

  // Verificar suporte a gravação de vídeo e quais formatos o navegador grava
  const [supportedFormats, setSupportedFormats] = useState<Record<VideoFormat, string | null>>({
    webm: null,
    mp4: null,
  })
  const hasMediaRecorderSupport = supportedFormats.webm !== null || supportedFormats.mp4 !== null

  useEffect(() => {
    setSupportedFormats({
      webm: getSupportedMimeType("webm"),
      mp4: getSupportedMimeType("mp4"),
    })

    // Definir qualidade padrão com base no dispositivo
    if (isMobile) {
      setQuality("low")
      setFps(24)
    } else if (deviceQuality === "low") {
      setQuality("medium")
    }
  }, [isMobile, deviceQuality])

  // Se o formato selecionado não é suportado, cair para o que for
  useEffect(() => {
    if (!supportedFormats[format] && hasMediaRecorderSupport) {
      setFormat(supportedFormats.webm ? "webm" : "mp4")
    }
  }, [supportedFormats, format, hasMediaRecorderSupport])

  // Calcular o bitrate com base na qualidade e resolução
  const calculateBitrate = (): number => {
    // Valores base em Mbps
    const qualityMultiplier = quality === "high" ? 1.0 : quality === "medium" ? 0.6 : 0.3
    return bitrate * 1000000 * qualityMultiplier
  }

  // Obter dimensões de saída com base na resolução selecionada,
  // preservando a proporção do canvas (largura arredondada para par,
  // exigido por alguns encoders)
  const getOutputDimensions = (canvas: HTMLCanvasElement): { width: number, height: number } => {
    const targetHeight =
      resolution === "480p" ? 480 : resolution === "720p" ? 720 : resolution === "1080p" ? 1080 : null

    if (targetHeight === null || targetHeight === canvas.height) {
      return { width: canvas.width, height: canvas.height }
    }

    const aspectRatio = canvas.width / canvas.height
    const width = Math.round((targetHeight * aspectRatio) / 2) * 2
    return { width, height: targetHeight }
  }

  const startRecording = async () => {
    if (!containerRef.current) {
      toast({
        title: "Erro",
        description: "Não foi possível encontrar o elemento para gravar.",
        variant: "destructive",
      })
      return
    }

    const mimeType = supportedFormats[format]
    if (!mimeType) {
      toast({
        title: "Formato não suportado",
        description: `Seu navegador não suporta gravação em ${format.toUpperCase()}.`,
        variant: "destructive",
      })
      return
    }

    try {
      // Resetar estado
      setIsRecording(true)
      setProgress(0)
      chunksRef.current = []

      // Obter o elemento canvas
      const canvas = containerRef.current.querySelector("canvas")
      if (!canvas) {
        throw new Error("Canvas element not found")
      }

      // Gravar na resolução selecionada: se for diferente da original,
      // copiar cada frame para um canvas redimensionado e gravar a partir dele
      const { width, height } = getOutputDimensions(canvas)
      let sourceCanvas: HTMLCanvasElement = canvas

      if (width !== canvas.width || height !== canvas.height) {
        const scaledCanvas = document.createElement("canvas")
        scaledCanvas.width = width
        scaledCanvas.height = height
        const ctx = scaledCanvas.getContext("2d")
        if (!ctx) throw new Error("Could not get 2D context for scaled recording")
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"

        const copyFrame = () => {
          ctx.drawImage(canvas, 0, 0, width, height)
          scaleFrameRef.current = requestAnimationFrame(copyFrame)
        }
        copyFrame()
        sourceCanvas = scaledCanvas
      }

      // Criar um stream de mídia a partir do canvas
      const stream = sourceCanvas.captureStream(fps)

      // Configurar o media recorder com as opções apropriadas
      const options: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: calculateBitrate()
      }

      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder

      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        if (scaleFrameRef.current) {
          cancelAnimationFrame(scaleFrameRef.current)
          scaleFrameRef.current = null
        }

        // Criar um blob a partir dos chunks gravados
        const blob = new Blob(chunksRef.current, { type: mimeType.split(";")[0] })

        // Criar um link de download
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `${filename}.${format}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        // Limpar recursos
        URL.revokeObjectURL(url)
        setIsRecording(false)
        setProgress(0)

        // Atualizar o nome do arquivo para a próxima exportação
        setFilename(`gradient-animation-${Date.now()}`)

        toast({
          title: "Vídeo Exportado",
          description: `Seu vídeo foi exportado com sucesso como ${filename}.${format}`,
        })
      }

      // Start recording
      mediaRecorder.start(100) // Collect data in chunks of 100ms
      startTimeRef.current = performance.now()

      // Start the progress update
      updateProgress()

      toast({
        title: "Gravação Iniciada",
        description: `Gravando vídeo de ${duration} segundos...`,
      })

      // Stop recording after the specified duration
      setTimeout(() => {
        stopRecording()
      }, duration * 1000)

    } catch (error) {
      console.error("Error starting recording:", error)
      setIsRecording(false)

      if (scaleFrameRef.current) {
        cancelAnimationFrame(scaleFrameRef.current)
        scaleFrameRef.current = null
      }

      toast({
        title: "Erro na Gravação",
        description: "Ocorreu um erro ao iniciar a gravação do vídeo.",
        variant: "destructive",
      })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }

  const updateProgress = () => {
    const elapsed = (performance.now() - startTimeRef.current) / 1000
    const newProgress = Math.min(100, (elapsed / duration) * 100)
    setProgress(newProgress)

    if (newProgress < 100) {
      animationFrameRef.current = requestAnimationFrame(updateProgress)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="w-full bg-gray-900 text-white border-gray-700 hover:bg-gray-800"
        disabled={isRecording || !hasMediaRecorderSupport}
      >
        {isRecording ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Gravando... {Math.round(progress)}%
          </>
        ) : !hasMediaRecorderSupport ? (
          <>
            <VideoIcon className="mr-2 h-4 w-4" />
            Exportação de Vídeo Indisponível
          </>
        ) : (
          <>
            <VideoIcon className="mr-2 h-4 w-4" />
            Exportar Vídeo
          </>
        )}
      </Button>

      {!hasMediaRecorderSupport && (
        <div className="mt-2 text-xs text-gray-400 text-center">
          Seu navegador não suporta gravação de vídeo.
        </div>
      )}

      <Dialog open={open && !isRecording && hasMediaRecorderSupport} onOpenChange={(value) => !isRecording && setOpen(value)}>
        <DialogContent className="bg-gray-900 text-white border-gray-700 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Vídeo</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="basic" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="basic" className="text-white data-[state=active]:bg-gray-700">
                Básico
              </TabsTrigger>
              <TabsTrigger value="advanced" className="text-white data-[state=active]:bg-gray-700">
                Avançado
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="mt-4 space-y-4">
              {/* Duration */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="duration" className="text-white">Duração: {duration} segundos</Label>
                </div>
                <Slider
                  id="duration"
                  value={[duration]}
                  min={1}
                  max={30}
                  step={1}
                  onValueChange={(value) => setDuration(value[0])}
                />
              </div>

              {/* FPS */}
              <div className="space-y-2">
                <Label htmlFor="fps" className="text-white">Quadros por Segundo (FPS)</Label>
                <Select value={fps.toString()} onValueChange={(value) => setFps(Number(value))}>
                  <SelectTrigger id="fps" className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Selecione o FPS" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="15">15 FPS (Menor tamanho)</SelectItem>
                    <SelectItem value="30">30 FPS (Recomendado)</SelectItem>
                    <SelectItem value="60">60 FPS (Alta qualidade)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quality */}
              <div className="space-y-2">
                <Label htmlFor="quality" className="text-white">Qualidade</Label>
                <Select value={quality} onValueChange={setQuality}>
                  <SelectTrigger id="quality" className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Selecione a qualidade" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="low">Baixa (Menor tamanho)</SelectItem>
                    <SelectItem value="medium">Média (Recomendado)</SelectItem>
                    <SelectItem value="high">Alta (Melhor qualidade)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Format */}
              <div className="space-y-2">
                <Label htmlFor="format" className="text-white">Formato</Label>
                <Select value={format} onValueChange={(value) => setFormat(value as VideoFormat)}>
                  <SelectTrigger id="format" className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Selecione o formato" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    {supportedFormats.webm && <SelectItem value="webm">WebM (Recomendado)</SelectItem>}
                    {supportedFormats.mp4 && <SelectItem value="mp4">MP4</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="mt-4 space-y-4">
              {/* Filename */}
              <div className="space-y-2">
                <Label htmlFor="filename" className="text-white">Nome do Arquivo</Label>
                <Input
                  id="filename"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              {/* Resolution */}
              <div className="space-y-2">
                <Label htmlFor="resolution" className="text-white">Resolução</Label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger id="resolution" className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Selecione a resolução" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="original">Original</SelectItem>
                    <SelectItem value="480p">480p</SelectItem>
                    <SelectItem value="720p">720p (HD)</SelectItem>
                    <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bitrate */}
              <div className="space-y-2">
                <Label htmlFor="bitrate" className="text-white">Bitrate: {bitrate} Mbps</Label>
                <Slider
                  id="bitrate"
                  min={1}
                  max={16}
                  step={1}
                  value={[bitrate]}
                  onValueChange={(value) => setBitrate(value[0])}
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Info className="h-4 w-4 text-gray-400" />
                <p className="text-xs text-gray-400">
                  Configurações avançadas podem afetar o tamanho do arquivo e a qualidade do vídeo.
                </p>
              </div>
            </TabsContent>

            <div className="pt-4">
              <p className="text-xs text-gray-400">
                Nota: A animação continua em execução durante a gravação.
              </p>
            </div>
          </Tabs>

          <DialogFooter>
            <Button
              onClick={() => setOpen(false)}
              className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setOpen(false)
                startRecording()
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <VideoIcon className="mr-2 h-4 w-4" />
              Iniciar Gravação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isRecording && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Gravando Vídeo</h3>

            <div className="w-full bg-gray-800 rounded-full h-4 mb-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="text-white mb-6">
              Progresso: {Math.round(progress)}% ({Math.round(duration * progress / 100)} de {duration} segundos)
            </p>

            <Button
              onClick={stopRecording}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              <StopCircle className="mr-2 h-4 w-4" />
              Parar Gravação
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
