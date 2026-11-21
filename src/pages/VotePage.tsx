import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, Hourglass } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi, usePath } from '../api/ApiContext'
import type { CandidateOption, Category, SubmitError, VotingSession } from '../api/types'
import { AccessStep } from '../components/vote/AccessStep'
import { BallotProgress } from '../components/vote/BallotProgress'
import { CandidateAutocomplete } from '../components/vote/CandidateAutocomplete'
import { FinalistPicker } from '../components/vote/FinalistPicker'
import { ReviewStep } from '../components/vote/ReviewStep'
import { CategoryMedallion } from '../components/ui/CategoryIcon'
import { FullPageLoader } from '../components/ui/Feedback'
import { Trophy } from '../components/ui/Trophy'
import { usePublicState } from '../hooks/usePublicState'
import { celebrate } from '../lib/celebrate'
import { cn } from '../lib/cn'
import { formatDateTime } from '../lib/format'
import { isVotingPhase, PHASE_LABELS } from '../lib/phases'
import { ConnectionError } from './HomePage'

type Session = Extract<VotingSession, { ok: true }>
type Step = 'access' | 'ballot' | 'review' | 'done' | 'already'

const SUBMIT_ERRORS: Record<SubmitError, string> = {
  session_expired: 'A sua sessão expirou por inatividade. Introduza novamente o número de membro. As suas escolhas foram guardadas.',
  voting_closed: 'A votação encerrou entretanto. Infelizmente o voto já não pôde ser registado.',
  invalid_ballot: 'Há uma escolha inválida. Reveja as categorias e tente novamente.',
  already_voted: 'Este número de membro já votou nesta fase.',
  network: 'Não foi possível contactar o servidor. Verifique a internet e tente novamente. O voto ainda não foi registado.',
}

export function VotePage() {
  const { state, error, refresh } = usePublicState(60_000)
  const { api } = useApi()

  const [step, setStep] = useState<Step>('access')
  const [session, setSession] = useState<Session | null>(null)
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [choices, setChoices] = useState<Record<string, CandidateOption | null>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [accessNotice, setAccessNotice] = useState<string | null>(null)

  const categories = state?.categories ?? []
  const completed = useMemo(
    () =>
      new Set(
        Object.entries(choices)
          .filter(([, v]) => v)
          .map(([k]) => k),
      ),
    [choices],
  )

  // aviso ao sair a meio da votação
  useEffect(() => {
    if ((step !== 'ballot' && step !== 'review') || completed.size === 0) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [step, completed.size])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step, index])

  if (!state) return error ? <ConnectionError message={error} onRetry={refresh} /> : <FullPageLoader />

  if (step === 'done') return <ThankYou phase={session?.phase ?? 'phase1'} phase2OpensAt={state.phase2_opens_at} />
  if (step === 'already') return <AlreadyVoted />
  if (!isVotingPhase(state.phase) && step === 'access') return <VotingClosed phase={state.phase} />

  const votingPhase = isVotingPhase(state.phase) ? state.phase : (session?.phase ?? 'phase1')

  if (step === 'access' || !session) {
    return (
      <AccessStep
        phase={votingPhase}
        notice={accessNotice}
        onAlreadyVoted={() => setStep('already')}
        onSession={(s) => {
          setSession(s)
          setAccessNotice(null)
          const allChosen = categories.length > 0 && categories.every((c) => choices[c.id])
          setStep(allChosen ? 'review' : 'ballot')
        }}
      />
    )
  }

  const go = (i: number) => {
    setDirection(i > index ? 1 : -1)
    setIndex(Math.max(0, Math.min(categories.length - 1, i)))
    setStep('ballot')
  }

  const submit = async () => {
    if (!session) return
    setSubmitting(true)
    setSubmitError(null)
    const votes = categories.map((c) => ({ category_id: c.id, candidate_id: choices[c.id]!.id }))
    const res = await api.submitBallot(session.token, votes)
    setSubmitting(false)
    if (res.ok) {
      setStep('done')
      setTimeout(() => celebrate('grand'), 300)
      return
    }
    if (res.error === 'session_expired') {
      setSession(null)
      setAccessNotice(SUBMIT_ERRORS.session_expired)
      setStep('access')
      return
    }
    if (res.error === 'already_voted') return setStep('already')
    if (res.error === 'voting_closed') refresh()
    setSubmitError(SUBMIT_ERRORS[res.error])
  }

  if (step === 'review') {
    return <ReviewStep categories={categories} choices={choices} submitting={submitting} error={submitError} onEdit={go} onSubmit={submit} />
  }

  const category = categories[index]
  if (!category) return <VotingClosed phase={state.phase} />
  const isLast = index === categories.length - 1
  const chosen = choices[category.id] ?? null
  const setChoice = (c: CandidateOption | null) => setChoices((prev) => ({ ...prev, [category.id]: c }))

  return (
    <div className="mx-auto max-w-2xl pb-32 pt-4 sm:pt-8">
      <BallotProgress categories={categories} current={index} completed={completed} onJump={go} />

      <AnimatePresence mode="wait" custom={direction}>
        <motion.section
          key={category.id}
          custom={direction}
          initial={{ opacity: 0, x: direction * 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -60 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8"
        >
          <CategoryHeader category={category} index={index} phase={session.phase} />
          <div className="mt-6">
            {session.phase === 'phase1' ? (
              <CandidateAutocomplete candidates={session.candidates} value={chosen} onChange={setChoice} categoryName={category.name} />
            ) : (
              <FinalistPicker
                finalists={session.finalists.filter((f) => f.category_id === category.id).map((f) => ({ id: f.candidate_id, name: f.name }))}
                value={chosen}
                onChange={setChoice}
              />
            )}
          </div>
        </motion.section>
      </AnimatePresence>

      {/* barra de navegação fixa — fácil de alcançar com o polegar */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-gold-400/15 bg-gala-950/90 px-4 pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button onClick={() => go(index - 1)} disabled={index === 0} className="btn-ghost h-14 w-14 shrink-0 px-0" aria-label="Categoria anterior">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => (isLast || completed.size === categories.length ? setStep('review') : go(index + 1))}
            disabled={!chosen}
            className="btn-gold h-14 flex-1"
          >
            {isLast || completed.size === categories.length ? (
              <>
                <ClipboardCheck className="h-5 w-5" /> Rever escolhas
              </>
            ) : (
              <>
                Seguinte <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </nav>
    </div>
  )
}

function CategoryHeader({ category, index, phase }: { category: Category; index: number; phase: 'phase1' | 'phase2' }) {
  // na final, cabeçalho mais compacto para os finalistas aparecerem logo no ecrã do telemóvel
  const compact = phase === 'phase2'
  return (
    <div className={cn('card-gala relative overflow-hidden text-center', compact ? 'p-5' : 'p-6 sm:p-8')}>
      <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-48 rounded-full bg-gold-400/20 blur-3xl" />
      <div className="pointer-events-none absolute right-4 top-3 font-display text-6xl font-bold text-gold-400/[.07]">{String(index + 1).padStart(2, '0')}</div>
      <CategoryMedallion icon={category.icon} size={compact ? 'md' : 'lg'} className="mx-auto" />
      <div className={cn('eyebrow', compact ? 'mt-3' : 'mt-5')}>{phase === 'phase1' ? 'Nomeação' : 'Grande Final'}</div>
      <h2 className="mt-2 font-display text-2xl leading-tight text-gold-50 sm:text-3xl">{category.name}</h2>
      <p className={cn('mx-auto mt-3 max-w-md text-sm leading-relaxed text-gold-50/60', compact && 'line-clamp-2 sm:line-clamp-none')}>
        {category.description}
      </p>
    </div>
  )
}

function ThankYou({ phase, phase2OpensAt }: { phase: 'phase1' | 'phase2'; phase2OpensAt: string }) {
  const path = usePath()
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto mt-10 max-w-md text-center">
      <motion.div
        initial={{ scale: 0.4, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 10, stiffness: 90 }}
      >
        <Trophy className="mx-auto h-48 w-32" />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="mt-6 flex items-center justify-center gap-2 text-gold-300">
          <CheckCircle2 className="h-5 w-5" /> <span className="eyebrow text-gold-300">Voto registado</span>
        </div>
        <h1 className="text-gold-animated mt-3 font-display text-4xl sm:text-5xl">Obrigado!</h1>
        <p className="mt-4 text-sm leading-relaxed text-gold-50/70">
          {phase === 'phase1'
            ? `As suas nomeações foram registadas com sucesso. Os cinco mais votados de cada categoria seguem para a Grande Final, que abre a ${formatDateTime(phase2OpensAt)}.`
            : 'O seu voto na Grande Final foi registado com sucesso. Os vencedores serão revelados na noite da gala!'}
        </p>
        <p className="mt-3 text-xs text-gold-100/40">O seu voto é anónimo: não fica associado ao seu número de membro.</p>
        <Link to={path('/')} className="btn-ghost mt-8">
          Voltar ao início
        </Link>
      </motion.div>
    </motion.div>
  )
}

function AlreadyVoted() {
  const path = usePath()
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-gold-400/40 bg-gold-400/10">
        <CheckCircle2 className="h-10 w-10 text-gold-300" />
      </div>
      <h1 className="mt-6 font-display text-3xl text-gold-50">Já votou nesta fase</h1>
      <p className="mt-3 text-sm text-gold-50/60">
        Este número de membro já tem o voto registado. Cada membro vota uma única vez em cada fase. Obrigado pela participação!
      </p>
      <Link to={path('/')} className="btn-ghost mt-8">
        Voltar ao início
      </Link>
    </div>
  )
}

function VotingClosed({ phase }: { phase: string }) {
  const path = usePath()
  const label = PHASE_LABELS[phase as keyof typeof PHASE_LABELS]
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-gold-400/40 bg-gold-400/10">
        <Hourglass className="h-9 w-9 text-gold-300" />
      </div>
      <h1 className="mt-6 font-display text-3xl text-gold-50">{label?.title ?? 'Votação fechada'}</h1>
      <p className="mt-3 text-sm text-gold-50/60">A votação não está aberta neste momento. Consulte a página inicial para saber o que se segue.</p>
      <Link to={path('/')} className="btn-gold mt-8">
        Ir para o início
      </Link>
    </div>
  )
}
