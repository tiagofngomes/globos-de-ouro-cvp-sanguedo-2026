import { motion } from 'framer-motion'
import { Crown, Hourglass } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi, usePath } from '../api/ApiContext'
import type { PublicResults } from '../api/types'
import { Avatar } from '../components/vote/CandidateAutocomplete'
import { CategoryMedallion } from '../components/ui/CategoryIcon'
import { FullPageLoader } from '../components/ui/Feedback'
import { Trophy } from '../components/ui/Trophy'
import { celebrate } from '../lib/celebrate'
import { SectionTitle } from './HomePage'

/** Página pública dos vencedores — só disponível após autorização do administrador. */
export function ResultsPage() {
  const { api } = useApi()
  const path = usePath()
  const [data, setData] = useState<PublicResults | null>(null)

  useEffect(() => {
    api
      .getPublicResults()
      .then((r) => {
        setData(r)
        if (r.published) setTimeout(() => celebrate('grand'), 600)
      })
      .catch(() => setData({ published: false }))
  }, [api])

  if (!data) return <FullPageLoader label="A abrir os envelopes…" />

  if (!data.published) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <Hourglass className="mx-auto h-12 w-12 text-gold-400" />
        <h1 className="mt-6 font-display text-3xl text-gold-50">Ainda é segredo…</h1>
        <p className="mt-3 text-sm text-gold-50/60">Os resultados serão divulgados na gala. Até lá, os envelopes continuam selados.</p>
        <Link to={path('/')} className="btn-ghost mt-8">
          Voltar ao início
        </Link>
      </div>
    )
  }

  return (
    <div className="pb-10 pt-6">
      <div className="flex flex-col items-center">
        <Trophy className="h-36 w-24 animate-float" />
        <div className="mt-6">
          <SectionTitle eyebrow="Globos da Cruz CVP Sanguedo 2026" title="Os vencedores" />
        </div>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-2">
        {data.categories?.map((c, i) => {
          const winners = c.finalists.filter((f) => f.winner)
          const others = c.finalists.filter((f) => !f.winner)
          return (
            <motion.article
              key={c.category_id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: (i % 2) * 0.1 }}
              className="card-gala relative overflow-hidden p-6"
            >
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold-400/15 blur-3xl" />
              <div className="flex items-center gap-3">
                <CategoryMedallion icon={c.icon} size="sm" />
                <h2 className="font-display text-lg leading-tight text-gold-100">{c.name}</h2>
              </div>
              <div className="mt-5 space-y-3">
                {winners.map((w) => (
                  <div
                    key={w.candidate_id}
                    className="flex items-center gap-4 rounded-2xl border border-gold-300/50 bg-gradient-to-r from-gold-400/20 to-transparent p-4 shadow-gold"
                  >
                    <Avatar name={w.name} large />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-300">
                        <Crown className="h-3.5 w-3.5" /> {winners.length > 1 ? 'Vencedor ex aequo' : 'Vencedor'}
                      </div>
                      <div className="text-gold mt-1 font-display text-2xl leading-tight">{w.name}</div>
                    </div>
                  </div>
                ))}
              </div>
              {others.length > 0 && (
                <div className="mt-4">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-gold-100/40">Finalistas</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {others.map((f) => (
                      <span key={f.candidate_id} className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1 text-xs text-gold-50/70">
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.article>
          )
        })}
      </div>
    </div>
  )
}
