---
name: verify
description: Build, launch and drive the gradient generator end-to-end in headless Chromium (WebGL via SwiftShader) to verify changes at the real UI.
---

# Verificando o Gradient Generator

## Build e servidor

```bash
npm ci                 # se node_modules não existe
npm run build          # inclui checagem de tipos
nohup npm run start > /tmp/server.log 2>&1 &   # serve em http://localhost:3000
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/   # espera 200
```

Gotcha: `next start` antigo segura a porta 3000 e serve HTML com referências a
chunks obsoletos (páginas 400/404, canvas não monta). Antes de re-testar após
um rebuild: `pkill -f next-server` e confirme que só há um processo.

## Drive (Playwright + WebGL headless)

O Chromium pré-instalado renderiza o shader WebGL com SwiftShader:

```js
import { chromium } from "playwright-core" // npm install playwright-core no scratchpad
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--no-sandbox"],
})
```

### Estado determinístico

`reducedMotion: "reduce"` no contexto faz o app iniciar pausado com o relógio da
animação em exatamente 0 — dois renders da mesma configuração ficam comparáveis
pixel a pixel. Para fixar a configuração, injete o store antes do load:

```js
await page.addInitScript((value) => {
  window.localStorage.setItem("gradient-store", value)
}, JSON.stringify({ state: { /* ... */ }, version: 1 }))
```

Omitir `version` reproduz o localStorage das versões antigas: o zustand não
chama `migrate` nesse caso, e a normalização acontece no `merge` do persist.

### Fluxos que valem dirigir

- **Canvas monta**: `page.locator("canvas").count()` ≥ 1 após ~2s. Em
  multi-camadas o resultado é **1** canvas (a composição usa render targets, não
  um contexto WebGL por camada).
- **Estado do store**: leia `JSON.parse(localStorage.getItem("gradient-store")).state`
  para asserções (speed, flowIntensity, randomHistory, savedPresets…).
- **Prancheta**: o `<canvas>` assume a proporção da prancheta escolhida —
  `boundingBox()` confirma. Exportar sem tocar em "Dimensões" herda as medidas
  da prancheta.
- **Exportar imagem**: botão com aria-label "Exportar Imagem" (texto visível
  "Imagem") → dialog → botão "Exportar" → `waitForEvent("download")`; dimensões
  do PNG baixado: `buf.readUInt32BE(16)` × `buf.readUInt32BE(20)`.
- **Timeline**: o thumb tem nome acessível —
  `page.getByRole("slider", { name: "Instante da animação" })` aceita foco e
  setas (`Home`/`End` vão aos extremos). Play/pause: botões com aria-label
  "Reproduzir animação" / "Pausar animação" (use `exact: true`, o painel tem
  rótulos parecidos).
- **Loop perfeito**: com `loopDuration > 0`, o frame em `t=0` (`Home`) é
  idêntico ao frame em `t=T` (`End`).
- **Exportar vídeo**: WebCodecs existe no Chromium headless, mas só com **VP9**
  (não há encoder de software para AVC/H.264 aqui) — o app detecta em runtime e
  oferece apenas WebM. Duração e dimensões do arquivo se medem carregando o blob
  em um `<video>` na própria página; comparar o frame de `t=0` com o de um ciclo
  depois verifica a emenda do loop.
- **Compartilhar**: botão "Compartilhar" → input `#share-url`; abra a URL em um
  `browser.newContext()` limpo e compare o estado importado.
- **UI em português**: seletores por texto usam os rótulos PT-BR
  ("Randomizar", "Restaurar Padrões", aba "Presets").

Um 404 no console ao carregar é o favicon ausente — pré-existente, ignorar.
