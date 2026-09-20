import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { fetchCurrentAgent } from '../api/agents';
import type { Agent, NiveauAcces } from '../lib/types';

interface AuthContextValue {
  session: Session | null;
  agent: Agent | null;
  loading: boolean;
  sendMagicLink: (email: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAgent: () => Promise<void>;
  // Aperçu de rôle : purement visuel, réservé au superadmin (voir plus
  // bas). Ne change RIEN côté données — chaque requête Supabase reste
  // filtrée par les policies RLS selon le vrai niveau_acces en base, donc
  // "voir en tant qu'utilisateur" ne peut jamais servir à contourner une
  // restriction, seulement à vérifier ce qu'un rôle donné voit à l'écran.
  rolePreview: NiveauAcces | null;
  setRolePreview: (niveau: NiveauAcces | null) => void;
  // Niveau réel (jamais affecté par l'aperçu) — sert à décider qui a le
  // droit d'afficher le sélecteur d'aperçu, sans quoi le sélecteur
  // disparaîtrait dès qu'on prévisualise un rôle inférieur au sien.
  realNiveauAcces: NiveauAcces | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const ROLE_PREVIEW_KEY = 'rolePreview';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [realAgent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolePreview, setRolePreviewState] = useState<NiveauAcces | null>(
    () => (localStorage.getItem(ROLE_PREVIEW_KEY) as NiveauAcces | null) || null
  );

  function setRolePreview(niveau: NiveauAcces | null) {
    setRolePreviewState(niveau);
    if (niveau) localStorage.setItem(ROLE_PREVIEW_KEY, niveau);
    else localStorage.removeItem(ROLE_PREVIEW_KEY);
  }

  // Seul un vrai superadmin peut se prévisualiser dans un rôle moindre —
  // ça exclut à la fois "un utilisateur qui bidouille le localStorage pour
  // se voir en superadmin" (ignoré ici) et toute confusion sur qui a
  // réellement les droits en base.
  const agent: Agent | null =
    realAgent && realAgent.niveau_acces === 'superadmin' && rolePreview
      ? { ...realAgent, niveau_acces: rolePreview }
      : realAgent;

  async function loadAgent() {
    try {
      const a = await fetchCurrentAgent();
      setAgent(a);
    } catch {
      // L'agent peut ne pas encore exister si l'email n'est pas
      // reconnu par le trigger de création automatique côté base.
      setAgent(null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadAgent();
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) loadAgent();
      else setAgent(null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function sendMagicLink(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
  }

  // Utile en dev pour éviter la limite d'envoi d'emails, ou plus tard si
  // tu préfères garder un login classique pour certains comptes (ex: un
  // compte technique) en plus du magic link.
  async function signInWithPassword(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value: AuthContextValue = {
    session,
    agent,
    loading,
    sendMagicLink,
    signInWithPassword,
    updatePassword,
    signOut,
    refreshAgent: loadAgent,
    rolePreview,
    setRolePreview,
    realNiveauAcces: realAgent?.niveau_acces ?? null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé sous AuthProvider');
  return ctx;
}
