import { BarChart3, CalendarCog, FlaskConical, LayoutDashboard, LogOut, Presentation, Tags, Trophy, UserRound, Users } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApi, usePath } from '../../api/ApiContext'
import type { AdminOverview } from '../../api/types'
import { subscribeDemo } from '../../demo/demoApi'
import { cn } from '../../lib/cn'
import { PHASE_LABELS } from '../../lib/phases'
import { GalaBackground } from '../layout/GalaBackground'
import { CvpBrand } from '../ui/CvpBrand'
import { FullPageLoader } from '../ui/Feedback'
import { AdminLogin } from './AdminLogin'

interface AdminCtx {
  overview: AdminOverview | null
  reload: () => Promise<void>
}
const Ctx = createContext<AdminCtx>({ overview: null, reload: async () => {} })
export const useAdmin = () => useContext(Ctx)

/** Protege a área de administração: exige sessão de administrador. */
export function AdminGate({ children, loginSubtitle }: { children: ReactNode; loginSubtitle?: string }) {
  const { api } = useApi()
  const [status, setStatus] = useState<'loading' | 'in' | 'out'>('loading')

  const check = useCallback(async () => {
    try {
      const email = await api.admin.getSessionEmail()
      setStatus(email && (await api.admin.isAdmin()) ? 'in' : 'out')
    } catch {
      setStatus('out')
    }
  }, [api])

  useEffect(() => {
    check()
  }, [check])

  if (status === 'loading') return <FullPageLoader label="A verificar credenciais…" />
  if (status === 'out') return <AdminLogin subtitle={loginSubtitle} onSuccess={() => setStatus('in')} />
  return <>{children}</>
}

const NAV = [
  { to: '', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/resultados', label: 'Resultados', icon: BarChart3 },
  { to: '/finalistas', label: 'Finalistas', icon: Trophy },
  { to: '/membros', label: 'Votantes', icon: Users },
  { to: '/candidatos', label: 'Nomeados', icon: UserRound },
  { to: '/categorias', label: 'Categorias', icon: Tags },
  { to: '/definicoes', label: 'Datas e fases', icon: CalendarCog },
]

export function AdminLayout() {
  const { api, isDemo } = useApi()
  const path = usePath()
  const navigate = useNavigate()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setOverview(await api.admin.overview())
    } catch {
      /* mantém o último valor */
    }
  }, [api])

  useEffect(() => {
    reload()
    api.admin.getSessionEmail().then(setEmail)
    const id = setInterval(reload, 15_000)
    const unsub = isDemo ? subscribeDemo(reload) : undefined
    return () => {
      clearInterval(id)
      unsub?.()
    }
  }, [api, reload, isDemo])

  const signOut = async () => {
    await api.admin.signOut()
    navigate(path('/'))
  }

  const base = path('/admin')

  return (
    <Ctx.Provider value={{ overview, reload }}>
      <div className="relative min-h-[100dvh]">
        <GalaBackground intensity={0.5} />
        {isDemo && (
          <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-cvp-600/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
            <FlaskConical className="h-3.5 w-3.5" /> Administração · demonstração
          </div>
        )}
        <div className="mx-auto flex max-w-7xl gap-6 px-4 pb-24 pt-4 sm:px-6 lg:pb-10 lg:pt-6">
          {/* barra lateral (computador) */}
          <aside className="sticky top-6 hidden h-[calc(100dvh-5rem)] w-60 shrink-0 flex-col lg:flex">
            <Link to={path('/')}>
              <CvpBrand compact />
            </Link>
            <div className="mt-2 font-display text-sm text-gold-300">Globos de Ouro · Admin</div>
            <nav className="mt-8 flex flex-col gap-1">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={base + n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                      isActive ? 'bg-gold-400/15 text-gold-50 shadow-gold' : 'text-gold-100/60 hover:bg-white/5 hover:text-gold-100',
                    )
                  }
                >
                  <n.icon className="h-4 w-4" /> {n.label}
                </NavLink>
              ))}
              <Link to={path('/gala')} className="btn-red btn-sm mt-4">
                <Presentation className="h-4 w-4" /> Modo Gala
              </Link>
            </nav>
            <div className="mt-auto space-y-3 text-xs text-gold-100/50">
              {overview && <PhaseBadge phase={overview.phase} />}
              <div className="truncate">{email}</div>
              <button onClick={signOut} className="flex items-center gap-2 hover:text-gold-100">
                <LogOut className="h-3.5 w-3.5" /> Terminar sessão
              </button>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {/* cabeçalho (telemóvel) */}
            <div className="mb-4 flex items-center justify-between lg:hidden">
              <CvpBrand compact />
              <div className="flex items-center gap-2">
                <Link to={path('/gala')} className="btn-red btn-sm px-3" aria-label="Modo Gala">
                  <Presentation className="h-4 w-4" />
                </Link>
                <button onClick={signOut} className="btn-ghost btn-sm px-3" aria-label="Terminar sessão">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
            <Outlet />
          </div>
        </div>

        {/* navegação inferior (telemóvel) */}
        <nav className="no-scrollbar safe-bottom fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto overflow-y-hidden overscroll-x-contain border-t border-gold-400/15 bg-gala-950/95 px-2 backdrop-blur-xl lg:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={base + n.to}
              end={n.end}
              className={({ isActive }) =>
                cn('flex min-w-[4.6rem] flex-1 flex-col items-center gap-1 px-1 pt-2.5 text-[10px]', isActive ? 'text-gold-200' : 'text-gold-100/45')
              }
            >
              <n.icon className="h-5 w-5" />
              <span className="whitespace-nowrap">{n.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </Ctx.Provider>
  )
}

export function PhaseBadge({ phase }: { phase: AdminOverview['phase'] }) {
  const live = phase === 'phase1' || phase === 'phase2'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]',
        live ? 'border-cvp-500/50 bg-cvp-500/15 text-red-100' : 'border-gold-400/30 bg-gold-400/10 text-gold-200',
      )}
    >
      {live && <span className="h-2 w-2 animate-pulse rounded-full bg-cvp-400" />}
      {PHASE_LABELS[phase].short}
    </span>
  )
}

export function AdminPageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl text-gold-50 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gold-100/55">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({ title, children, className, actions }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cn('card-gala p-5 sm:p-6', className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-lg text-gold-100">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}
