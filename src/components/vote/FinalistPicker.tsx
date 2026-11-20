import { motion } from 'framer-motion'
import { Check, Star } from 'lucide-react'
import type { CandidateOption } from '../../api/types'
import { cn } from '../../lib/cn'
import { Avatar } from './CandidateAutocomplete'

/** Grande Final: os finalistas em cartões elegantes; toque para escolher. */
export function FinalistPicker({
  finalists,
  value,
  onChange,
}: {
  finalists: CandidateOption[]
  value: CandidateOption | null
  onChange: (c: CandidateOption) => void
}) {
  return (
    <div>
      <div className="label-gala">Escolha o vencedor entre os {finalists.length} finalistas</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {finalists.map((f, i) => {
          const selected = value?.id === f.id
          return (
            <motion.button
              key={f.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onChange(f)}
              aria-pressed={selected}
              className={cn(
                'relative flex items-center gap-4 overflow-hidden rounded-2xl border p-4 text-left transition duration-300',
                selected
                  ? 'border-gold-300 bg-gradient-to-r from-gold-400/25 via-gold-400/10 to-transparent shadow-gold-lg'
                  : 'border-gold-400/15 bg-white/[.03] hover:border-gold-400/40',
              )}
            >
              {selected && (
                <motion.span
                  layoutId="finalist-glow"
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{ background: 'radial-gradient(circle at 15% 50%, rgba(236,201,90,.25), transparent 60%)' }}
                />
              )}
              <Avatar name={f.name} />
              <div className="relative min-w-0 flex-1">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-gold-400/70">
                  <Star className="h-3 w-3 fill-current" /> Finalista
                </div>
                <div className={cn('truncate font-display text-lg', selected ? 'text-gold-50' : 'text-gold-50/85')}>{f.name}</div>
              </div>
              <span
                className={cn(
                  'relative grid h-7 w-7 shrink-0 place-items-center rounded-full border transition',
                  selected ? 'border-gold-200 bg-gold-300 text-gala-900' : 'border-gold-400/30',
                )}
              >
                {selected && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
