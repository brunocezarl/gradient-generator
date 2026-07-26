import type React from "react"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/toaster"

export const metadata = {
  title: "Organic Gradient Generator",
  description:
    "Build animated organic gradients for brand systems. Export as image, video, design tokens or CSS.",
  openGraph: {
    title: "Organic Gradient Generator",
    description:
      "WebGL animated gradients with faithful color, seamless loops and export to image, video and design tokens.",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
