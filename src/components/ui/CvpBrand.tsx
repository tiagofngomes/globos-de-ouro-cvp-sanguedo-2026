import { useState } from 'react'
import { cn } from '../../lib/cn'

/**
 * Identidade CVP. Se existir o logótipo oficial em `public/brand/cvp-logo.png`
 * (ou .svg), é usado automaticamente; caso contrário mostra o emblema da cruz
 * vermelha desenhado em SVG.
 */
export function CvpCross({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('shrink-0', className)} aria-hidden>
      <rect x="11" y="2" width="10" height="28" fill="#e30613" />
      <rect x="2" y="11" width="28" height="10" fill="#e30613" />
    </svg>
  )
}

/**
 * Regra da identidade CVP: a cruz vermelha aparece sozinha ou sobre fundo
 * BRANCO — nunca sobre fundo escuro ou de outra cor. Usar este emblema sempre
 * que a cruz precise de um fundo.
 */
export function CvpBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-grid shrink-0 place-items-center rounded-[22%] bg-white', className)}>
      <CvpCross className="h-[72%] w-[72%]" />
    </span>
  )
}

export function CvpLogoMark({ className }: { className?: string }) {
  const [src, setSrc] = useState<string | null>('./brand/cvp-logo.svg')
  if (src) {
    return (
      <img
        src={src}
        alt="Cruz Vermelha Portuguesa"
        className={cn('object-contain', className)}
        onError={() => setSrc(src.endsWith('.svg') ? './brand/cvp-logo.png' : null)}
      />
    )
  }
  return (
    <span className={cn('grid place-items-center rounded-full bg-white shadow-red-glow', className)}>
      <CvpCross className="h-[62%] w-[62%]" />
    </span>
  )
}

export function CvpBrand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <CvpLogoMark className={compact ? 'h-8 w-8' : 'h-10 w-10'} />
      <div className="leading-tight">
        <div className={cn('font-semibold uppercase tracking-[0.2em] text-white', compact ? 'text-[9px]' : 'text-[10px]')}>Cruz Vermelha Portuguesa</div>
        <div className={cn('font-display text-gold-200', compact ? 'text-[11px]' : 'text-xs')}>Delegação de Sanguedo</div>
      </div>
    </div>
  )
}

/** Faixa vermelha decorativa com cruz, usada em cabeçalhos de secção. */
export function CvpRibbon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-cvp-500/40 bg-cvp-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-cvp-400',
        className,
      )}
    >
      <CvpBadge className="h-3.5 w-3.5" />
      {children}
    </span>
  )
}
