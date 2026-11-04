/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import {signupReferral} from '../lib/referrals.js';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase,storedSession,clearStoredSession } from '../lib/supabaseClient.js';
import {readView,saveView,clearViews,profileSnapshot} from '../lib/deviceCache.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [boot] = useState(()=>{const session=storedSession();return {session,profile:readView(session?.user?.id,'profile')?.data||null};});
  const [session, setSession] = useState(boot.session);
  const [profile, setProfile] = useState(boot.profile);
  const [profileError, setProfileError] = useState(null);
  const [loading, setLoading] = useState(!boot.session);
  const currentUser=useRef(boot.session?.user?.id);

  useEffect(() => {
    let active=true;
    supabase.auth.getSession().then(({data})=>{
      if(!active)return;
      // A failed offline refresh must not hide an already saved local view.
      if(data.session||navigator.onLine||!boot.session)setSession(data.session);
      setLoading(false);
    }).catch(()=>{if(active)setLoading(false);});
    const {data:sub}=supabase.auth.onAuthStateChange((event,next)=>{
      if(!active)return;
      if(event==='SIGNED_OUT'){
        clearViews(currentUser.current);currentUser.current=null;setSession(null);setProfile(null);
      }else if(next||navigator.onLine||!boot.session){currentUser.current=next?.user?.id;setSession(next);}
      setLoading(false);
    });
    return()=>{active=false;sub.subscription.unsubscribe();};
  }, [boot]);

  const userId=session?.user?.id;
  useEffect(()=>{
    if(!userId){setProfile(null);return;}
    let active=true;
    const saved=readView(userId,'profile')?.data;
    setProfile(previous=>previous?.id===userId?previous:saved||null);
    setProfileError(null);
    async function load(){
      if(!navigator.onLine){if(!saved)setProfileError('Open GymIQ online once on this device to save your profile.');return;}
      const {data,error}=await supabase.from('users').select('*').eq('id',userId).single();
      if(!active)return;
      if(error){if(!saved)setProfileError('Could not load your profile. Connect and retry.');return;}
      if(data){saveView(userId,'profile',profileSnapshot(data));setProfile(data);}
      else{clearViews(userId);setProfile(null);setProfileError('No profile found for this account.');}
    }
    void load().catch(()=>{if(active&&!saved)setProfileError('Could not load your profile. Connect and retry.');});
    window.addEventListener('online',load);
    return()=>{active=false;window.removeEventListener('online',load);};
  },[userId]);

  async function refreshProfile() {
    if (!session?.user || session.demo) return;
    const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single();
    if (data) {saveView(data.id,'profile',profileSnapshot(data));setProfile(data);}
    return data;
  }

  // Never let a raw/empty error object reach the UI (it renders as "{}").
  const errMsg = (e, fallback) => e?.message || e?.error_description || (typeof e === 'string' ? e : '') || fallback;

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: errMsg(error, 'Could not sign in. Check your email and password.') };
    const { data: prof } = await supabase.from('users').select('*').eq('id', data.user.id).single();
    if(prof)saveView(prof.id,'profile',profileSnapshot(prof));
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
        referral_source: signupReferral(),
      } },
    });
    if (error) return { error: errMsg(error, 'Could not create your account.') };
    // Supabase obfuscates an already-registered email: it returns a user with an
    // empty identities array and no session, instead of an error. Detect that and
    // tell the person to sign in rather than showing a confusing empty result.
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: 'That email is already registered — please sign in instead.' };
    }
    return { needsConfirmation: !data.session, role };
  }

  async function logout() {
    clearViews(session?.user?.id);clearStoredSession();setSession(null);setProfile(null);
    // Local state clears immediately, including when the server is unreachable.
    void supabase.auth.signOut({scope:'local'}).catch(()=>{});
  }

  return (
    <AuthContext.Provider value={{
      session, profile, profileError, role: profile?.role, loading,
      signIn, signUp, logout, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
