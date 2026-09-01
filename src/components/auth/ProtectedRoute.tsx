import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { NiveauAcces } from '../../lib/types';

const RANK: Record<NiveauAcces, number> = {
  utilisateur: 0,
  admin: 1,
  superadmin: 2,
};

interface Props {
  minNiveau: NiveauAcces;
  children: React.ReactNode;
}

// Rappel : masquer un lien ou rediriger ici est un confort d'UX, pas une
// protection. La vraie barrière, c'est la policy RLS côté Supabase — même
// si quelqu'un contourne cette route, la requête à la base sera rejetée.
export function ProtectedRoute({ minNiveau, children }: Props) {
  const { agent, loading } = useAuth();

  if (loading) return null;
  if (!agent) return <Navigate to="/" replace />;

  const hasAccess = RANK[agent.niveau_acces] >= RANK[minNiveau];
  if (!hasAccess) return <Navigate to="/dispos" replace />;

  return <>{children}</>;
}
