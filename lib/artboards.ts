// Pranchetas: a proporção em que o gradiente é composto e exportado.
//
// Antes o preview era sempre a janela inteira e a proporção de saída só
// aparecia no diálogo de exportação — o designer descobria o enquadramento
// depois de baixar o arquivo. Com a prancheta, o que está na tela é o que sai.

export interface Artboard {
  id: string
  label: string
  // 0 × 0 = acompanha a área disponível (modo livre)
  width: number
  height: number
  group: string
}

export const artboards: Artboard[] = [
  { id: "free", label: "Livre (área disponível)", width: 0, height: 0, group: "Livre" },
  { id: "fullhd", label: "Full HD · 1920×1080", width: 1920, height: 1080, group: "Tela" },
  { id: "qhd", label: "QHD · 2560×1440", width: 2560, height: 1440, group: "Tela" },
  { id: "uhd4k", label: "4K · 3840×2160", width: 3840, height: 2160, group: "Tela" },
  { id: "square", label: "Post quadrado · 1080×1080", width: 1080, height: 1080, group: "Social" },
  { id: "portrait45", label: "Post 4:5 · 1080×1350", width: 1080, height: 1350, group: "Social" },
  { id: "story", label: "Story / Reels · 1080×1920", width: 1080, height: 1920, group: "Social" },
  { id: "og", label: "Open Graph · 1200×630", width: 1200, height: 630, group: "Social" },
  { id: "a4", label: "A4 300dpi · 2480×3508", width: 2480, height: 3508, group: "Impressão" },
]

export const defaultArtboardId = "free"

export function getArtboard(id: string): Artboard {
  return artboards.find((artboard) => artboard.id === id) ?? artboards[0]
}

export function isFreeArtboard(artboard: Artboard): boolean {
  return artboard.width <= 0 || artboard.height <= 0
}

export function artboardAspect(artboard: Artboard): number | null {
  return isFreeArtboard(artboard) ? null : artboard.width / artboard.height
}

// Safe area usada como guia de composição: margem proporcional ao menor lado,
// mais a faixa que a UI de stories costuma cobrir
export const SAFE_AREA_INSET = 0.06
