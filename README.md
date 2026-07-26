# Gradient Generator

Gerador de gradientes orgânicos animados em WebGL, pensado para sistemas de marca,
planos de fundo e conteúdo visual. A animação é gerada por um shader GLSL com
ruído simplex e curl noise, renderizado via React Three Fiber.

## Funcionalidades

- **Prancheta com a proporção de saída** (Full HD, 4K, story, post 4:5, Open
  Graph, A4…) com guias de safe area: o preview mostra o enquadramento real e a
  exportação herda essas dimensões
- **Timeline** com scrub, avanço quadro a quadro e congelamento de frame — o
  instante da animação é um valor visível e reprodutível
- **Loop perfeito**: com um período definido, a animação percorre um caminho
  fechado no campo de ruído e volta exatamente ao início
- **Animação em tempo real** com controles de velocidade, complexidade, escala de
  ruído, fluxo, granulação e limiares de forma
- **Cor fiel**: as paradas de cor são interpoladas em Oklab (perceptual) ou em
  RGB linear, com codificação sRGB na saída — o HEX escolhido no picker é
  exatamente o pixel exportado. Dither triangular sub-quantização elimina o
  banding típico de gradientes suaves em 8 bits
- **De 2 a 8 paradas de cor**, cada uma com posição própria ao longo do
  gradiente
- **Color picker em OKLCH**, RGB, HSL ou HEX: mexer em luminosidade ou croma em
  OKLCH não desloca o matiz (clarear um vermelho em HSL puxa para rosa), e o
  slider de croma respeita o teto real do sRGB para aquela cor
- **Harmonias** (análoga, complementar, complementar dividida, tríade,
  monocromática) derivadas da primeira parada, mantendo as posições
- **Paleta extraída de uma imagem** de referência, por clusterização em Oklab
- **Contraste WCAG** do texto branco e preto no pior caso ao longo do gradiente
- **Esquemas de cores** prontos + modo personalizado com salvamento de esquemas
  próprios
- **Forma reproduzível**: o *seed* do campo de ruído entra em presets, histórico
  e links — "Sortear Forma" troca o desenho mantendo cores e ritmo
- **Multi-camadas** em um único contexto WebGL: cada camada é renderizada em um
  render target e a mesclagem acontece no shader (mesmas fórmulas do
  Compositing and Blending Level 1), com reordenação por arrastar e soltar.
  Movimento e acabamento vêm do estado global; cada camada tem sua própria forma
- **Presets de animação** e gerador aleatório com **histórico dos últimos
  sorteios** (clique numa miniatura para restaurar um bom resultado)
- **Presets completos** salvos pelo usuário: cores + todos os parâmetros de
  animação, com galeria de miniaturas **renderizadas pelo shader** (duas
  configurações com as mesmas cores e formas diferentes aparecem diferentes) e
  **biblioteca portátil** em JSON (exportar/importar)
- **Undo/Redo** (Ctrl+Z / Ctrl+Y) com coalescência de edições contínuas,
  cobrindo também criar, remover, editar e reordenar camadas
- **Exportação**: imagem (PNG/JPEG/WebP) na prancheta atual, em dimensões
  prontas ou com escala de até 8×; vídeo determinístico (MP4/H.264 ou WebM/VP9)
  renderizado quadro a quadro com timestamps explícitos — taxa de quadros e
  duração exatas, independentes do desempenho da GPU — e **tokens da paleta**
  (JSON de design tokens com OKLCH, CSS custom properties, config Tailwind e SVG)
- **Compartilhamento** por URL compacta que reproduz o gradiente completo —
  incluindo parâmetros avançados (fluxo, grão, limiares) e camadas
- **Atalhos de teclado**: `Espaço` play/pause, `R` reset, `S` salvar imagem,
  `F` tela cheia (preview limpo)

## Stack

- [Next.js 15](https://nextjs.org) (App Router) + React 19 + TypeScript
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) / Three.js para o
  shader WebGL
- [Zustand](https://zustand.docs.pmnd.rs) (com persistência em `localStorage`)
- [Tailwind CSS](https://tailwindcss.com) + componentes
  [shadcn/ui](https://ui.shadcn.com) (Radix UI)
- [dnd-kit](https://dndkit.com) para reordenação de camadas
- [mediabunny](https://mediabunny.dev) + WebCodecs para a exportação de vídeo

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
              # (color-stops, oklch, palette-extract, tokens, library)
lib/shaders/  # fonte única do GLSL (gradiente + composição de camadas)
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
- **Tempo**: o relógio da animação vive em `lib/playback.ts`, fora do React e
  fora do render loop — antes cada canvas acumulava o próprio tempo, o que fazia
  a velocidade em multi-camadas depender do número de camadas visíveis. A
  exportação dirige esse relógio: cada quadro é desenhado num instante exato.
- **Loop**: com `loopDuration > 0` o shader troca a deriva linear por um caminho
  circular no campo de ruído (`theta = 2π·t/T`), periódico por construção. O
  quadro que fecharia o ciclo é idêntico ao primeiro e por isso não é gravado —
  evita um quadro duplicado na emenda.
- **Paradas de cor**: o shader recebe arrays de até 8 paradas (cores em linear +
  posições). A ordenação acontece na escrita dos uniforms, não no estado:
  reordenar a lista no meio de um arraste faria o slider pular de parada na mão
  do usuário, enquanto o shader precisa das posições crescentes.
- **OKLCH**: `lib/oklch.ts` faz as conversões, o clamp de gamut por busca binária
  no croma (preservando matiz e luminosidade), as harmonias e o contraste WCAG.
  O randomizador sorteia nesses eixos — sortear R, G e B independentemente
  produz quase sempre cores dessaturadas e sem relação entre si.
