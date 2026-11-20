import { AnimatePresence, motion } from 'framer-motion'
import { useCountdown } from '../../hooks/useCountdown'
import { cn } from '../../lib/cn'

interface Props {
  target: string | null | undefined
  offset?: number
  onDone?: () => void
  size?: 'md' | 'lg'
  className?: string
}

/** Contagem decrescente em "placas" douradas, com dígitos animados. */
export function Countdown({ target, offset = 0, onDone, size = 'lg', className }: Props) {
  const c = useCountdown(target, offset, onDone)
  const units = [
    { label: c.days === 1 ? 'dia' : 'dias', value: c.days },
    { label: 'horas', value: c.hours },
    { label: 'min', value: c.minutes },
    { label: 'seg', value: c.seconds },
  ]
  return (
    <div className={cn('flex items-stretch justify-center gap-1.5 sm:gap-4', className)} role="timer" aria-live="off">
      {units.map((u, i) => (
        <div key={u.label} className="flex items-stretch gap-1.5 sm:gap-4">
          <div
            className={cn('card-gala flex flex-col items-center justify-center rounded-2xl', size === 'lg' ? 'w-[3.9rem] py-3 sm:w-24 sm:py-4' : 'w-14 py-2')}
          >
            <div
              className={cn(
                'relative overflow-hidden font-display font-bold tabular-nums',
                size === 'lg' ? 'h-9 text-3xl sm:h-12 sm:text-5xl' : 'h-7 text-2xl',
              )}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={u.value}
                  initial={{ y: '-100%', opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: '100%', opacity: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="text-gold block leading-none"
                >
                  {String(u.value).padStart(2, '0')}
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.25em] text-gold-200/60 sm:text-[10px]">{u.label}</div>
          </div>
          {i < units.length - 1 && <div className="self-center font-display text-lg text-gold-400/40 sm:text-3xl">:</div>}
        </div>
      ))}
    </div>
  )
}
