import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { fetchCurrentAgent } from '../api/agents';
import type { Agent } from '../lib/types';

interface AuthContextValue {
  session: Session | null;
  agent: Agent | null;
  loading: boolean;
  sendMagicLink: (email: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAgent: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé sous AuthProvider');
  return ctx;
}
