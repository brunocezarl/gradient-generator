"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Share, Copy, Check, QrCode } from "lucide-react"
import { useGradientStore } from "@/lib/store"
import { playback } from "@/lib/playback"
import { createShareableURL } from "@/lib/share-utils"
import { useToast } from "@/components/ui/use-toast"
import { QRCodeSVG } from "qrcode.react"

export function ShareGradient() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("link")
  const [canWebShare, setCanWebShare] = useState(false)
  const gradientState = useGradientStore()
  const { toast } = useToast()

  // The Web Share API only exists in some browsers and not during SSR
  useEffect(() => {
    setCanWebShare(typeof navigator !== "undefined" && typeof navigator.share === "function")
  }, [])
  
  // Generate shareable URL
  const [shareTime, setShareTime] = useState(0)
  useEffect(() => { if (open) setShareTime(playback.time) }, [open])
  const shareableURL = createShareableURL(gradientState, shareTime)
  
  // Handle copy to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareableURL)
      setCopied(true)
      
      toast({
        title: "Link copied",
        description: "The link is on your clipboard.",
      })
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
      toast({
        title: "Could not copy",
        description: "Could not copy the link. Select it and copy manually.",
        variant: "destructive",
      })
    }
  }
  
  // Handle share via Web Share API if available
  const shareViaWebShare = async () => {
    if (canWebShare) {
      try {
        await navigator.share({
          title: "My organic gradient",
          text: "Check out this organic gradient I made",
          url: shareableURL,
        })
        
        toast({
          title: "Shared",
          description: "The gradient link was shared.",
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
        aria-label="Share"
        size="sm"
        className="h-11 w-11 px-0 sm:h-8 sm:w-auto sm:px-3 bg-neutral-900 text-white border border-neutral-700 hover:bg-neutral-800"
      >
        <Share className="h-4 w-4" />
        <span className="hidden sm:inline">Share</span>
      </Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-neutral-900 text-white border-neutral-700 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Gradient</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="link" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-neutral-800">
              <TabsTrigger value="link" className="text-white data-[state=active]:bg-neutral-700">
                Link
              </TabsTrigger>
              <TabsTrigger value="qrcode" className="text-white data-[state=active]:bg-neutral-700">
                QR Code
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="link" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="share-url" className="text-white">Share link</Label>
                <div className="flex space-x-2">
                  <Input
                    id="share-url"
                    value={shareableURL}
                    readOnly
                    className="bg-neutral-800 border-neutral-700 text-white flex-1"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    size="icon"
                    onClick={copyToClipboard}
                    aria-label="Copy link"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              {canWebShare && (
                <Button
                  onClick={shareViaWebShare}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Share className="mr-2 h-4 w-4" />
                  Share
                </Button>
              )}
            </TabsContent>
            
            <TabsContent value="qrcode" className="mt-4 space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-md">
                <QRCodeSVG value={shareableURL} size={200} />
              </div>
              <p className="text-sm text-neutral-400 text-center">
                Scan the QR code with your device camera to open this gradient.
              </p>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button
              onClick={() => setOpen(false)}
              className="bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
