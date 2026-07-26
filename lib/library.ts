import type { ColorScheme, GradientPreset } from "@/lib/store"

// Biblioteca portátil: presets e esquemas de cor em um arquivo.
//
// Sem isso a biblioteca do usuário fica presa no localStorage de um navegador —
// não dá para levar para outra máquina, versionar junto do projeto nem entregar
// a paleta para o resto do time.

export const LIBRARY_FORMAT = "gradient-generator-library"
export const LIBRARY_VERSION = 1

export interface LibraryFile {
  format: typeof LIBRARY_FORMAT
  version: number
  exportedAt: string
  presets: GradientPreset[]
  colorSchemes: Record<string, ColorScheme>
}

export function serializeLibrary(
  presets: readonly GradientPreset[],
  colorSchemes: Record<string, ColorScheme>
): string {
  const file: LibraryFile = {
    format: LIBRARY_FORMAT,
    version: LIBRARY_VERSION,
    exportedAt: new Date().toISOString(),
    presets: [...presets],
    colorSchemes,
  }
  return JSON.stringify(file, null, 2)
}

export interface ParsedLibrary {
  presets: unknown[]
  colorSchemes: Record<string, unknown>
}

/**
 * Lê um arquivo de biblioteca validando apenas a estrutura. A normalização das
 * cores e dos snapshots é feita pelo store, que já tem as regras de migração —
 * um arquivo exportado por uma versão antiga entra pelo mesmo caminho de um
 * localStorage antigo.
 */
export function parseLibrary(json: string): ParsedLibrary {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error("Arquivo inválido: não é JSON")
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Arquivo inválido: conteúdo inesperado")
  }

  const file = parsed as Partial<LibraryFile>
  if (file.format !== LIBRARY_FORMAT) {
    throw new Error("Arquivo inválido: não é uma biblioteca do Gradient Generator")
  }
  if (typeof file.version !== "number" || file.version > LIBRARY_VERSION) {
    throw new Error(
      `Biblioteca gravada por uma versão mais nova (v${file.version}) — atualize o app`
    )
  }

  const presets = Array.isArray(file.presets)
    ? file.presets.filter(
        (preset) =>
          !!preset &&
          typeof preset === "object" &&
          typeof (preset as GradientPreset).name === "string" &&
          !!(preset as GradientPreset).snapshot
      )
    : []

  const colorSchemes =
    file.colorSchemes && typeof file.colorSchemes === "object"
      ? (file.colorSchemes as Record<string, unknown>)
      : {}

  if (presets.length === 0 && Object.keys(colorSchemes).length === 0) {
    throw new Error("Arquivo sem presets nem esquemas de cor")
  }

  return { presets, colorSchemes }
}
