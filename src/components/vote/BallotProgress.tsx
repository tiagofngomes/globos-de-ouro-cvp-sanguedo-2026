import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import type { Category } from '../../api/types'
import { cn } from '../../lib/cn'
import { CategoryIcon } from '../ui/CategoryIcon'

/** Barra de progresso com um "marco" por categoria (toque para saltar). */
export function BallotProgress({
  categories,
  current,
  completed,
  onJump,
}: {
  categories: Category[]
  current: number
  completed: Set<string>
  onJump: (i: number) => void
}) {
  const done = completed.size
  const pctDone = (done / categories.length) * 100
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between text-xs">
        <span className="eyebrow">
          Categoria {Math.min(current + 1, categories.length)} de {categories.length}
        </span>
        <span className="text-gold-100/50">
          {done}/{categories.length} escolhidas
        </span>
      </div>
      <div className="relative">
        <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded bg-white/10" />
        <motion.div
          className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 rounded bg-gradient-to-r from-gold-600 via-gold-300 to-gold-100 shadow-[0_0_12px_rgba(236,201,90,.8)]"
          animate={{ width: `${pctDone}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        <div className="relative flex justify-between">
          {categories.map((c, i) => {
            const isDone = completed.has(c.id)
            const isCurrent = i === current
            return (
              <button
                key={c.id}
                onClick={() => onJump(i)}
                aria-label={`${c.name}${isDone ? ' (escolhida)' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'relative grid h-9 w-9 place-items-center rounded-full border transition duration-300 sm:h-11 sm:w-11',
                  isCurrent && 'scale-110 border-gold-200 bg-gold-400 text-gala-900 shadow-gold-lg',
                  !isCurrent && isDone && 'border-gold-400/70 bg-gala-800 text-gold-300',
                  !isCurrent && !isDone && 'border-white/15 bg-gala-900 text-gold-100/35',
                )}
              >
                {isDone && !isCurrent ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <CategoryIcon icon={c.icon} className="h-4 w-4 sm:h-5 sm:w-5" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
