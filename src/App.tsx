import { lazy } from 'react';
import type { ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AuthScreen } from './components/auth/AuthScreen';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { DisposPage } from './pages/DisposPage';
const PlanningPage = lazy(() => import('./pages/PlanningPage').then((m) => ({ default: m.PlanningPage })));
const StatistiquesPage = lazy(() => import('./pages/StatistiquesPage').then((m) => ({ default: m.StatistiquesPage })));
const AgentsPage = lazy(() => import('./pages/AgentsPage').then((m) => ({ default: m.AgentsPage })));
const GardesPage = lazy(() => import('./pages/GardesPage').then((m) => ({ default: m.GardesPage })));
const VehiculesPage = lazy(() => import('./pages/VehiculesPage').then((m) => ({ default: m.VehiculesPage })));
const ReferentielsPage = lazy(() => import('./pages/ReferentielsPage').then((m) => ({ default: m.ReferentielsPage })));
const AgentProfilePage = lazy(() => import('./pages/AgentProfilePage').then((m) => ({ default: m.AgentProfilePage })));
const BatimentPage = lazy(() => import('./pages/BatimentPage').then((m) => ({ default: m.BatimentPage })));
const ControlePage = lazy(() => import('./pages/ControlePage').then((m) => ({ default: m.ControlePage })));
const HabillementPage = lazy(() => import('./pages/HabillementPage').then((m) => ({ default: m.HabillementPage })));
const MecaniquePage = lazy(() => import('./pages/MecaniquePage').then((m) => ({ default: m.MecaniquePage })));
const RevisionPage = lazy(() => import('./pages/RevisionPage').then((m) => ({ default: m.RevisionPage })));
import { MentionsLegalesPage } from './pages/legal/MentionsLegalesPage';
import { ConfidentialitePage } from './pages/legal/ConfidentialitePage';
import { CguPage } from './pages/legal/CguPage';
import { ChangePasswordScreen } from './components/auth/ChangePasswordScreen';
import { Spinner } from './components/ui/Primitives';

// Les pages légales doivent rester accessibles sans session (l'écran de
// connexion, lui, est public) : ce garde protège uniquement les routes de
// l'application elle-même, pas les routes légales définies plus bas.
function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-state">
        <Spinner />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  // Compte créé par un superadmin avec un mot de passe provisoire.
  if (session.user.user_metadata?.must_change_password) {
    return <ChangePasswordScreen />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
        <Route path="/confidentialite" element={<ConfidentialitePage />} />
        <Route path="/cgu" element={<CguPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dispos" replace />} />
          <Route path="/dispos" element={<DisposPage />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route
            path="/statistiques"
            element={
              <ProtectedRoute minNiveau="admin">
                <StatistiquesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agents"
            element={
              <ProtectedRoute minNiveau="admin">
                <AgentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gardes"
            element={
              <ProtectedRoute minNiveau="superadmin">
                <GardesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vehicules"
            element={
              <ProtectedRoute minNiveau="superadmin">
                <VehiculesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/referentiels"
            element={
              <ProtectedRoute minNiveau="superadmin">
                <ReferentielsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/profil" element={<AgentProfilePage own />} />
          <Route path="/agents/:id" element={<AgentProfilePage />} />
          <Route path="/habillement" element={<HabillementPage />} />
          <Route path="/mecanique" element={<MecaniquePage />} />
          <Route path="/inventaire" element={<ControlePage key="inventaire" famille="inventaire" />} />
          <Route path="/batiment" element={<BatimentPage />} />
          <Route path="/petit-materiel" element={<ControlePage key="materiel" famille="materiel" />} />
          <Route path="/verification" element={<ControlePage key="verification" famille="verification" />} />
          <Route path="/revision" element={<RevisionPage />} />
          <Route path="*" element={<Navigate to="/dispos" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
