import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminGate, AdminLayout } from '../../components/admin/AdminLayout'
import { GalaPage } from '../GalaPage'
import { CandidatesPage } from './CandidatesPage'
import { CategoriesPage } from './CategoriesPage'
import { DashboardPage } from './DashboardPage'
import { FinalistsPage } from './FinalistsPage'
import { MembersPage } from './MembersPage'
import { ResultsAdminPage } from './ResultsAdminPage'
import { SettingsPage } from './SettingsPage'

export default function AdminArea() {
  return (
    <AdminGate>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="resultados" element={<ResultsAdminPage />} />
          <Route path="finalistas" element={<FinalistsPage />} />
          <Route path="membros" element={<MembersPage />} />
          <Route path="candidatos" element={<CandidatesPage />} />
          <Route path="categorias" element={<CategoriesPage />} />
          <Route path="definicoes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Route>
      </Routes>
    </AdminGate>
  )
}

export function GalaArea() {
  return (
    // entra direto no Modo Gala, sem mostrar o menu do painel
    <AdminGate loginSubtitle="Entre para abrir o Modo Gala">
      <GalaPage />
    </AdminGate>
  )
}
