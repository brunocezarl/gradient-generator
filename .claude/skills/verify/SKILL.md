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

Fluxos que valem dirigir:

- **Canvas monta**: `page.locator("canvas").count()` ≥ 1 após ~2s.
- **Estado do store**: leia `JSON.parse(localStorage.getItem("gradient-store")).state`
  para asserções (speed, flowIntensity, randomHistory, savedPresets…).
- **Exportar imagem**: botão "Exportar Imagem" → dialog → `waitForEvent("download")`;
  dimensões do PNG baixado: `buf.readUInt32BE(16)` × `buf.readUInt32BE(20)`.
- **Compartilhar**: botão "Compartilhar Gradiente" → input `#share-url`; abra a
  URL em um `browser.newContext()` limpo e compare o estado importado.
- **UI em português**: seletores por texto usam os rótulos PT-BR
  ("Randomizar", "Restaurar Padrões", aba "Presets").

Um 404 no console ao carregar é o favicon ausente — pré-existente, ignorar.
