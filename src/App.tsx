import confetti from 'canvas-confetti'
import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ApiProvider } from './api/ApiContext'
import { isSupabaseConfigured } from './api/supabaseApi'
import { PublicLayout } from './components/layout/PublicLayout'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { ConfirmProvider, FullPageLoader, ToastProvider } from './components/ui/Feedback'
import { importWithReload } from './lib/staleVersion'
import { HomePage } from './pages/HomePage'
import { VotePage } from './pages/VotePage'
import { ResultsPage } from './pages/ResultsPage'

// A área de administração e o Modo Gala só são descarregados quando usados
// (a maioria das pessoas vota no telemóvel e não precisa deste código).
// Se o site tiver sido atualizado entretanto, estes ficheiros podem já não existir:
// a página recarrega sozinha (uma vez) para usar a versão nova.
const AdminArea = lazy(importWithReload(() => import('./pages/admin/AdminArea')))
const GalaArea = lazy(importWithReload(() => import('./pages/admin/AdminArea').then((m) => ({ default: m.GalaArea }))))

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullPageLoader />}>{children}</Suspense>
}

/** Limpa confetis e volta ao topo a cada mudança de página. */
function RouteEffects() {
  const { pathname } = useLocation()
  useEffect(() => {
    confetti.reset()
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

/** Rotas comuns aos modos real e de demonstração. */
function ModeRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="votar" element={<VotePage />} />
        <Route path="resultados" element={<ResultsPage />} />
      </Route>
      <Route
        path="admin/*"
        element={
          <Lazy>
            <AdminArea />
          </Lazy>
        }
      />
      <Route
        path="gala"
        element={
          <Lazy>
            <GalaArea />
          </Lazy>
        }
      />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  )
}

/** Modo demonstração: só em desenvolvimento (ou se o Supabase não estiver configurado). */
const DEMO_ENABLED = import.meta.env.DEV || !isSupabaseConfigured

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <HashRouter>
            <RouteEffects />
            <Routes>
              <Route
                path="/demo/*"
                element={
                  // a demonstração só existe no computador de testes (npm run dev): no site
                  // publicado, quem abrir /#/demo vai para a página inicial real
                  DEMO_ENABLED ? (
                    <ApiProvider mode="demo">
                      <ModeRoutes />
                    </ApiProvider>
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="/*"
                element={
                  isSupabaseConfigured ? (
                    <ApiProvider mode="live">
                      <ModeRoutes />
                    </ApiProvider>
                  ) : (
                    // Sem Supabase configurado, só a demonstração está disponível.
                    <Navigate to="/demo" replace />
                  )
                }
              />
            </Routes>
          </HashRouter>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
