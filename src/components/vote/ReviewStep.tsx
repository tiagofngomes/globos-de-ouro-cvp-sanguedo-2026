import { motion } from 'framer-motion'
import { Lock, Pencil, Send } from 'lucide-react'
import type { CandidateOption, Category } from '../../api/types'
import { CategoryMedallion } from '../ui/CategoryIcon'
import { Spinner } from '../ui/Feedback'

export function ReviewStep({
  categories,
  choices,
  submitting,
  error,
  onEdit,
  onSubmit,
}: {
  categories: Category[]
  choices: Record<string, CandidateOption | null>
  submitting: boolean
  error: string | null
  onEdit: (index: number) => void
  onSubmit: () => void
}) {
  const complete = categories.every((c) => choices[c.id])
  return (
    <>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl pb-36 pt-6">
        <div className="text-center">
          <div className="eyebrow">Último passo</div>
          <h1 className="mt-2 font-display text-3xl text-gold-50 sm:text-4xl">
            Os seus <span className="text-gold-animated">nomeados</span>
          </h1>
          <p className="mt-3 text-sm text-gold-50/60">Confirme as suas escolhas. Depois de submeter, não será possível alterar.</p>
        </div>

        <ul className="mt-8 grid grid-cols-1 gap-3">
          {categories.map((c, i) => {
            const choice = choices[c.id]
            return (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06 * i }}
                className="card-gala flex min-w-0 items-center gap-4 p-4"
              >
                <CategoryMedallion icon={c.icon} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] uppercase tracking-[0.15em] text-gold-300/70">{c.name}</div>
                  <div className="truncate font-display text-lg text-gold-50">{choice?.name ?? <span className="text-cvp-400">Por escolher</span>}</div>
                </div>
                <button
                  onClick={() => onEdit(i)}
                  className="rounded-full p-2.5 text-gold-300/70 hover:bg-gold-400/10 hover:text-gold-200"
                  aria-label={`Alterar ${c.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </motion.li>
            )
          })}
        </ul>

        {error && (
          <p role="alert" className="mt-5 rounded-xl border border-cvp-500/40 bg-cvp-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        )}
      </motion.div>

      {/* fora do elemento animado: um "transform" no pai quebraria o position: fixed */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-gold-400/15 bg-gala-950/90 px-4 pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl">
          <button onClick={onSubmit} disabled={!complete || submitting} className="btn-gold w-full py-4 text-sm">
            {submitting ? (
              <>
                <Spinner className="h-5 w-5" /> A registar o seu voto…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Submeter votos
              </>
            )}
          </button>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-gold-100/40">
            <Lock className="h-3 w-3" /> Voto secreto · sem ligação ao seu número
          </p>
        </div>
      </div>
    </>
  )
}
