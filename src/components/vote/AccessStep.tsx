import { motion } from 'framer-motion'
import { ArrowRight, KeyRound, ShieldCheck, Ticket } from 'lucide-react'
import { useState } from 'react'
import { useApi } from '../../api/ApiContext'
import type { SessionError, VotingSession } from '../../api/types'
import { DEMO_HINT } from '../../demo/demoApi'
import { cn } from '../../lib/cn'
import { CvpCross } from '../ui/CvpBrand'
import { Spinner } from '../ui/Feedback'

const MESSAGES: Record<SessionError, string> = {
  not_authorized: 'Este número de membro não consta da lista de votantes. Confirme o número ou contacte a organização.',
  already_voted: 'Este número de membro já votou nesta fase. Obrigado pela participação!',
  voting_closed: 'A votação não está aberta neste momento.',
  too_many_attempts: 'Demasiadas tentativas. Por segurança, aguarde 15 minutos antes de tentar novamente.',
  pin_required: 'Introduza também o seu PIN de votação.',
  invalid_pin: 'PIN incorreto.',
  network: 'Sem ligação ao servidor. Verifique a internet e tente novamente.',
}

interface Props {
  phase: 'phase1' | 'phase2'
  notice?: string | null
  onSession: (s: Extract<VotingSession, { ok: true }>) => void
  onAlreadyVoted: () => void
}

/** "Convite" de entrada: o número de membro funciona como bilhete. */
export function AccessStep({ phase, notice, onSession, onAlreadyVoted }: Props) {
  const { api, isDemo } = useApi()
  const [number, setNumber] = useState('')
  const [pin, setPin] = useState('')
  const [needPin, setNeedPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(notice ?? null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!number.trim() || loading) return
    setLoading(true)
    setError(null)
    const res = await api.startSession(number, needPin ? pin : undefined)
    setLoading(false)
    if (res.ok) return onSession(res)
    if (res.error === 'already_voted') return onAlreadyVoted()
    if (res.error === 'pin_required') setNeedPin(true)
    setError(MESSAGES[res.error] ?? 'Ocorreu um erro.')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto mt-6 max-w-md sm:mt-12"
    >
      <div className="text-center">
        <div className="eyebrow">{phase === 'phase1' ? 'Fase 1 · Nomeações' : 'Fase 2 · Grande Final'}</div>
        <h1 className="mt-3 font-display text-3xl text-gold-50 sm:text-4xl">
          O seu <span className="text-gold-animated">convite</span>
        </h1>
        <p className="mt-3 text-sm text-gold-50/60">Introduza o seu número de membro da CVP para entrar na votação.</p>
      </div>

      {/* bilhete */}
      <form onSubmit={submit} className="card-gala relative mt-8 overflow-hidden">
        <div className="flex items-center justify-between border-b border-dashed border-gold-400/25 bg-gradient-to-r from-cvp-600/30 via-transparent to-cvp-600/30 px-6 py-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-200">
            <Ticket className="h-4 w-4" /> Admissão · 1 voto
          </div>
          <CvpCross className="h-4 w-4" />
        </div>
        {/* recortes laterais do bilhete */}
        <span className="absolute left-[-12px] top-[37px] h-6 w-6 rounded-full bg-gala-950" />
        <span className="absolute right-[-12px] top-[37px] h-6 w-6 rounded-full bg-gala-950" />

        <div className="p-6">
          <label htmlFor="member" className="label-gala">
            Número de membro
          </label>
          <input
            id="member"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="ex.: 12345"
            maxLength={32}
            className="input-gala text-center font-display text-2xl tracking-[0.3em]"
          />

          {needPin && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4">
              <label htmlFor="pin" className="label-gala flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5" /> PIN de votação
              </label>
              <input
                id="pin"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="input-gala text-center tracking-[0.4em]"
              />
            </motion.div>
          )}

          {error && (
            <motion.p
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }}
              className="mt-4 rounded-xl border border-cvp-500/40 bg-cvp-500/10 px-4 py-3 text-sm text-red-100"
              role="alert"
            >
              {error}
            </motion.p>
          )}

          <button type="submit" disabled={!number.trim() || loading} className={cn('btn-gold mt-6 w-full py-4')}>
            {loading ? (
              <Spinner className="h-5 w-5" />
            ) : (
              <>
                Entrar na votação <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          {isDemo && <p className="mt-4 text-center text-xs text-gold-300/70">{DEMO_HINT}</p>}
        </div>
      </form>

      <p className="mt-6 flex items-start justify-center gap-2 px-4 text-center text-xs leading-relaxed text-gold-100/45">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-400/60" />O número serve apenas para confirmar que pode votar e que só vota uma vez. As suas
        escolhas são guardadas sem qualquer ligação ao seu número.
      </p>
    </motion.div>
  )
}
