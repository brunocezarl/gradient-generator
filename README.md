# Gradient Generator

Gerador de gradientes orgânicos animados em WebGL, pensado para sistemas de marca,
planos de fundo e conteúdo visual. A animação é gerada por um shader GLSL com
ruído simplex e curl noise, renderizado via React Three Fiber.

## Funcionalidades

- **Animação em tempo real** com controles de velocidade, complexidade, escala de
  ruído, fluxo, granulação e limiares de forma
- **Cor fiel**: as paradas de cor são interpoladas em Oklab (perceptual) ou em
  RGB linear, com codificação sRGB na saída — o HEX escolhido no picker é
  exatamente o pixel exportado. Dither triangular sub-quantização elimina o
  banding típico de gradientes suaves em 8 bits
- **Esquemas de cores** prontos (3 cores) + modo personalizado com color picker
  RGB/HSL/HEX e salvamento de esquemas próprios
- **Forma reproduzível**: o *seed* do campo de ruído entra em presets, histórico
  e links — "Sortear Forma" troca o desenho mantendo cores e ritmo
- **Multi-camadas** com modos de mesclagem (blend modes), opacidade e reordenação
  por arrastar e soltar; movimento e acabamento vêm do estado global, cada
  camada tem sua própria forma
- **Presets de animação** e gerador aleatório com **histórico dos últimos
  sorteios** (clique numa miniatura para restaurar um bom resultado)
- **Presets completos** salvos pelo usuário: cores + todos os parâmetros de
  animação, com galeria de miniaturas
- **Undo/Redo** (Ctrl+Z / Ctrl+Y) com coalescência de edições contínuas,
  cobrindo também criar, remover, editar e reordenar camadas
- **Exportação**: imagem (PNG/JPEG/WebP) com escala de até 8× ou dimensões
  prontas (Full HD, 4K, QHD, post quadrado, story), vídeo (WebM/MP4 conforme
  suporte do navegador, com resolução configurável) e CSS estático aproximado
- **Compartilhamento** por URL compacta que reproduz o gradiente completo —
  incluindo parâmetros avançados (fluxo, grão, limiares) e camadas
- **Atalhos de teclado**: `Espaço` play/pause, `R` reset, `S` salvar imagem,
  `F` tela cheia

## Stack

- [Next.js 15](https://nextjs.org) (App Router) + React 19 + TypeScript
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) / Three.js para o
  shader WebGL
- [Zustand](https://zustand.docs.pmnd.rs) (com persistência em `localStorage`)
- [Tailwind CSS](https://tailwindcss.com) + componentes
  [shadcn/ui](https://ui.shadcn.com) (Radix UI)
- [dnd-kit](https://dndkit.com) para reordenação de camadas

## Desenvolvimento

```bash
npm install
npm run dev        # servidor de desenvolvimento em http://localhost:3000
```

Outros scripts:

```bash
npm run build      # build de produção (inclui validação de tipos)
npm run start      # servir o build de produção
npm run lint       # lint
npm test           # testes unitários (Vitest)
```

## Estrutura

```
app/          # rotas e layout (App Router)
components/   # componentes da aplicação + components/ui (shadcn)
hooks/        # hooks (atalhos de teclado, fullscreen, otimizações de dispositivo)
lib/          # store Zustand, presets, cor, captura e compartilhamento
lib/shaders/  # fonte única do GLSL (usada pela cena simples e por cada camada)
```

## Notas de implementação

- **Pipeline de cor**: as cores saem do picker em sRGB, são convertidas para
  linear em `lib/color.ts`, interpoladas no espaço escolhido (Oklab ou linear)
  e reencodadas em sRGB no fim do fragment shader. Vibrância padrão 0 mantém o
  round-trip exato; o CSS exportado usa `in oklab` / `in srgb-linear` para
  interpolar no mesmo espaço do render.
- **Exportação**: cada camada é re-renderizada nativamente na resolução final e
  a câmera é reprojetada na proporção de saída, então exportar 1080×1920 a
  partir de uma janela 16:9 gera a mesma imagem que ver a cena numa janela
  9:16 — sem distorção nem upscaling.
- **Persistência**: o store é versionado (`PERSIST_VERSION`) e normalizado na
  hidratação. Como o zustand só chama `migrate` quando o JSON gravado tem
  `version` numérico, a normalização roda no `merge`, que sempre executa.
