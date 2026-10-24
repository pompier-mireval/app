import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { fetchCurrentAgent } from '../api/agents';
import { invalidateCache } from '../lib/cache';
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

let lastUserId: string | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [realAgent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentLoading, setAgentLoading] = useState(false);
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

  // Deux déclencheurs au démarrage (getSession et onAuthStateChange) : on
  // partage la même requête, et un échec ponctuel (réseau, jeton en cours
  // de renouvellement) ne doit ni effacer un agent déjà chargé ni afficher
  // « compte non relié » : on réessaie une fois avant d'abandonner.
  const loadingAgent = useRef<Promise<void> | null>(null);

  function loadAgent(): Promise<void> {
    if (loadingAgent.current) return loadingAgent.current;
    const run = async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          setAgent(await fetchCurrentAgent());
          return;
        } catch {
          // L'agent peut ne pas encore exister si l'email n'est pas
          // reconnu par le trigger de création automatique côté base.
          if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
        }
      }
      setAgent((current) => current ?? null);
    };
    setAgentLoading(true);
    loadingAgent.current = run().finally(() => {
      loadingAgent.current = null;
      setAgentLoading(false);
    });
    return loadingAgent.current;
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      lastUserId = data.session?.user.id ?? null;
      setSession(data.session);
      // On attend la fiche agent avant de lever `loading` : sans ça, une route
      // réservée (Véhicules, Agents…) ouverte directement voyait « pas d'agent »
      // et redirigeait vers Mes dispos avant que l'agent ne soit chargé.
      if (data.session) await loadAgent();
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // Données filtrées par utilisateur (RLS) : on repart d'un cache vide si ça change.
      const userId = newSession?.user.id ?? null;
      if (userId !== lastUserId) {
        lastUserId = userId;
        invalidateCache();
      }
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
    // Lève aussi le drapeau posé à la création du compte (mot de passe provisoire).
    const { error } = await supabase.auth.updateUser({ password: newPassword, data: { must_change_password: false } });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value: AuthContextValue = {
    session,
    agent,
    // Connexion en cours (session reçue, fiche agent pas encore là) : même état d'attente.
    loading: loading || (!!session && !realAgent && agentLoading),
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
