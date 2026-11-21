import { useMemo } from 'react'

/**
 * Fundo de gala: holofotes a varrer o palco, brilhos dourados a subir,
 * estrelas cintilantes e um leve vinheta. Puramente decorativo e leve (CSS).
 */
export function GalaBackground({ intensity = 1 }: { intensity?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: (i * 37) % 100,
        size: 2 + ((i * 7) % 4),
        delay: (i * 1.3) % 14,
        duration: 12 + ((i * 5) % 10),
      })),
    [],
  )
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: (i * 53) % 100,
        top: (i * 29) % 70,
        delay: (i * 0.37) % 3,
      })),
    [],
  )

  return (
    <div aria-hidden data-gala-bg className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gala-950">
      {/* brilho central do palco */}
      <div
        className="absolute left-1/2 top-[-20%] h-[90vh] w-[140vw] -translate-x-1/2 rounded-[50%] opacity-70"
        style={{ background: 'radial-gradient(closest-side, rgba(227,181,58,.22), rgba(227,181,58,.06) 55%, transparent)' }}
      />
      {/* reflexo vermelho no chão */}
      <div
        className="absolute bottom-[-30%] left-1/2 h-[60vh] w-[120vw] -translate-x-1/2 rounded-[50%]"
        style={{ background: 'radial-gradient(closest-side, rgba(227,6,19,.14), transparent)', opacity: intensity }}
      />

      {/* holofotes */}
      <div className="absolute -top-24 left-[12%] h-[130vh] w-[38vw] origin-top animate-sweep opacity-[.18]" style={beam} />
      <div className="absolute -top-24 right-[12%] h-[130vh] w-[38vw] origin-top animate-sweep-slow opacity-[.14] [animation-direction:reverse]" style={beam} />

      {/* estrelas */}
      {stars.map((s, i) => (
        <span
          key={`s${i}`}
          className="absolute h-[2px] w-[2px] animate-twinkle rounded-full bg-gold-100"
          style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s` }}
        />
      ))}

      {/* partículas douradas */}
      {particles.map((p, i) => (
        <span
          key={`p${i}`}
          className="absolute bottom-[-10px] animate-rise rounded-full"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            background: 'radial-gradient(circle, #fdf8e8, #e3b53a 60%, transparent)',
            boxShadow: '0 0 8px rgba(236,201,90,.8)',
          }}
        />
      ))}

      {/* vinheta */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,.75))' }} />
    </div>
  )
}

const beam: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(253,248,232,.9), rgba(236,201,90,.25) 40%, transparent 85%)',
  clipPath: 'polygon(46% 0, 54% 0, 100% 100%, 0 100%)',
  filter: 'blur(18px)',
}
