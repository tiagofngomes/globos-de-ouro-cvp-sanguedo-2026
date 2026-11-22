import { FlaskConical } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useApi, usePath } from '../../api/ApiContext'
import { CvpBrand, CvpCross } from '../ui/CvpBrand'
import { GalaBackground } from './GalaBackground'
import { DemoControls } from './DemoControls'

export function PublicLayout() {
  const { isDemo } = useApi()
  const path = usePath()
  const { pathname } = useLocation()
  const onHome = pathname === '/' || pathname === '/demo'
  // durante a votação o rodapé sai de cena: a barra de botões fixa fica limpa
  const voting = pathname.endsWith('/votar')

  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <GalaBackground />
      {isDemo && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-cvp-600/95 px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur">
          <FlaskConical className="h-3.5 w-3.5" /> Modo demonstração · votos fictícios
        </div>
      )}
      <header className="relative z-30 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-4 sm:px-6 sm:pt-6">
        <Link to={path('/')} aria-label="Início">
          <CvpBrand compact />
        </Link>
        {!onHome && (
          <Link to={path('/')} className="btn-ghost btn-sm">
            Início
          </Link>
        )}
      </header>

      <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-10 sm:px-6">
        <Outlet />
      </main>

      {!voting && (
        <footer className="safe-bottom relative border-t border-gold-400/10 px-4 py-6 text-center text-[11px] text-gold-100/40">
          <div className="mb-2 flex items-center justify-center gap-2">
            <CvpCross className="h-3 w-3" />
            <span className="uppercase tracking-[0.25em]">
              Humanidade · Imparcialidade · Neutralidade · Independência · Voluntariado · Unidade · Universalidade
            </span>
          </div>
          <p>Globos de Ouro CVP Sanguedo 2026 · O seu voto é secreto e anónimo.</p>
          {/* só na página inicial */}
          {onHome && <p className="mt-2">Website desenvolvido por Tiago Gomes</p>}
          <p className="mt-2">
            {isDemo ? (
              <Link to="/" className="underline decoration-gold-400/30 underline-offset-4 hover:text-gold-200">
                Sair da demonstração
              </Link>
            ) : (
              <Link to={path('/admin')} className="hover:text-gold-200">
                Área reservada
              </Link>
            )}
          </p>
        </footer>
      )}
      {isDemo && <DemoControls />}
    </div>
  )
}
