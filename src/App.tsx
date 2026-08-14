import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import SuperAdminLayout from './components/layout/SuperAdminLayout'
import SuperAdminGlobal from './pages/SuperAdminGlobal'
import SuperAdminAgences from './pages/SuperAdminAgences'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Onboarding from './pages/Onboarding'
import Membres from './pages/Membres'
import Groupes from './pages/Groupes'
import Pelerins from './pages/Pelerins'
import PelerinDetail from './pages/PelerinDetail'
import Documents from './pages/Documents'
import Paiements from './pages/Paiements'
import Dashboard from './pages/Dashboard'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/onboarding" element={<Onboarding />} />
              <Route element={<SuperAdminLayout />}>
                <Route path="/superadmin" element={<SuperAdminGlobal />} />
                <Route path="/superadmin/agences" element={<SuperAdminAgences />} />
              </Route>
              <Route element={<AppLayout />}>
                <Route path="/membres" element={<Membres />} />
                <Route path="/liste-des-groupes" element={<Groupes />} />
                <Route path="/liste-des-pelerins" element={<Pelerins />} />
                <Route path="/details-du-pelerin/:id" element={<PelerinDetail />} />
                <Route path="/gestion-des-documents" element={<Documents />} />
                <Route path="/paiements-echeanciers" element={<Paiements />} />
                <Route path="/tableau-de-bord" element={<Dashboard />} />
                <Route path="*" element={<Navigate to="/tableau-de-bord" replace />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}