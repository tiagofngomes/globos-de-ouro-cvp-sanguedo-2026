import { motion } from 'framer-motion'
import { ArrowRight, CalendarClock, EyeOff, Hash, Lock, MousePointerClick, PartyPopper, ShieldCheck, Trophy as TrophyIcon, Vote } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePath } from '../api/ApiContext'
import type { Category, PublicState } from '../api/types'
import { CategoryMedallion } from '../components/ui/CategoryIcon'
import { Countdown } from '../components/ui/Countdown'
import { FullPageLoader } from '../components/ui/Feedback'
import { Trophy } from '../components/ui/Trophy'
import { usePublicState } from '../hooks/usePublicState'
import { formatDateTime, isGalaDayReached } from '../lib/format'
import { cn } from '../lib/cn'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: 0.12 * i, duration: 0.8, ease: [0.22, 1, 0.36, 1] } }),
}

export function HomePage() {
  const { state, error, offset, refresh } = usePublicState()

  if (!state) {
    return error ? <ConnectionError message={error} onRetry={refresh} /> : <FullPageLoader />
  }

  return (
    <div className="flex flex-col gap-16 pb-8 sm:gap-24">
      <Hero state={state} offset={offset} onPhaseChange={refresh} />
      <Timeline state={state} offset={offset} />
      <Categories categories={state.categories} />
      <HowItWorks />
    </div>
  )
}

// -------------------------------------------------------------------- hero --

function Hero({ state, offset, onPhaseChange }: { state: PublicState; offset: number; onPhaseChange: () => void }) {
  const path = usePath()
  const s = state

  const status = (() => {
    switch (s.phase) {
      case 'pre_voting':
        return { label: 'As nomeações da 1ª fase abrem em', target: s.phase1_opens_at, cta: null, note: formatDateTime(s.phase1_opens_at) }
      case 'phase1':
        return {
          label: 'As nomeações da 1ª fase encerram em',
          target: s.phase1_closes_at,
          cta: { to: path('/votar'), text: 'Votar agora' },
          note: `até ${formatDateTime(s.phase1_closes_at)}`,
        }
      case 'paused':
        return { label: 'Votação temporariamente suspensa', target: null, cta: null, note: 'Volte a tentar dentro de momentos.' }
      case 'counting':
        return {
          label: new Date(s.phase2_opens_at).getTime() > Date.now() + offset ? 'A 2ª fase abre em' : 'A apurar os finalistas',
          target: new Date(s.phase2_opens_at).getTime() > Date.now() + offset ? s.phase2_opens_at : null,
          cta: null,
          note: 'Os cinco mais votados de cada categoria seguem para a 2ª fase.',
        }
      case 'phase2':
        return {
          label: s.phase2_closes_at ? 'A 2ª fase encerra em' : 'A 2ª fase está a decorrer',
          target: s.phase2_closes_at,
          cta: { to: path('/votar'), text: 'Votar na 2ª fase' },
          note: s.phase2_closes_at ? `até ${formatDateTime(s.phase2_closes_at)}` : 'Vote apenas nos finalistas de cada categoria.',
        }
      case 'awaiting_gala':
        return {
          label: s.gala_at ? 'A gala começa em' : 'Votações encerradas',
          target: s.gala_at,
          cta: null,
          note: 'Obrigado a todos! Os vencedores serão revelados na gala.',
        }
      case 'results':
        return { label: 'Os vencedores foram revelados', target: null, cta: { to: path('/resultados'), text: 'Ver vencedores' }, note: null }
    }
  })()

  return (
    <section className="relative flex flex-col items-center pt-6 text-center sm:pt-10">
      {/* abertura discreta, como no início de um filme */}
      <motion.p variants={fadeUp} initial="hidden" animate="show" custom={0} className="font-serif text-base italic tracking-wide text-gold-200/80 sm:text-lg">
        A Delegação de Sanguedo apresenta
      </motion.p>

      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        className="my-6 animate-float"
      >
        <Trophy className="h-40 w-28 sm:h-56 sm:w-40" />
      </motion.div>

      <motion.h1 variants={fadeUp} initial="hidden" animate="show" custom={1} className="font-display leading-[0.95]">
        <span className="text-gold-animated block text-[3.1rem] font-bold tracking-wide sm:text-8xl">Globos</span>
        <span className="block font-serif text-2xl italic text-gold-200/90 sm:text-4xl">de</span>
        <span className="text-gold-animated block text-[3.1rem] font-bold tracking-wide sm:text-8xl">Ouro</span>
      </motion.h1>

      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={2} className="mt-5 flex items-center gap-3">
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-gold-400 sm:w-16" />
        <span className="font-display text-base tracking-[0.3em] text-gold-100 sm:text-xl">CVP SANGUEDO</span>
        <span className="rounded-md bg-cvp-500 px-2 py-0.5 font-display text-sm font-bold text-white shadow-red-glow sm:text-base">2026</span>
        <span className="h-px w-8 bg-gradient-to-l from-transparent to-gold-400 sm:w-16" />
      </motion.div>

      <motion.p variants={fadeUp} initial="hidden" animate="show" custom={3} className="mt-5 max-w-md text-sm leading-relaxed text-gold-50/70 sm:text-base">
        Uma noite para celebrar quem faz da nossa delegação um exemplo de humanidade.
        <span className="mt-2 block">Escolha os colegas que mais brilharam este ano.</span>
      </motion.p>

      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={4} className="mt-9 w-full max-w-xl">
        <div className="eyebrow mb-4">{status.label}</div>
        {status.target && <Countdown target={status.target} offset={offset} onDone={onPhaseChange} />}
        {status.note && <p className="mt-4 text-xs text-gold-100/50">{status.note}</p>}
        {status.cta && (
          <Link to={status.cta.to} className="btn-gold mt-8 w-full max-w-xs py-4 text-sm sm:w-auto sm:px-10">
            <Vote className="h-5 w-5" />
            {status.cta.text}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </motion.div>
    </section>
  )
}

// ---------------------------------------------------------------- timeline --

function Timeline({ state, offset }: { state: PublicState; offset: number }) {
  const path = usePath()
  // no dia da gala (e daí em diante) o cartão dá acesso ao Modo Gala, com credenciais
  const galaOpen = isGalaDayReached(state.gala_at, Date.now() + offset)
  const order = ['pre_voting', 'phase1', 'counting', 'phase2', 'awaiting_gala', 'results']
  const idx = order.indexOf(state.phase === 'paused' ? 'phase1' : state.phase)
  const steps = [
    { icon: MousePointerClick, title: '1ª fase', text: `Até ${formatDateTime(state.phase1_closes_at)}`, active: idx === 1, done: idx > 1 },
    {
      icon: TrophyIcon,
      title: '2ª fase',
      text: `A partir de ${formatDateTime(state.phase2_opens_at)}`,
      active: idx === 2 || idx === 3,
      done: idx > 3,
    },
    {
      icon: PartyPopper,
      title: 'Gala',
      text: state.gala_at ? formatDateTime(state.gala_at) : 'Data a anunciar',
      active: idx >= 4 || galaOpen,
      done: false,
      to: galaOpen ? path('/gala') : undefined,
    },
  ]
  return (
    <section>
      <SectionTitle eyebrow="O caminho até à gala" title="Três atos, um palco" />
      <ol className="relative mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <motion.li
            key={s.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.12, duration: 0.6 }}
            className={cn('card-gala flex items-center gap-4 p-5 sm:flex-col sm:text-center', s.active && 'shadow-gold-lg')}
          >
            <div
              className={cn(
                'grid h-12 w-12 shrink-0 place-items-center rounded-full border',
                s.active ? 'border-gold-300 bg-gold-400/20 text-gold-100' : s.done ? 'border-gold-600/50 text-gold-500' : 'border-white/10 text-gold-100/40',
              )}
            >
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 sm:justify-center">
                <span className="font-display text-lg text-gold-100">{s.title}</span>
                {s.active && <span className="rounded-full bg-cvp-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">Agora</span>}
                {s.done && <span className="text-[10px] uppercase tracking-widest text-gold-500">Concluído</span>}
              </div>
              <p className="mt-1 text-xs text-gold-100/55">{s.text}</p>
              {'to' in s && s.to && (
                <Link to={s.to} className="btn-gold btn-sm mt-3">
                  <Lock className="h-3.5 w-3.5" /> Abrir Modo Gala
                </Link>
              )}
            </div>
          </motion.li>
        ))}
      </ol>
    </section>
  )
}

// -------------------------------------------------------------- categories --

function Categories({ categories }: { categories: Category[] }) {
  return (
    <section>
      <SectionTitle eyebrow={`${categories.length} categorias`} title="Os prémios da noite" />
      {/* telemóvel: carrossel horizontal; computador: grelha */}
      <div className="no-scrollbar -mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 pb-4 pt-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
        {categories.map((c, i) => (
          <motion.article
            key={c.id}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ delay: (i % 3) * 0.1, duration: 0.6 }}
            className="card-gala group relative w-[78vw] max-w-xs shrink-0 snap-center overflow-hidden p-6 sm:w-auto sm:max-w-none"
          >
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold-400/10 blur-2xl transition group-hover:bg-gold-400/25" />
            <div className="absolute right-5 top-5 font-display text-5xl font-bold text-gold-400/10">{String(i + 1).padStart(2, '0')}</div>
            <CategoryMedallion icon={c.icon} />
            <h3 className="mt-5 font-display text-xl leading-tight text-gold-50">{c.name}</h3>
            <p className="mt-3 text-sm leading-relaxed text-gold-50/60">{c.description}</p>
            <div className="divider-gold mt-5 opacity-40" />
          </motion.article>
        ))}
      </div>
    </section>
  )
}

// ------------------------------------------------------------ how it works --

function HowItWorks() {
  const items = [
    { icon: Hash, title: 'Número de membro', text: 'Entre com o seu número de membro da CVP. Sem contas, sem palavras-passe.' },
    { icon: MousePointerClick, title: 'Escolha', text: 'Um colega por categoria. Comece a escrever o nome e nós encontramos.' },
    { icon: ShieldCheck, title: 'Confirme', text: 'Reveja as suas escolhas e submeta tudo de uma só vez.' },
    {
      icon: Lock,
      title: 'Voto fechado',
      text: 'Depois de submeter, os votos já não podem ser alterados e o seu número fica desativado até à 2ª fase, onde volta a votar.',
    },
  ]
  return (
    <section>
      <SectionTitle eyebrow="Como votar" title="Simples, rápido e secreto" />
      <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((it, i) => (
          <div key={it.title} className="flex gap-4 rounded-2xl border border-white/5 bg-white/[.02] p-5">
            <div className="font-display text-3xl text-gold-500/60">{i + 1}</div>
            <div>
              <div className="flex items-center gap-2 font-semibold text-gold-100">
                <it.icon className="h-4 w-4 text-gold-400" /> {it.title}
              </div>
              <p className="mt-1 text-sm text-gold-50/60">{it.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 flex max-w-2xl items-start gap-3 rounded-2xl border border-l-2 border-white/10 border-l-cvp-500/70 bg-white/[.03] p-5 text-sm text-gold-50/70">
        <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
        <p>
          <strong className="text-gold-50">O seu voto é anónimo.</strong> O sistema regista apenas que o seu número já votou, nunca em quem votou. Nem os
          administradores conseguem ver as escolhas de cada pessoa.
        </p>
      </div>
      <p className="mt-8 flex items-center justify-center gap-2 text-xs text-gold-100/40">
        <CalendarClock className="h-3.5 w-3.5" /> Horas de Portugal continental
      </p>
    </section>
  )
}

export function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <div className="eyebrow">{eyebrow}</div>
      <h2 className="mt-2 font-display text-3xl text-gold-50 sm:text-4xl">{title}</h2>
      <div className="divider-gold mx-auto mt-4 max-w-[10rem]" />
    </div>
  )
}

export function ConnectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <Trophy className="mx-auto h-28 w-20 opacity-60" glow={false} />
      <h2 className="mt-6 font-display text-2xl text-gold-100">Sem ligação ao servidor</h2>
      <p className="mt-2 text-sm text-gold-50/60">Verifique a sua ligação à internet e tente novamente.</p>
      <p className="mt-1 text-xs text-gold-50/30">{message}</p>
      <button onClick={onRetry} className="btn-gold mt-6">
        Tentar novamente
      </button>
    </div>
  )
}
