import type { ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AuthScreen } from './components/auth/AuthScreen';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { DisposPage } from './pages/DisposPage';
import { PlanningPage } from './pages/PlanningPage';
import { StatistiquesPage } from './pages/StatistiquesPage';
import { AgentsPage } from './pages/AgentsPage';
import { GardesPage } from './pages/GardesPage';
import { VehiculesPage } from './pages/VehiculesPage';
import { ReferentielsPage } from './pages/ReferentielsPage';
import { AgentProfilePage } from './pages/AgentProfilePage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { MentionsLegalesPage } from './pages/legal/MentionsLegalesPage';
import { ConfidentialitePage } from './pages/legal/ConfidentialitePage';
import { CguPage } from './pages/legal/CguPage';
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
          <Route path="/habillement" element={<ComingSoonPage title="Habillement" />} />
          <Route path="/mecanique" element={<ComingSoonPage title="Mécanique" />} />
          <Route path="/inventaire" element={<ComingSoonPage title="Inventaire" />} />
          <Route path="/revision" element={<ComingSoonPage title="Révision" />} />
          <Route path="*" element={<Navigate to="/dispos" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
