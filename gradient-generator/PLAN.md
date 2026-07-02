# Plano de Melhorias — Gradient Generator

## Melhorias selecionadas

### UX / UI
1. **Atalhos de teclado** — Space=play/pause, R=reset, F=fullscreen, S=salvar imagem
2. **Undo / Redo** — Ctrl+Z e Ctrl+Y para desfazer/refazer alterações nos controles
3. **Color picker aprimorado** — Input HEX, modo HSL e roda de cores
4. **Drag-and-drop de camadas** — Arrastar camadas para reordenar (nativo HTML5)

### Funcionalidades
5. **Exportar CSS** — Copiar gradiente estático como código CSS para clipboard
6. **Mais paradas de cor** — Suporte a 3 cores no shader e na UI
7. **Gerador aleatório** — Botão que randomiza cores e parâmetros de animação

---

## Plano de implementação

### Fase 1 — Gerador aleatório (mais simples, alto impacto)
- Adicionar função `randomizeAll()` no store Zustand
- Adicionar botão "🎲 Randomizar" no `controls-panel.tsx` (aba Básico)
- Randomiza: speed, complexity, noiseScale, flowIntensity, grainAmount, thresholdMin/Max, customColors
- Exibir toast de confirmação

### Fase 2 — Atalhos de teclado
- Adicionar hook `useKeyboardShortcuts` em `/hooks/use-keyboard-shortcuts.ts`
- Registrar no `gradient-generator.tsx`
- Space → play/pause
- R → reset to defaults
- F → fullscreen toggle
- S → capturar imagem
- Ctrl+Z → undo (integrado com Fase 3)
- Ctrl+Y / Ctrl+Shift+Z → redo
- Mostrar painel de ajuda com teclas (botão "?" no canto)

### Fase 3 — Undo / Redo
- Adicionar array `history` e `historyIndex` ao store Zustand
- Criar função `pushHistory(state)` que salva snapshot antes de cada alteração
- Funções `undo()` e `redo()` que restauram snapshots
- Limitar histórico a 50 estados
- Integrar com keyboard shortcuts da Fase 2

### Fase 4 — Color picker aprimorado
- Modificar `color-picker.tsx`:
  - Adicionar input HEX (validação com regex)
  - Adicionar tabs "RGB / HSL" para alternar modo
  - Adicionar sliders H (0-360), S (0-100%), L (0-100%)
  - Sincronizar RGB ↔ HSL ↔ HEX em tempo real
- Funções utilitárias rgb2hsl / hsl2rgb em `lib/utils.ts`

### Fase 5 — Exportar CSS
- Gerar string CSS a partir dos parâmetros atuais do gradiente:
  ```css
  background: linear-gradient(135deg, #color1 0%, #color2 100%);
  ```
- Com 3 cores (Fase 6): incluir stop intermediário
- Adicionar botão "Copiar CSS" no painel de exportação (`export-options.tsx`)
- Copiar para clipboard via `navigator.clipboard.writeText()`
- Exibir toast de confirmação

### Fase 6 — Mais paradas de cor (3 cores)
- Atualizar uniform `uColor3` no shader GLSL em `organic-gradient-shader.tsx`
- Modificar interpolação de cores: usar `mix(mix(c1, c2, t), c3, t*t)` ou dois `mix()` em sequência
- Atualizar store: adicionar `customColor3` e `colorSchemes` com 3 cores
- Adicionar terceiro `ColorPicker` na aba "Cores"
- Atualizar esquemas de cores existentes para incluir 3a cor

### Fase 7 — Drag-and-drop de camadas
- Instalar `@dnd-kit/core` e `@dnd-kit/sortable` (alternativa mais leve ao react-beautiful-dnd)
- Refatorar `layer-manager.tsx` com `<SortableContext>` e itens `<SortableItem>`
- Remover botões ▲▼ e substituir por handle de arraste
- Atualizar `reorderLayers()` no store
