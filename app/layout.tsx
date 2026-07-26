import type React from "react"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/toaster"

export const metadata = {
  title: "Gerador de Gradientes Orgânicos",
  description:
    "Crie gradientes animados em HD com formas orgânicas para sistemas de marca. Exporte como imagem, vídeo, tokens ou CSS.",
  openGraph: {
    title: "Gerador de Gradientes Orgânicos",
    description:
      "Gradientes animados em WebGL com cor fiel, loop perfeito e exportação em imagem, vídeo e tokens.",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
