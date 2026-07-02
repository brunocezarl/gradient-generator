# Gradient Generator

Gerador de gradientes orgânicos animados em WebGL, pensado para sistemas de marca,
planos de fundo e conteúdo visual. A animação é gerada por um shader GLSL com
ruído simplex e curl noise, renderizado via React Three Fiber.

## Funcionalidades

- **Animação em tempo real** com controles de velocidade, complexidade, escala de
  ruído, fluxo, granulação e limiares de forma
- **Esquemas de cores** prontos (3 cores) + modo personalizado com color picker
  RGB/HSL/HEX e salvamento de esquemas próprios
- **Multi-camadas** com modos de mesclagem (blend modes), opacidade e reordenação
  por arrastar e soltar
- **Presets de animação** e gerador aleatório
- **Undo/Redo** (Ctrl+Z / Ctrl+Y) com coalescência de edições contínuas
- **Exportação**: imagem (PNG/JPEG/WebP em até 4×), vídeo (WebM/MP4 conforme
  suporte do navegador, com resolução configurável) e CSS estático aproximado
- **Compartilhamento** por URL com os parâmetros do gradiente
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
lib/          # store Zustand, presets, utilitários de camadas e compartilhamento
```
