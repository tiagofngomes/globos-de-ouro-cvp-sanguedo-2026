import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, ChevronLeft, ChevronRight, Crown, Maximize, Minimize, Volume2, VolumeX, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi, usePath } from '../api/ApiContext'
import type { Category, ResultRow } from '../api/types'
import { GalaBackground } from '../components/layout/GalaBackground'
import { CategoryMedallion } from '../components/ui/CategoryIcon'
import { CvpBrand, CvpRibbon } from '../components/ui/CvpBrand'
import { FullPageLoader } from '../components/ui/Feedback'
import { Trophy } from '../components/ui/Trophy'
import { celebrate } from '../lib/celebrate'
import { cn } from '../lib/cn'
import { formatPct, initials, pct } from '../lib/format'
import { drumroll, fanfare } from '../lib/galaSound'

interface CategoryShow {
  category: Category
  nominees: ResultRow[]
  winners: ResultRow[]
  total: number
}

type Slide =
  | { kind: 'intro' }
  | { kind: 'category'; ci: number }
  | { kind: 'nominees'; ci: number }
  | { kind: 'envelope'; ci: number }
  | { kind: 'winner'; ci: number }
  | { kind: 'finale' }

const ENVELOPE_MS = 3400

/**
 * MODO GALA — apresentação em ecrã completo para a cerimónia.
 * Teclas: → / Espaço avançar · ← recuar · F ecrã completo · S som · V votos · Esc sair
 */
export function GalaPage() {
  const { api } = useApi()
  const path = usePath()
  const navigate = useNavigate()
  const [shows, setShows] = useState<CategoryShow[] | null>(null)
  const [preview, setPreview] = useState(false)
  const [i, setI] = useState(0)
  const [sound, setSound] = useState(true)
  const [showVotes, setShowVotes] = useState(false)
  const [fs, setFs] = useState(false)
  const [controls, setControls] = useState(true)
  const hideTimer = useRef<number>()

  // ------------------------------------------------------------ dados ----
  useEffect(() => {
    ;(async () => {
      const [cats, overview] = await Promise.all([api.admin.listCategories(), api.admin.overview()])
      const active = cats.filter((c) => c.active !== false).sort((a, b) => a.sort_order - b.sort_order)
      let rows = await api.admin.results(2)
      let isPreview = false
      if (rows.length === 0) {
        // ensaio antes da final: usa os N mais votados das nomeações
        isPreview = true
        const r1 = await api.admin.results(1)
        rows = active.flatMap((c) =>
          r1
            .filter((r) => r.category_id === c.id)
            .sort((a, b) => b.votes - a.votes)
            .slice(0, overview.settings.finalists_per_category),
        )
      }
      setPreview(isPreview)
      setShows(
        active.map((category) => {
          const list = rows.filter((r) => r.category_id === category.id)
          const max = Math.max(0, ...list.map((r) => r.votes))
          return {
            category,
            // nomeados por ordem alfabética para não revelar o vencedor
            nominees: [...list].sort((a, b) => a.candidate_name.localeCompare(b.candidate_name, 'pt')),
            winners: max > 0 ? list.filter((r) => r.votes === max) : [],
            total: list.reduce((a, r) => a + r.votes, 0),
          }
        }),
      )
    })().catch(() => setShows([]))
  }, [api])

  const slides = useMemo<Slide[]>(() => {
    if (!shows) return []
    return [
      { kind: 'intro' },
      ...shows.flatMap((_, ci) => [
        { kind: 'category', ci } as Slide,
        { kind: 'nominees', ci } as Slide,
        { kind: 'envelope', ci } as Slide,
        { kind: 'winner', ci } as Slide,
      ]),
      { kind: 'finale' },
    ]
  }, [shows])

  const slide = slides[i]
  const next = useCallback(() => setI((x) => Math.min(slides.length - 1, x + 1)), [slides.length])
  const prev = useCallback(() => setI((x) => Math.max(0, x - 1)), [])

  // ---------------------------------------------------- efeitos por slide --
  useEffect(() => {
    if (!slide) return
    if (slide.kind === 'envelope') {
      if (sound) drumroll(ENVELOPE_MS / 1000 - 0.3)
      const t = setTimeout(() => setI((x) => x + 1), ENVELOPE_MS)
      return () => clearTimeout(t)
    }
    if (slide.kind === 'winner') {
      if (sound) fanfare()
      celebrate('grand')
    }
    if (slide.kind === 'finale') setTimeout(() => celebrate('grand'), 500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  // ------------------------------------------------------------ controlo --
  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])

  useEffect(() => {
    const onFs = () => setFs(Boolean(document.fullscreenElement))
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(e.key)) {
        e.preventDefault()
        next()
      } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault()
        prev()
      } else if (e.key.toLowerCase() === 'f') toggleFs()
      else if (e.key.toLowerCase() === 's') setSound((s) => !s)
      else if (e.key.toLowerCase() === 'v') setShowVotes((s) => !s)
      else if (e.key === 'Escape' && !document.fullscreenElement) navigate(path('/admin'))
    }
    document.addEventListener('fullscreenchange', onFs)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      window.removeEventListener('keydown', onKey)
    }
  }, [next, prev, toggleFs, navigate, path])

  const poke = () => {
    setControls(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setControls(false), 3000)
  }
  useEffect(() => {
    poke()
    return () => window.clearTimeout(hideTimer.current)
  }, [])

  if (!shows) return <FullPageLoader label="A preparar o palco…" />

  const show = slide && 'ci' in slide ? shows[slide.ci] : null

  return (
    <div
      className={cn('fixed inset-0 select-none overflow-hidden bg-gala-950', !controls && 'cursor-none')}
      onMouseMove={poke}
      onClick={(e) => {
        // toque/clique no ecrã avança (exceto nos controlos)
        if ((e.target as HTMLElement).closest('[data-controls]')) return
        poke()
        next()
      }}
    >
      <GalaBackground />
      <div className="absolute left-6 top-5 z-10 opacity-70">
        <CvpBrand compact />
      </div>
      {preview && (
        <div className="absolute right-6 top-5 z-10 rounded-full border border-cvp-500/50 bg-cvp-500/15 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-red-100">
          Ensaio · dados das nomeações
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          className="absolute inset-0 flex items-center justify-center px-6 py-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          transition={{ duration: 0.6 }}
        >
          {slide?.kind === 'intro' && <IntroSlide />}
          {slide?.kind === 'category' && show && <CategorySlide show={show} index={slide.ci} />}
          {slide?.kind === 'nominees' && show && <NomineesSlide show={show} />}
          {slide?.kind === 'envelope' && show && <EnvelopeSlide show={show} />}
          {slide?.kind === 'winner' && show && <WinnerSlide show={show} showVotes={showVotes} />}
          {slide?.kind === 'finale' && <FinaleSlide shows={shows} />}
          {shows.length === 0 && <p className="text-gold-100/60">Sem dados para apresentar.</p>}
        </motion.div>
      </AnimatePresence>

      {/* controlos */}
      <motion.div
        data-controls
        animate={{ opacity: controls ? 1 : 0, y: controls ? 0 : 20 }}
        className="safe-bottom absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 p-4"
      >
        <div className="glass flex items-center gap-1 rounded-full border border-gold-400/20 p-1.5">
          <CtrlBtn onClick={prev} label="Anterior (←)">
            <ChevronLeft className="h-5 w-5" />
          </CtrlBtn>
          <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-gold-100/60">
            {i + 1} / {slides.length}
          </span>
          <CtrlBtn onClick={next} label="Seguinte (→)">
            <ChevronRight className="h-5 w-5" />
          </CtrlBtn>
          <span className="mx-1 h-6 w-px bg-white/10" />
          <CtrlBtn onClick={() => setShowVotes((v) => !v)} label="Mostrar votos (V)" active={showVotes}>
            <BarChart3 className="h-4 w-4" />
          </CtrlBtn>
          <CtrlBtn onClick={() => setSound((s) => !s)} label="Som (S)">
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </CtrlBtn>
          <CtrlBtn onClick={toggleFs} label="Ecrã completo (F)">
            {fs ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </CtrlBtn>
          <CtrlBtn onClick={() => navigate(path('/admin'))} label="Sair">
            <X className="h-4 w-4" />
          </CtrlBtn>
        </div>
      </motion.div>
    </div>
  )
}

function CtrlBtn({ children, onClick, label, active }: { children: React.ReactNode; onClick: () => void; label: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'grid h-10 w-10 place-items-center rounded-full transition',
        active ? 'bg-gold-400/25 text-gold-100' : 'text-gold-100/70 hover:bg-white/10 hover:text-gold-50',
      )}
    >
      {children}
    </button>
  )
}

// ------------------------------------------------------------------ slides --

const ease = [0.22, 1, 0.36, 1] as const

function IntroSlide() {
  return (
    <div className="text-center">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <CvpRibbon>Cruz Vermelha Portuguesa · Delegação de Sanguedo</CvpRibbon>
      </motion.div>
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.4, ease }} className="my-8">
        <Trophy className="mx-auto h-[28vh] w-[19vh] animate-float" />
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 1, ease }} className="font-display">
        <span className="text-gold-animated block text-[clamp(3rem,10vw,9rem)] font-bold leading-none">Globos de Ouro</span>
        <span className="mt-4 block text-[clamp(1.2rem,3vw,2.5rem)] tracking-[0.4em] text-gold-100">CVP SANGUEDO 2026</span>
      </motion.h1>
    </div>
  )
}

function CategorySlide({ show, index }: { show: CategoryShow; index: number }) {
  return (
    <div className="max-w-5xl text-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="eyebrow text-[clamp(.7rem,1.2vw,1rem)]">
        Categoria {index + 1}
      </motion.div>
      <motion.div
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 12, delay: 0.2 }}
        className="my-8"
      >
        <CategoryMedallion icon={show.category.icon} size="xl" className="mx-auto scale-125" />
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 30, letterSpacing: '0.3em' }}
        animate={{ opacity: 1, y: 0, letterSpacing: '0.02em' }}
        transition={{ delay: 0.4, duration: 1.2, ease }}
        className="text-gold font-display text-[clamp(2.2rem,6vw,5.5rem)] font-bold leading-tight"
      >
        {show.category.name}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="mx-auto mt-6 max-w-3xl font-serif text-[clamp(1rem,2vw,1.6rem)] italic text-gold-50/70"
      >
        {show.category.description}
      </motion.p>
    </div>
  )
}

function NomineesSlide({ show }: { show: CategoryShow }) {
  return (
    <div className="w-full max-w-6xl text-center">
      <div className="eyebrow text-[clamp(.7rem,1.2vw,1rem)]">{show.category.name}</div>
      <h2 className="mt-3 font-display text-[clamp(2rem,4.5vw,4rem)] text-gold-50">Os nomeados são…</h2>
      <div className="mt-10 flex flex-wrap justify-center gap-[2vw]">
        {show.nominees.map((n, k) => (
          <motion.div
            key={n.candidate_id}
            initial={{ opacity: 0, y: 40, rotateX: -60 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.5 + k * 0.55, duration: 0.8, ease }}
            className="card-gala flex w-[clamp(10rem,17vw,15rem)] flex-col items-center gap-3 p-[1.5vw]"
          >
            <span
              className="grid h-[clamp(3.5rem,7vw,6rem)] w-[clamp(3.5rem,7vw,6rem)] place-items-center rounded-full font-display text-[clamp(1.1rem,2.2vw,2rem)] font-semibold text-gala-900"
              style={{ background: 'linear-gradient(135deg,#fdf8e8,#e3b53a 50%,#8a611b)' }}
            >
              {initials(n.candidate_name)}
            </span>
            <span className="font-display text-[clamp(1rem,1.7vw,1.6rem)] leading-tight text-gold-50">{n.candidate_name}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function EnvelopeSlide({ show }: { show: CategoryShow }) {
  return (
    <div className="text-center">
      <motion.div
        animate={{ scale: [1, 1.06, 1], rotate: [0, -2, 2, 0] }}
        transition={{ duration: 0.6, repeat: Infinity }}
        className="mx-auto mb-10 grid h-[22vh] w-[32vh] place-items-center rounded-xl"
        style={{ background: 'linear-gradient(160deg,#f3dc8f,#b07f1f)', boxShadow: '0 0 80px rgba(236,201,90,.6)' }}
      >
        <div className="grid h-[8vh] w-[8vh] place-items-center rounded-full bg-cvp-500 shadow-red-glow">
          <Crown className="h-[4vh] w-[4vh] text-white" />
        </div>
      </motion.div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="eyebrow text-[clamp(.7rem,1.2vw,1rem)]">
        {show.category.name}
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-4 font-serif text-[clamp(2rem,5vw,4.5rem)] italic text-gold-50"
      >
        E o Globo de Ouro vai para…
      </motion.h2>
    </div>
  )
}

function WinnerSlide({ show, showVotes }: { show: CategoryShow; showVotes: boolean }) {
  const ranking = [...show.nominees].sort((a, b) => b.votes - a.votes)
  return (
    <div className="w-full max-w-6xl text-center">
      {/* foco de luz sobre o vencedor */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2 }}
        className="pointer-events-none absolute left-1/2 top-0 h-[90vh] w-[60vw] -translate-x-1/2"
        style={{ background: 'radial-gradient(ellipse at top, rgba(253,248,232,.28), transparent 65%)' }}
      />
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="eyebrow relative text-[clamp(.7rem,1.2vw,1rem)]">
        {show.category.name}
      </motion.div>
      {show.winners.length === 0 && <p className="mt-10 text-2xl text-gold-100/60">Sem votos nesta categoria.</p>}
      <div className="relative mt-6 flex flex-col items-center gap-6">
        {show.winners.map((w, k) => (
          <motion.div
            key={w.candidate_id}
            initial={{ scale: 0.3, opacity: 0, filter: 'blur(20px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={{ type: 'spring', damping: 11, stiffness: 80, delay: 0.15 + k * 0.3 }}
          >
            <Crown className="mx-auto mb-2 h-[clamp(2.5rem,6vw,5rem)] w-[clamp(2.5rem,6vw,5rem)] text-gold-300 drop-shadow-[0_0_25px_rgba(236,201,90,.9)]" />
            <div className="text-gold-animated font-display text-[clamp(2.6rem,8vw,7.5rem)] font-bold leading-[1.05]">{w.candidate_name}</div>
          </motion.div>
        ))}
        {show.winners.length > 1 && <div className="eyebrow text-cvp-400">Ex aequo</div>}
      </div>

      <AnimatePresence>
        {showVotes && show.total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative mx-auto mt-10 max-w-2xl space-y-2 text-left"
          >
            {ranking.map((r, k) => {
              const share = pct(r.votes, show.total)
              const win = show.winners.some((w) => w.candidate_id === r.candidate_id)
              return (
                <div key={r.candidate_id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className={win ? 'text-gold-100' : 'text-gold-50/60'}>{r.candidate_name}</span>
                    <span className="tabular-nums text-gold-100/70">{formatPct(share)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${share}%` }}
                      transition={{ delay: 0.2 + k * 0.1, duration: 1 }}
                      className={cn('h-full rounded-full', win ? 'bg-gradient-to-r from-gold-600 to-gold-100' : 'bg-white/30')}
                    />
                  </div>
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FinaleSlide({ shows }: { shows: CategoryShow[] }) {
  return (
    <div className="w-full max-w-6xl text-center">
      <h2 className="text-gold-animated font-display text-[clamp(2.2rem,6vw,5.5rem)] font-bold">Parabéns aos vencedores!</h2>
      <p className="mt-3 font-serif text-[clamp(1rem,2vw,1.6rem)] italic text-gold-50/70">Obrigado a todos os que fazem da CVP Sanguedo uma família.</p>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shows.map((s, k) => (
          <motion.div
            key={s.category.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + k * 0.15 }}
            className="card-gala flex items-center gap-4 p-4 text-left"
          >
            <CategoryMedallion icon={s.category.icon} size="md" />
            <div className="min-w-0">
              <div className="truncate text-[11px] uppercase tracking-[0.15em] text-gold-300/70">{s.category.name}</div>
              <div className="font-display text-xl leading-tight text-gold-50">{s.winners.map((w) => w.candidate_name).join(' & ') || '—'}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
