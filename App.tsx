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
import { Spinner } from './components/ui/Primitives';

export default function App() {
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

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dispos" replace />} />
          <Route path="/dispos" element={<DisposPage />} />
          <Route
            path="/planning"
            element={
              <ProtectedRoute minNiveau="admin">
                <PlanningPage />
              </ProtectedRoute>
            }
          />
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
