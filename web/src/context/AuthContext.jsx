import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Demo profiles so the app can be explored without real auth (Phase 1 replaces this).
export const DEMO_USERS = {
  admin:  { id: 'demo-admin',  name: 'Lizalise Nzo',   role: 'admin',  org: 'Tux Academy' },
  coach:  { id: 'demo-coach',  name: 'Coach Dlamini',  role: 'coach',  org: 'Tux Academy' },
  parent: { id: 'demo-parent', name: 'Mrs. Mokoena',   role: 'parent', org: 'Tux Academy' },
  player: { id: 'demo-player', name: 'Thabo Mokoena',  role: 'player', org: 'Tux Academy' },
};

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
    if (!session?.user || session.demo) return;      // demo sessions skip DB lookup
    supabase.from('users').select('*').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data));
  }, [session]);

  function demoLogin(role) {
    const user = DEMO_USERS[role];
    setProfile(user);
    setSession({ user: { id: user.id }, demo: true });
  }

  function logout() {
    setSession(null);
    setProfile(null);
    supabase.auth.signOut().catch(() => {});
  }

  return (
    <AuthContext.Provider value={{ session, profile, role: profile?.role, loading, demoLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
