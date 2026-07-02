import { Suspense } from "react";
import { EditorShell } from "@/components/editor-shell";

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4">
          <p className="text-zinc-400">Loading editor…</p>
        </main>
      }
    >
      <EditorShell />
    </Suspense>
  );
}
