import { sortStops, stopToHex, stopsToCss, type ColorStop } from "@/lib/color-stops"
import { srgbToOklch } from "@/lib/oklch"
import type { ColorBlendSpace } from "@/lib/color"

// Exporting the palette as tokens.
//
// The gradient is often the most visible piece of a brand system, and without a
// token output it stays trapped in the tool: the designer ships a PNG and the
// front-end team eyeballs the hex values. Here the same palette leaves in the
// format each destination consumes.

export type TokenFormat = "json" | "css" | "tailwind" | "svg"

export const tokenFormatLabels: Record<TokenFormat, string> = {
  json: "JSON (design tokens)",
  css: "CSS custom properties",
  tailwind: "Tailwind config",
  svg: "SVG (gradient)",
}

export const tokenFormatExtensions: Record<TokenFormat, string> = {
  json: "json",
  css: "css",
  tailwind: "js",
  svg: "svg",
}

export interface TokenOptions {
  stops: readonly ColorStop[]
  blendSpace: ColorBlendSpace
  /** Prefix for generated names (e.g. "gradient" → --gradient-1) */
  name?: string
}

function slug(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "gradient"
  )
}

/** Design tokens in the W3C Design Tokens Community Group format */
export function toJsonTokens({ stops, blendSpace, name = "gradient" }: TokenOptions): string {
  const base = slug(name)
  const sorted = sortStops(stops)

  const colors = Object.fromEntries(
    sorted.map((stop, index) => {
      const { l, c, h } = srgbToOklch(stop.color)
      return [
        `${base}-${index + 1}`,
        {
          $type: "color",
          $value: stopToHex(stop),
          $extensions: {
            position: Number(stop.position.toFixed(4)),
            oklch: {
              l: Number(l.toFixed(4)),
              c: Number(c.toFixed(4)),
              h: Number(h.toFixed(2)),
            },
          },
        },
      ]
    })
  )

  return JSON.stringify(
    {
      [base]: {
        ...colors,
        [`${base}-css`]: {
          $type: "gradient",
          $value: stopsToCss(stops, blendSpace),
        },
      },
    },
    null,
    2
  )
}

export function toCssTokens({ stops, blendSpace, name = "gradient" }: TokenOptions): string {
  const base = slug(name)
  const sorted = sortStops(stops)
  const lines = sorted.map(
    (stop, index) => `  --${base}-${index + 1}: ${stopToHex(stop)};`
  )
  const positions = sorted.map(
    (stop, index) => `  --${base}-${index + 1}-position: ${(stop.position * 100).toFixed(1)}%;`
  )

  return [
    ":root {",
    ...lines,
    ...positions,
    `  --${base}: ${stopsToCss(stops, blendSpace)};`,
    "}",
  ].join("\n")
}

export function toTailwindTokens({ stops, name = "gradient" }: TokenOptions): string {
  const base = slug(name)
  const sorted = sortStops(stops)
  const entries = sorted
    .map((stop, index) => `        "${base}-${index + 1}": "${stopToHex(stop)}",`)
    .join("\n")

  return [
    "// tailwind.config.js",
    "module.exports = {",
    "  theme: {",
    "    extend: {",
    "      colors: {",
    entries,
    "      },",
    "    },",
    "  },",
    "}",
  ].join("\n")
}

/**
 * SVG with the same stops. Serves as the static fallback for the animated
 * gradient in email, PDF and anywhere WebGL does not run.
 */
export function toSvgGradient({ stops, name = "gradient" }: TokenOptions): string {
  const base = slug(name)
  const sorted = sortStops(stops)
  const stopTags = sorted
    .map(
      (stop) =>
        `      <stop offset="${(stop.position * 100).toFixed(1)}%" stop-color="${stopToHex(stop)}" />`
    )
    .join("\n")

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">',
    "  <defs>",
    `    <linearGradient id="${base}" x1="0" y1="0" x2="1" y2="1">`,
    stopTags,
    "    </linearGradient>",
    "  </defs>",
    `  <rect width="1200" height="630" fill="url(#${base})" />`,
    "</svg>",
  ].join("\n")
}

export function generateTokens(format: TokenFormat, options: TokenOptions): string {
  switch (format) {
    case "json":
      return toJsonTokens(options)
    case "css":
      return toCssTokens(options)
    case "tailwind":
      return toTailwindTokens(options)
    case "svg":
      return toSvgGradient(options)
  }
}
