"use client"

// Relógio único da animação.
//
// Antes cada componente de shader acumulava o próprio tempo dentro do render
// loop: no modo multi-camadas isso significava N relógios independentes, e não
// havia como saber — nem escolher — em que instante da animação a imagem
// exportada estava. Com um relógio só, o tempo passa a ser um valor que a
// timeline mostra, o usuário arrasta e o export percorre em passos exatos.
//
// Fica fora do estado do React de propósito: a 60 fps, tempo em estado
// re-renderizaria a árvore inteira a cada frame.

type Listener = () => void

const listeners = new Set<Listener>()
let currentTime = 0

function notify() {
  for (const listener of listeners) listener()
}

export const playback = {
  get time(): number {
    return currentTime
  },

  // Avanço vindo do driver de animação. Não notifica: quem está animando já
  // está desenhando a cada frame.
  advance(delta: number, loopDuration = 0) {
    let next = currentTime + delta
    if (loopDuration > 0) {
      next = ((next % loopDuration) + loopDuration) % loopDuration
    }
    currentTime = Math.max(0, next)
  },

  // Mudança externa (arrastar a timeline, resetar, exportar um frame
  // específico): notifica para o canvas redesenhar mesmo pausado
  set(time: number, loopDuration = 0) {
    let next = Math.max(0, time)
    if (loopDuration > 0) {
      next = ((next % loopDuration) + loopDuration) % loopDuration
    }
    currentTime = next
    notify()
  },

  reset() {
    currentTime = 0
    notify()
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
