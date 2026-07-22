/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user || session.demo) return;
    supabase.from('users').select('*').eq('id', session.user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [session]);

  async function refreshProfile() {
    if (!session?.user || session.demo) return;
    const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single();
    if (data) setProfile(data);
    return data;
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    const { data: prof } = await supabase.from('users').select('*').eq('id', data.user.id).single();
    setProfile(prof);
    return { role: prof?.role };
  }

  // role is 'trainer' | 'customer'; the DB trigger (migration 0056) maps those
  // onto the internal 'coach' / 'player' enum values and refuses anything else.
  async function signUp({ name, email, password, role, consent, consentVersion, inviteCode }) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: {
        name,
        role: role || 'customer',
        consent: !!consent,
        consent_version: consentVersion || null,
        invite_code: inviteCode || null,
      } },
    });
    if (error) return { error: error.message };
    return { needsConfirmation: !data.session, role };
  }

  function logout() {
    setSession(null);
    setProfile(null);
    supabase.auth.signOut().catch(() => {});
  }

  return (
    <AuthContext.Provider value={{
      session, profile, role: profile?.role, loading,
      signIn, signUp, logout, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
