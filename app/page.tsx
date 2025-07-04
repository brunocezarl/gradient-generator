import { Suspense } from "react"
import ShareHandler from "@/components/share-handler"

export default function Home() {
  return (
    <main className="w-full h-screen p-0 m-0 overflow-hidden bg-black">
      <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div></div>}>
        <ShareHandler />
      </Suspense>
    </main>
  )
}
