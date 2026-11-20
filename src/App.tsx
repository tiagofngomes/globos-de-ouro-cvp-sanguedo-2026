import confetti from 'canvas-confetti'
import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ApiProvider } from './api/ApiContext'
import { isSupabaseConfigured } from './api/supabaseApi'
import { PublicLayout } from './components/layout/PublicLayout'
import { FullPageLoader, ToastProvider } from './components/ui/Feedback'
import { HomePage } from './pages/HomePage'
import { VotePage } from './pages/VotePage'
import { ResultsPage } from './pages/ResultsPage'

// A área de administração e o Modo Gala só são descarregados quando usados
// (a maioria das pessoas vota no telemóvel e não precisa deste código).
const AdminArea = lazy(() => import('./pages/admin/AdminArea'))
const GalaArea = lazy(() => import('./pages/admin/AdminArea').then((m) => ({ default: m.GalaArea })))

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

export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <RouteEffects />
        <Routes>
          <Route
            path="/demo/*"
            element={
              <ApiProvider mode="demo">
                <ModeRoutes />
              </ApiProvider>
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
    </ToastProvider>
  )
}
