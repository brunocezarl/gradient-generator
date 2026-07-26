import type { ColorScheme, GradientPreset } from "@/lib/store"

// Portable library: presets and color schemes in a single file.
//
// Without it the user's library is stuck in one browser's localStorage — there
// is no way to move it to another machine, version it alongside the project, or
// hand the palette to the rest of the team.

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
 * Reads a library file, validating structure only. Normalizing colors and
 * snapshots is the store's job, since it already owns the migration rules — a
 * file exported by an older version comes in through the same path as an old
 * localStorage entry.
 */
export function parseLibrary(json: string): ParsedLibrary {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error("Invalid file: not JSON")
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid file: unexpected content")
  }

  const file = parsed as Partial<LibraryFile>
  if (file.format !== LIBRARY_FORMAT) {
    throw new Error("Invalid file: not a Gradient Generator library")
  }
  if (typeof file.version !== "number" || file.version > LIBRARY_VERSION) {
    throw new Error(
      `Library written by a newer version (v${file.version}) — update the app`
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
    throw new Error("File has no presets and no color schemes")
  }

  return { presets, colorSchemes }
}
