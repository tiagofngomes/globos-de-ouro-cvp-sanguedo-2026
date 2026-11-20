import { motion } from 'framer-motion'
import { AlertTriangle, Crown, Star } from 'lucide-react'
import { cn } from '../../lib/cn'
import { formatPct } from '../../lib/format'

export interface BarDatum {
  id: string
  label: string
  value: number
  /** destaque dourado (finalista / vencedor) */
  highlight?: 'finalist' | 'winner' | 'tied'
}

/**
 * Gráfico de barras horizontal, animado, com votos e percentagens.
 * Horizontal porque os nomes são longos e lê-se muito melhor no telemóvel.
 */
export function BarChart({ data, total, maxRows, cutoffAfter }: { data: BarDatum[]; total: number; maxRows?: number; cutoffAfter?: number }) {
  const rows = maxRows ? data.slice(0, maxRows) : data
  const max = Math.max(1, ...rows.map((d) => d.value))
  if (!rows.length) return <p className="py-6 text-center text-sm text-gold-100/40">Ainda sem votos.</p>

  return (
    <ol className="space-y-2.5">
      {rows.map((d, i) => {
        const share = total > 0 ? (d.value / total) * 100 : 0
        const width = (d.value / max) * 100
        const isWinner = d.highlight === 'winner'
        const isGold = isWinner || d.highlight === 'finalist'
        const isTied = d.highlight === 'tied'
        return (
          <li key={d.id}>
            {cutoffAfter !== undefined && i === cutoffAfter && (
              <div className="my-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-cvp-400">
                <span className="h-px flex-1 bg-cvp-500/40" /> linha de corte <span className="h-px flex-1 bg-cvp-500/40" />
              </div>
            )}
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className={cn('flex min-w-0 items-center gap-1.5', isGold ? 'text-gold-50' : isTied ? 'text-red-100' : 'text-gold-50/55')}>
                <span className="w-5 shrink-0 text-right font-display text-xs text-gold-400/60">{i + 1}</span>
                {isWinner && <Crown className="h-3.5 w-3.5 shrink-0 text-gold-300" />}
                {d.highlight === 'finalist' && <Star className="h-3 w-3 shrink-0 fill-gold-400 text-gold-400" />}
                {isTied && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-cvp-400" />}
                <span className="truncate">{d.label}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-gold-100/60">
                <strong className={cn('font-semibold', isGold ? 'text-gold-200' : 'text-gold-100/80')}>{d.value}</strong> · {formatPct(share)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/[.05]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.9, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'h-full rounded-full',
                  isWinner && 'bg-gradient-to-r from-gold-600 via-gold-300 to-gold-50 shadow-[0_0_14px_rgba(236,201,90,.9)]',
                  d.highlight === 'finalist' && 'bg-gradient-to-r from-gold-700 via-gold-500 to-gold-300',
                  isTied && 'bg-gradient-to-r from-cvp-700 to-cvp-400',
                  !d.highlight && 'bg-gradient-to-r from-white/15 to-white/30',
                )}
              />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Anel de participação (percentagem). */
export function RingStat({ value, label, sub }: { value: number; label: string; sub?: string }) {
  const r = 42
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-20 w-20 shrink-0 -rotate-90">
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fdf8e8" />
            <stop offset=".5" stopColor="#ecc95a" />
            <stop offset="1" stopColor="#b07f1f" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="9" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#ring)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (clamped / 100) * c }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div>
        <div className="font-display text-3xl text-gold-50">{formatPct(clamped)}</div>
        <div className="text-xs uppercase tracking-[0.2em] text-gold-300/70">{label}</div>
        {sub && <div className="mt-0.5 text-xs text-gold-100/45">{sub}</div>}
      </div>
    </div>
  )
}
