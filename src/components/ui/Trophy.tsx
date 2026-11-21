import { useId } from 'react'
import { cn } from '../../lib/cn'

/** Troféu "globo de ouro" desenhado em SVG, com brilho e cruz vermelha. */
export function Trophy({ className, glow = true }: { className?: string; glow?: boolean }) {
  const id = useId().replace(/:/g, '')
  return (
    <div className={cn('relative', className)}>
      {glow && (
        <div
          aria-hidden
          className="absolute inset-[-25%] animate-pulse-glow rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(236,201,90,.45), transparent)' }}
        />
      )}
      <svg viewBox="0 0 120 180" className="relative h-full w-full drop-shadow-[0_10px_30px_rgba(227,181,58,.45)]" role="img" aria-label="Troféu Globo de Ouro">
        <defs>
          <linearGradient id={`g1${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fdf8e8" />
            <stop offset=".35" stopColor="#ecc95a" />
            <stop offset=".7" stopColor="#b07f1f" />
            <stop offset="1" stopColor="#5f4314" />
          </linearGradient>
          <radialGradient id={`g2${id}`} cx=".35" cy=".3" r=".75">
            <stop offset="0" stopColor="#fffbea" />
            <stop offset=".3" stopColor="#f3dc8f" />
            <stop offset=".7" stopColor="#d4a12a" />
            <stop offset="1" stopColor="#6b4c16" />
          </radialGradient>
          <linearGradient id={`g3${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#5f4314" />
            <stop offset=".3" stopColor="#ecc95a" />
            <stop offset=".55" stopColor="#fdf8e8" />
            <stop offset=".8" stopColor="#d4a12a" />
            <stop offset="1" stopColor="#5f4314" />
          </linearGradient>
        </defs>

        {/* globo */}
        <circle cx="60" cy="50" r="38" fill={`url(#g2${id})`} />
        {/* meridianos e paralelos */}
        <g fill="none" stroke="#8a611b" strokeOpacity=".55" strokeWidth="1.1">
          <ellipse cx="60" cy="50" rx="38" ry="13" />
          <ellipse cx="60" cy="50" rx="15" ry="38" />
          <ellipse cx="60" cy="50" rx="29" ry="38" />
          <line x1="22" y1="50" x2="98" y2="50" />
        </g>
        <ellipse cx="47" cy="34" rx="11" ry="6" fill="#fffbea" opacity=".55" transform="rotate(-30 47 34)" />

        {/* figura estilizada a segurar o globo */}
        <path d="M52 86c2-4 14-4 16 0l-3 30h-10z" fill={`url(#g1${id})`} />
        <path d="M48 88c4 3 20 3 24 0" stroke="#fdf8e8" strokeOpacity=".5" strokeWidth="1.2" fill="none" />

        {/* pedestal */}
        <rect x="38" y="116" width="44" height="9" rx="2" fill={`url(#g3${id})`} />
        <path d="M33 125h54l5 22H28z" fill={`url(#g1${id})`} />
        <rect x="22" y="147" width="76" height="16" rx="3" fill={`url(#g3${id})`} />
        <rect x="22" y="147" width="76" height="2" fill="#fffbea" opacity=".5" />

        {/* placa CVP: cruz vermelha sempre sobre branco */}
        <rect x="49" y="130" width="22" height="14" rx="2" fill="#ffffff" stroke="#8a611b" strokeWidth=".6" />
        <path d="M58 132.5h4v3.5h3.5v4H62v3.5h-4V140h-3.5v-4H58z" fill="#e30613" />
      </svg>
    </div>
  )
}
