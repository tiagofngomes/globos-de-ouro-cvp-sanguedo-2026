import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Crown, Maximize, Minimize, Volume2, VolumeX, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApi, usePath } from '../api/ApiContext'
import type { Category, ResultRow } from '../api/types'
import { GalaBackground } from '../components/layout/GalaBackground'
import { CategoryMedallion } from '../components/ui/CategoryIcon'
import { CvpBrand } from '../components/ui/CvpBrand'
import { FullPageLoader } from '../components/ui/Feedback'
import { Trophy } from '../components/ui/Trophy'
import { byCategoryOrder, kindOf } from '../lib/categories'
import { celebrate } from '../lib/celebrate'
import { cn } from '../lib/cn'
import { initials } from '../lib/format'
import { playChartSound, preloadGalaSound, stopAllSounds } from '../lib/galaSound'

interface CategoryShow {
  category: Category
  nominees: ResultRow[]
  winners: ResultRow[]
  total: number
  /** prémio secreto: sem nomeados nem gráfico, só o ecrã da categoria e o vencedor */
  secret?: boolean
}

type Slide =
  | { kind: 'intro' }
  | { kind: 'category'; ci: number }
  | { kind: 'nominees'; ci: number }
  | { kind: 'race'; ci: number }
  | { kind: 'winner'; ci: number }
  | { kind: 'finale' }

/** Duração do gráfico "a brincar" antes de parar nos valores reais (e aparecer a coroa). */
const TEASE_MS = 7000
/** O som do gráfico começa este tempo depois de o gráfico aparecer. */
const SOUND_DELAY_MS = 1200

/**
 * MODO GALA — apresentação em ecrã completo para a cerimónia final.
 * Por categoria: categoria → nomeados → gráfico a brincar (com o som da gala; aos 7 s
 * o gráfico para nos valores reais e aparece a coroa) → nome do vencedor em grande.
 * Só o gráfico tem som; os outros ecrãs são em silêncio.
 * Prémios secretos (sempre no fim): categoria → nome do vencedor em grande.
 * Teclas: → / Espaço avançar · ← recuar · F ecrã completo · S som · Esc sair
 */
export function GalaPage() {
  const { api } = useApi()
  const path = usePath()
  const navigate = useNavigate()
  // aberto pelo cartão "Gala" da página inicial: ao sair volta à página inicial (o menu do painel nunca aparece)
  const [params] = useSearchParams()
  const fromHome = params.get('de') === 'inicio'
  const exitTo = fromHome ? path('/') : path('/admin')
  const [shows, setShows] = useState<CategoryShow[] | null>(null)
  const [preview, setPreview] = useState(false)
  const [blocked, setBlocked] = useState<string | null>(null)
  const [blockedGoTo, setBlockedGoTo] = useState<'definicoes' | 'resultados' | 'categorias'>('definicoes')
  const [i, setI] = useState(0)
  const [sound, setSound] = useState(true)
  const [fs, setFs] = useState(false)
  const [controls, setControls] = useState(true)
  const hideTimer = useRef<number>()

  // ------------------------------------------------------------ dados ----
  useEffect(() => {
    ;(async () => {
      const [cats, overview] = await Promise.all([api.admin.listCategories(), api.admin.overview()])
      // ordem por grupos: Todas as fases, Apenas 2ª fase e, no fim, os prémios secretos
      const active = cats.filter((c) => c.active !== false).sort(byCategoryOrder)
      const vis = overview.results_visible
      // anonimato: os resultados de uma fase só existem para o painel depois de a fase fechar
      if (!vis.phase2 && overview.settings.finalists_confirmed && (overview.phase === 'phase2' || overview.phase === 'paused')) {
        setBlocked('A 2ª fase ainda está a decorrer. Encerre-a em “Datas e fases” para poder apresentar os vencedores.')
        setShows([])
        return
      }
      if (vis.phase2 && overview.winner_ties.length > 0) {
        setBlocked(
          `Há empate no 1.º lugar em ${overview.winner_ties.length === 1 ? '1 categoria' : `${overview.winner_ties.length} categorias`}. Escolham o vencedor em Resultados (2ª fase) para poder apresentar a gala.`,
        )
        setBlockedGoTo('resultados')
        setShows([])
        return
      }
      const secretMissing = overview.secret_missing ?? []
      if (secretMissing.length > 0) {
        setBlocked(
          `Falta escrever o vencedor ${secretMissing.length === 1 ? 'de 1 prémio secreto' : `de ${secretMissing.length} prémios secretos`}. Escrevam-no em Categorias para poder apresentar a gala.`,
        )
        setBlockedGoTo('categorias')
        setShows([])
        return
      }
      let rows = vis.phase2 ? await api.admin.results(2) : []
      let isPreview = false
      if (rows.length === 0) {
        if (!vis.phase1) {
          setBlocked('A 1ª fase ainda está a decorrer. Os resultados só podem ser apresentados depois de a votação fechar.')
          setShows([])
          return
        }
        // ensaio antes de haver resultados da 2ª fase: usa os finalistas aprovados (com os
        // votos da 1ª fase); se ainda não foram aprovados, os N mais votados da 1ª fase
        isPreview = true
        const [r1, cands] = await Promise.all([api.admin.results(1), api.admin.listCandidates()])
        const approved = r1.filter((r) => r.is_finalist)
        rows = active.flatMap((c) =>
          // "Apenas 2ª fase": não tem votos da 1ª fase; o ensaio usa as pessoas escolhidas
          kindOf(c) === 'phase2'
            ? (c.eligible ?? []).flatMap((id) => {
                const cand = cands.find((x) => x.id === id && x.active)
                return cand ? [{ category_id: c.id, candidate_id: id, candidate_name: cand.name, votes: 0, is_finalist: true }] : []
              })
            : approved.length > 0
              ? approved.filter((r) => r.category_id === c.id)
              : r1
                  .filter((r) => r.category_id === c.id)
                  .sort((a, b) => b.votes - a.votes)
                  .slice(0, overview.settings.finalists_per_category),
        )
      }
      setPreview(isPreview)
      setShows(
        active.map((category) => {
          // prémio secreto: o vencedor escrito à mão, sem votos
          if (kindOf(category) === 'secret') {
            const winner: ResultRow = {
              category_id: category.id,
              candidate_id: category.id,
              candidate_name: category.secret_winner ?? '',
              votes: 0,
              is_finalist: true,
              is_winner: true,
            }
            return { category, nominees: [], winners: category.secret_winner ? [winner] : [], total: 0, secret: true }
          }
          const list = rows.filter((r) => r.category_id === category.id)
          const max = Math.max(0, ...list.map((r) => r.votes))
          return {
            category,
            // nomeados por ordem alfabética para não revelar o vencedor
            nominees: [...list].sort((a, b) => a.candidate_name.localeCompare(b.candidate_name, 'pt')),
            // vencedores: os indicados pelo servidor (com a escolha dos administradores em caso de empate)
            winners: list.some((r) => r.is_winner) ? list.filter((r) => r.is_winner) : max > 0 ? list.filter((r) => r.votes === max) : [],
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
      // categorias votadas: categoria → nomeados → gráfico (que no fim se transforma no nome do vencedor);
      // prémios secretos: categoria → vencedor
      ...shows.flatMap((s, ci) =>
        s.secret
          ? [{ kind: 'category', ci } as Slide, { kind: 'winner', ci } as Slide]
          : [{ kind: 'category', ci } as Slide, { kind: 'nominees', ci } as Slide, { kind: 'race', ci } as Slide],
      ),
      { kind: 'finale' },
    ]
  }, [shows])

  const slide = slides[i]
  // cada entrada num ecrã é uma visita nova: mesmo voltando a um ecrã que ainda está a
  // desaparecer, ele recomeça do zero (o gráfico volta a correr, com o som)
  const visits = useRef(0)
  const visit = useMemo(() => (visits.current += 1), [i])
  const next = useCallback(() => setI((x) => Math.min(slides.length - 1, x + 1)), [slides.length])
  const prev = useCallback(() => setI((x) => Math.max(0, x - 1)), [])

  // ---------------------------------------------------- efeitos por slide --
  // nenhum ecrã avança sozinho: quem apresenta passa com a seta ou o comando.
  // Ao mudar de ecrã, o som do ecrã anterior para logo (nunca há sons por cima de sons).
  // Efeito de "layout": corre antes dos efeitos do ecrã que entra, para nunca cortar o
  // som que esse ecrã acabou de começar (o som do gráfico).
  useLayoutEffect(() => {
    stopAllSounds()
  }, [i])
  useEffect(() => {
    if (!slide) return
    let timer = 0
    if (slide.kind === 'winner') celebrate('grand')
    if (slide.kind === 'finale') timer = window.setTimeout(() => celebrate('grand'), 500)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  // o som do gráfico é preparado logo ao abrir a gala (arranca sem atraso);
  // ao sair da gala, nada fica a tocar
  useEffect(() => {
    void preloadGalaSound()
    return () => stopAllSounds()
  }, [])
  // som desligado (tecla S ou botão): cala logo o que estiver a tocar
  useEffect(() => {
    if (!sound) stopAllSounds()
  }, [sound])

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
      else if (e.key === 'Escape' && !document.fullscreenElement) navigate(exitTo)
    }
    document.addEventListener('fullscreenchange', onFs)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      window.removeEventListener('keydown', onKey)
    }
  }, [next, prev, toggleFs, navigate, exitTo])

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
  if (blocked) {
    return (
      <div className="fixed inset-0 grid place-items-center overflow-hidden bg-gala-950 px-6 text-center">
        <GalaBackground intensity={0.5} />
        <div className="relative max-w-xl">
          <CvpBrand compact className="justify-center" />
          <Trophy className="mx-auto mt-8 h-40 w-28 opacity-80" />
          <h1 className="mt-8 font-display text-[length:min(4vw,6vh)] text-gold-50">Ainda não há resultados para apresentar</h1>
          <p className="mt-4 text-gold-100/70">{blocked}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {!fromHome && (
              <button onClick={() => navigate(path(`/admin/${blockedGoTo}`))} className="btn-gold">
                {blockedGoTo === 'resultados' ? 'Ir para Resultados' : blockedGoTo === 'categorias' ? 'Ir para Categorias' : 'Ir para Datas e fases'}
              </button>
            )}
            <button onClick={() => navigate(exitTo)} className={fromHome ? 'btn-gold' : 'btn-ghost'}>
              {fromHome ? 'Voltar ao início' : 'Voltar ao painel'}
            </button>
          </div>
        </div>
      </div>
    )
  }

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
      <div className="absolute left-6 top-5 z-10">
        <CvpBrand compact />
      </div>
      {preview && (
        <div className="absolute right-6 top-5 z-10 rounded-full border border-cvp-500/50 bg-cvp-500/15 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-red-100">
          Ensaio · dados da 1ª fase
        </div>
      )}

      {/* Um só ecrã de cada vez: ao mudar, o anterior sai logo e o novo aparece a desvanecer.
          Sem animação de saída: com toques rápidos no comando (ou num computador lento) as
          saídas encravavam e os ecrãs ficavam presos ou empilhados. */}
      <motion.div
        key={`${i}-${visit}`}
        data-slide={i}
        className="absolute inset-0 flex items-center justify-center px-[4vw] pb-[9vh] pt-[8vh]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.6 } }}
      >
        {slide?.kind === 'intro' && <IntroSlide />}
        {slide?.kind === 'category' && show && (
          // a contagem "Categoria X de Y" só conta as votadas: os prémios secretos são surpresa
          <CategorySlide show={show} index={slide.ci} total={shows.filter((s) => !s.secret).length} />
        )}
        {slide?.kind === 'nominees' && show && <NomineesSlide show={show} />}
        {slide?.kind === 'race' && show && <RaceSlide show={show} sound={sound} />}
        {slide?.kind === 'winner' && show && <WinnerSlide show={show} />}
        {slide?.kind === 'finale' && <FinaleSlide shows={shows} />}
        {shows.length === 0 && <p className="text-gold-100/60">Sem dados para apresentar.</p>}
      </motion.div>

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
          <CtrlBtn onClick={() => setSound((s) => !s)} label="Som (S)">
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </CtrlBtn>
          <CtrlBtn onClick={toggleFs} label="Ecrã completo (F)">
            {fs ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </CtrlBtn>
          <CtrlBtn onClick={() => navigate(exitTo)} label="Sair">
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
      {/* abertura discreta, como no início de um filme (igual à página inicial) */}
      <motion.p
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 1 }}
        className="font-serif text-[length:min(2.6vw,4.2vh)] italic tracking-wide text-gold-200/80"
      >
        A Delegação de Sanguedo apresenta
      </motion.p>
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.4, ease }} className="my-[3vh]">
        <Trophy className="mx-auto h-[42vh] w-[28vh] animate-float" />
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 1, ease }} className="font-display">
        <span className="text-gold-animated block text-[length:min(11vw,17vh)] font-bold leading-none">Globos de Ouro</span>
        <span className="mt-[2vh] block text-[length:min(3.4vw,5.5vh)] tracking-[0.4em] text-gold-100">CVP SANGUEDO 2026</span>
      </motion.h1>
    </div>
  )
}

function CategorySlide({ show, index, total }: { show: CategoryShow; index: number; total: number }) {
  return (
    <div className="flex w-full max-w-[92vw] flex-col items-center gap-[3vh] text-center md:flex-row md:gap-[5vw] md:text-left">
      <motion.div
        initial={{ scale: 0.4, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 14, stiffness: 70, delay: 0.1 }}
        className="shrink-0"
      >
        <Trophy icon={show.category.icon} className="h-[36vh] w-[24vh] animate-float md:h-[68vh] md:w-[45vh]" />
      </motion.div>
      <div className="min-w-0 flex-1">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="eyebrow text-[length:min(1.8vw,2.8vh)]"
        >
          {show.secret ? 'Prémio especial' : `Categoria ${index + 1} de ${total}`}
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 1.2, ease }}
          className="text-gold mt-[2vh] font-display text-[length:min(5.8vw,10vh)] font-bold leading-[1.05]"
        >
          {show.category.name}
        </motion.h2>
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 1, duration: 0.9 }}
          className="divider-gold mt-[3vh] max-w-[40vw] origin-left"
        />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-[3vh] max-w-[60ch] font-serif text-[length:min(2.3vw,3.8vh)] italic leading-snug text-gold-50/75"
        >
          {show.category.description}
        </motion.p>
      </div>
    </div>
  )
}

function NomineesSlide({ show }: { show: CategoryShow }) {
  const n = show.nominees.length
  // até 5 nomeados fica como sempre; com mais, cartões e letras encolhem para caberem todos numa fila
  const dense = n > 5
  const cardStyle = dense ? { width: `min(30vh, calc((94vw - ${(n - 1) * 1.6}vw) / ${n}))` } : undefined
  const avatar = dense ? `min(9vw, 16vh, ${(50 / n).toFixed(2)}vw)` : undefined
  const avatarStyle = dense ? { width: avatar, height: avatar, fontSize: `min(3vw, 5.2vh, ${(17 / n).toFixed(2)}vw)` } : undefined
  // com muitos nomeados, a letra encolhe; e mais um pouco se houver uma palavra comprida,
  // para nenhuma palavra ser partida a meio
  const nameStyle = (name: string) => {
    if (!dense) return undefined
    const longest = Math.max(...name.split(/\s+/).map((w) => w.length))
    const k = Math.min(1, 7 / Math.max(longest, 1))
    return { fontSize: `calc(min(2.4vw, 4vh, ${(13 / n).toFixed(2)}vw) * ${k.toFixed(2)})` }
  }
  return (
    <div className="w-full max-w-[94vw] text-center">
      <div className="eyebrow text-[length:min(1.8vw,2.8vh)]">{show.category.name}</div>
      <h2 className="mt-[1.5vh] font-display text-[length:min(5.5vw,9vh)] text-gold-50">Os nomeados são…</h2>
      <div className={cn('mt-[6vh] flex justify-center gap-[1.6vw]', dense ? 'flex-nowrap' : 'flex-wrap')}>
        {show.nominees.map((n, k) => (
          <motion.div
            key={n.candidate_id}
            initial={{ opacity: 0, y: 40, rotateX: -60 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.5 + k * 0.55, duration: 0.8, ease }}
            className="card-gala flex w-[min(16vw,30vh)] min-w-0 flex-col items-center gap-[2vh] p-[min(1.6vw,2.8vh)]"
            style={cardStyle}
          >
            <span
              className="grid h-[min(9vw,16vh)] w-[min(9vw,16vh)] shrink-0 place-items-center rounded-full font-display text-[length:min(3vw,5.2vh)] font-semibold text-gala-900"
              style={{ background: 'linear-gradient(135deg,#fdf8e8,#e3b53a 50%,#8a611b)', ...avatarStyle }}
            >
              {initials(n.candidate_name)}
            </span>
            <span
              className="font-display text-[length:min(2.4vw,4vh)] leading-tight text-gold-50 [overflow-wrap:break-word]"
              style={nameStyle(n.candidate_name)}
            >
              {n.candidate_name}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/**
 * O gráfico "a brincar": as barras ficam sempre no mesmo lugar (ordem
 * alfabética) e só sobem e descem para enganar o público (cada nomeado parece
 * ir ganhar a certa altura, cada vez mais depressa). Pouco antes do fim ficam
 * todas iguais… e, aos 7 s (o "tádá" do som), o gráfico dá lugar ao nome do
 * vencedor em grande, com a coroa. Os valores reais nunca aparecem: ninguém fica
 * exposto com uma barra pequena.
 */
function RaceSlide({ show, sound }: { show: CategoryShow; sound: boolean }) {
  const nominees = show.nominees
  const [heights, setHeights] = useState<number[]>(() => nominees.map(() => 6))
  const [revealed, setRevealed] = useState(false)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    const timers = timersRef.current
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
    const n = nominees.length

    if (n > 0) {
      // ordem dos "falsos líderes": todos parecem ganhar pelo menos uma vez, por ordem aleatória
      const order = [...nominees.keys()].sort(() => Math.random() - 0.5)
      const calmAt = TEASE_MS - 900
      let t = 350
      let beat = 0
      while (t < calmAt) {
        const leader = order[beat % n]
        // de vez em quando dois "empatados" lá em cima, para baralhar ainda mais
        const rival = n > 1 && beat % 3 === 2 ? order[(beat + 1) % n] : -1
        const hs = nominees.map((_, k) => (k === leader ? 80 + Math.random() * 18 : k === rival ? 72 + Math.random() * 18 : 15 + Math.random() * 50))
        at(t, () => setHeights(hs))
        t += 780 - (t / calmAt) * 520 // cada vez mais rápido: ~780 ms → ~260 ms
        beat++
      }
      // silêncio: todas iguais, a meio
      at(calmAt, () => setHeights(nominees.map(() => 50)))
    }
    // o som da gala começa 1,2 s depois do gráfico; aos 7 s aparece o vencedor
    // (se o apresentador avançar antes disso, o som já não começa)
    if (sound) at(SOUND_DELAY_MS, () => playChartSound())
    // o gráfico dá lugar ao nome do vencedor (o som continua: é o mesmo ecrã)
    at(TEASE_MS, () => {
      setRevealed(true)
      celebrate('grand')
    })
    // fica no vencedor até o apresentador avançar
    // (o som é parado pela página ao mudar de ecrã; aqui só se cancelam os temporizadores)
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id))
      timersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // aos 7 s: o nome do vencedor em grande, no lugar do gráfico
  if (revealed) {
    return (
      <motion.div data-reveal className="flex w-full justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
        <WinnerSlide show={show} instant />
      </motion.div>
    )
  }

  const many = nominees.length > 5
  const nameBase = many ? `min(1.8vw, 3.1vh, ${(8 / nominees.length).toFixed(2)}vw)` : 'min(1.8vw, 3.1vh)'
  // nomes compridos ficam com letra um pouco mais pequena, para caberem sem cortar
  const nameStyle = (name: string) => {
    const k = name.length > 30 ? 0.72 : name.length > 20 ? 0.85 : 1
    return { fontSize: k === 1 ? nameBase : `calc(${nameBase} * ${k})` }
  }

  return (
    <div className="flex h-full w-full max-w-[94vw] flex-col gap-[2vh] text-center md:flex-row md:items-stretch md:gap-[3vw] md:text-left">
      {/* títulos à esquerda: o gráfico fica com quase toda a altura do ecrã */}
      <div className="flex shrink-0 flex-col justify-center md:w-[24vw]">
        <div className="eyebrow text-[length:min(1.6vw,2.6vh)] leading-relaxed">{show.category.name}</div>
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-[2vh] font-serif text-[length:min(4.4vw,7vh)] italic leading-[1.1] text-gold-50 md:text-[length:min(3.9vw,7.5vh)]"
        >
          E o Globo de Ouro vai para…
        </motion.h2>
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="divider-gold mt-[3vh] hidden w-[12vw] origin-left md:block"
        />
      </div>

      {nominees.length === 0 ? (
        <p className="m-auto text-2xl text-gold-100/60">Sem votos nesta categoria.</p>
      ) : (
        <div className="flex min-h-0 flex-1 items-stretch justify-center gap-[min(2.2vw,3.5vh)]">
          {nominees.map((r, k) => {
            return (
              <div key={r.candidate_id} className="flex min-w-0 max-w-[min(13vw,26vh)] flex-1 flex-col items-center text-center">
                {/* por cima da barra: "?" enquanto brinca */}
                <div className="flex h-[15vh] shrink-0 flex-col items-center justify-end">
                  <motion.span
                    animate={{ opacity: [0.35, 0.9, 0.35] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                    className="font-display text-[length:min(4vw,7vh)] text-gold-200"
                  >
                    ?
                  </motion.span>
                </div>

                {/* barra (sempre no mesmo lugar; só a altura muda) */}
                <div className="relative mt-[1vh] flex min-h-0 w-full flex-1 items-end">
                  <motion.div
                    className="relative w-full overflow-hidden rounded-t-2xl bg-gradient-to-t from-gold-700 via-gold-400 to-gold-100"
                    initial={{ height: '6%' }}
                    animate={{ height: `${heights[k] ?? 0}%` }}
                    transition={{ type: 'spring', stiffness: 160, damping: 13 }}
                  >
                    <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,.35)_50%,transparent_70%)] bg-[length:200%_100%]" />
                  </motion.div>
                </div>

                {/* nome */}
                <div className="mt-[1.5vh] h-[12vh] w-full shrink-0">
                  <span
                    className="line-clamp-4 font-display leading-[1.1] text-gold-50 [hyphens:auto] [overflow-wrap:break-word]"
                    style={nameStyle(r.candidate_name)}
                  >
                    {r.candidate_name}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** `instant`: dentro do gráfico, o nome aparece logo, no "tádá" do som (sem esperar). */
function WinnerSlide({ show, instant }: { show: CategoryShow; instant?: boolean }) {
  const n = show.winners.length
  // vários vencedores (ex aequo): os nomes encolhem para caberem todos no ecrã; com 3 ou mais ficam em 2 colunas
  const nameSize = n <= 1 ? 'min(10vw, 17vh)' : n === 2 ? 'min(8vw, 12vh)' : n <= 4 ? 'min(4.4vw, 7vh)' : 'min(3.6vw, 5.8vh)'
  const crownSize = n <= 1 ? 'min(8vw, 13vh)' : n === 2 ? 'min(5vw, 8vh)' : 'min(3.6vw, 6vh)'
  return (
    <div className="w-full max-w-[94vw] text-center">
      {/* foco de luz sobre o vencedor */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2 }}
        className="pointer-events-none absolute left-1/2 top-0 h-[90vh] w-[60vw] -translate-x-1/2"
        style={{ background: 'radial-gradient(ellipse at top, rgba(253,248,232,.28), transparent 65%)' }}
      />
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="eyebrow relative text-[length:min(2.2vw,3.5vh)]">
        {show.category.name}
      </motion.div>
      {n === 0 && <p className="mt-10 text-2xl text-gold-100/60">Sem votos nesta categoria.</p>}
      <div className={cn('relative mt-[3vh] grid items-center justify-center', n >= 3 ? 'grid-cols-2 gap-x-[4vw] gap-y-[3vh]' : 'grid-cols-1 gap-[4vh]')}>
        {show.winners.map((w, k) => (
          <motion.div
            key={w.candidate_id}
            initial={instant ? { scale: 0.75, opacity: 1, filter: 'blur(6px)' } : { scale: 0.3, opacity: 0, filter: 'blur(20px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={
              instant ? { type: 'spring', damping: 14, stiffness: 170, delay: k * 0.15 } : { type: 'spring', damping: 11, stiffness: 80, delay: 0.15 + k * 0.3 }
            }
          >
            <Crown className="mx-auto mb-[1.5vh] text-gold-300 drop-shadow-[0_0_25px_rgba(236,201,90,.9)]" style={{ width: crownSize, height: crownSize }} />
            <div className="text-gold-animated font-display font-bold leading-[1.05]" style={{ fontSize: nameSize }}>
              {w.candidate_name}
            </div>
          </motion.div>
        ))}
      </div>
      {n > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + n * 0.3 }}
          className="relative mt-[3vh] font-serif text-[length:min(2.8vw,4.6vh)] italic text-gold-100"
        >
          Ex aequo
        </motion.div>
      )}
    </div>
  )
}

function FinaleSlide({ shows }: { shows: CategoryShow[] }) {
  return (
    <div className="w-full max-w-[94vw] text-center">
      <h2 className="text-gold-animated font-display text-[length:min(6vw,10vh)] font-bold">Parabéns aos vencedores!</h2>
      <p className="mt-[1.5vh] font-serif text-[length:min(2.3vw,3.8vh)] italic text-gold-50/70">Obrigado a todos os que fazem da CVP Sanguedo uma família.</p>
      <div className="mt-[5vh] grid grid-cols-1 gap-[min(1.5vw,2.5vh)] sm:grid-cols-2 lg:grid-cols-3">
        {shows.map((s, k) => (
          <motion.div
            key={s.category.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + k * 0.15 }}
            className="card-gala flex items-center gap-[min(1.4vw,2.4vh)] p-[min(1.5vw,2.6vh)] text-left"
          >
            <CategoryMedallion icon={s.category.icon} size="lg" />
            <div className="min-w-0">
              <div className="line-clamp-2 text-[length:min(1.1vw,1.9vh)] uppercase leading-snug tracking-[0.15em] text-gold-300/70">{s.category.name}</div>
              <div className="font-display text-[length:min(2.4vw,4vh)] leading-tight text-gold-50">
                {s.winners.map((w) => w.candidate_name).join(' & ') || 'Sem votos'}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
