import confetti from 'canvas-confetti'

const GOLD = ['#fdf8e8', '#f3dc8f', '#ecc95a', '#d4a12a', '#b07f1f']
const WITH_RED = [...GOLD, '#e30613', '#ffffff']

/** Chuva de confetis dourados (com toque vermelho CVP). */
export function celebrate(intensity: 'soft' | 'grand' = 'soft') {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const colors = intensity === 'grand' ? WITH_RED : GOLD
  const base = { colors, ticks: 260, gravity: 0.9, scalar: 1.05, disableForReducedMotion: true }
  confetti({ ...base, particleCount: intensity === 'grand' ? 160 : 90, spread: 80, startVelocity: 48, origin: { y: 0.65 } })
  const end = Date.now() + (intensity === 'grand' ? 2600 : 1200)
  const frame = () => {
    confetti({ ...base, particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } })
    confetti({ ...base, particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}
