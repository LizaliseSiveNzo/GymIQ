import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CalorieBankCard from '../../components/ui/CalorieBankCard.jsx';
import TabShell from '../../shell/TabShell.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {queueStore} from '../../lib/logQueue.js';
import { supabase } from '../../lib/supabaseClient.js';

async function functionError(error, fallback) {
  try { return (await error.context.json()).error || fallback; } catch { return error?.message || fallback; }
}
export default function MoreMenu() {
  const { profile, logout, refreshProfile } = useAuth();
  const [params] = useSearchParams();
  const [member, setMember] = useState(null);
  const [name, setName] = useState(profile?.name || '');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const checkoutId = useRef(null);
  const ticketId = useRef(null);

  async function loadMember() {
    const { data, error } = await supabase.rpc('ensure_membership');
    if (error) throw error;
    setMember(Array.isArray(data) ? data[0] : data);
  }
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase.rpc('ensure_membership');
      if (!active) return;
      if (error) setError('Could not load your membership. Please refresh the page.');
      else setMember(Array.isArray(data) ? data[0] : data);
    };
    load();
    let attempts = 0;
    const interval = params.get('payment') === 'processing' ? setInterval(() => {
      if (++attempts >= 12) clearInterval(interval);
      load();
    }, 3000) : null;
    return () => { active = false; if (interval) clearInterval(interval); };
  }, [profile?.id, params]);

  async function run(key, action) {
    if (busy) return;
    setBusy(key); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(e.message || 'Please try again.'); } finally { setBusy(''); }
  }
  const active = member && new Date(member.expires_at) > new Date();
  async function checkout() {
    checkoutId.current ||= crypto.randomUUID();
    const { data, error } = await supabase.functions.invoke('yoco-checkout', { body: { requestId: checkoutId.current } });
    if (error) throw new Error(await functionError(error, 'Checkout is unavailable. Please try again.'));
    const url = new URL(data.redirectUrl);
    if (url.protocol !== 'https:' || !(url.hostname === 'yoco.com' || url.hostname.endsWith('.yoco.com'))) throw new Error('Invalid checkout address.');
    window.location.assign(url.href);
  }
  async function exportData() {
    const { data, error } = await supabase.rpc('export_my_data');
    if (error) throw error;
    const pending_device_logs=await queueStore.list(profile.id);
    const url = URL.createObjectURL(new Blob([JSON.stringify({ pending_device_logs, exported_at: new Date().toISOString(), data }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'gymiq-data.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Your data export has been downloaded.');
  }
  async function deleteAccount() {
    const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirmation } });
    if (error) throw new Error(await functionError(error, 'Account deletion failed. Please contact support.'));
    if (!data.deleted) throw new Error('Deletion has not completed.');
    for (const key of Object.keys(localStorage)) if (key.startsWith(`gymiq_session_${profile.id}_`)) localStorage.removeItem(key);
    try{for(const entry of await queueStore.list(profile.id))await queueStore.remove(entry.id,profile.id);}catch{/* Browser storage may be unavailable. */}
    await logout();
    window.location.assign('/login');
  }
  async function support(e) {
    e.preventDefault();
    await run('support', async () => {
      ticketId.current ||= crypto.randomUUID();
      const { error } = await supabase.from('support_requests').insert({ id: ticketId.current, user_id: profile.id, subject: subject.trim(), message: message.trim() });
      if (error && error.code !== '23505') throw error;
      await supabase.functions.invoke('support-notify', { body: { ticketId: ticketId.current } });
      setNotice(`Support request saved. Your reference: ${ticketId.current}. You can find it in your data export.`);
      ticketId.current = null; setSubject(''); setMessage('');
    });
  }
  return <TabShell title="Your account" showKicker={false}>
    {error && <div className="inline-error" role="alert">{error}</div>}
    {notice && <p className="mf-card" role="status">{notice}</p>}
    {params.get('payment') === 'processing' && <p className="mf-card" role="status">We are checking your payment with Yoco. Access updates after payment is confirmed. If it takes longer, use “Refresh status” or contact support.</p>}
    {['cancelled','failed'].includes(params.get('payment')) && <p className="mf-card">Checkout was {params.get('payment')}. Your membership has not changed.</p>}
    <section className="training-program account-panel">
      <span className="launch-eyebrow">GYMIQ MEMBERSHIP</span>
      <h2>{!member ? 'Checking membership…' : active ? member.kind === 'paid' ? 'You’re all set.' : 'Your free trial is active.' : 'Ready for your next chapter?'}</h2>
      {member && <p>{active ? 'Access until' : 'Access ended'} {new Date(member.expires_at).toLocaleDateString('en-ZA', { day:'numeric', month:'long', year:'numeric' })}.</p>}
      <div className="membership-price">R100 <small>/ 30 days</small></div>
      <p>Workouts + Calorie Bank. Renew manually through Yoco. No automatic debit. Early renewals add 30 days to your remaining access.</p>
      <button className="btn btn-primary btn-block" disabled={!!busy} onClick={() => run('checkout', checkout)}>{busy === 'checkout' ? 'Opening Yoco…' : active && member?.kind === 'paid' ? 'Add 30 days with Yoco ↗' : 'Get 30 days with Yoco ↗'}</button>
      <button className="btn btn-ghost" disabled={!!busy} onClick={() => run('refresh', loadMember)}>Refresh status</button>
      {!active && member && <Link to="/workout/history" className="btn btn-ghost">View workout history</Link>}
    </section>
    <section className="mf-card account-panel"><h2>Profile</h2><p>{profile?.email}</p><form onSubmit={e => { e.preventDefault(); run('profile', async () => {
      const { error } = await supabase.from('users').update({ name: name.trim() }).eq('id', profile.id);
      if (error) throw error; await refreshProfile(); setNotice('Profile updated.');
    }); }}><label className="label" htmlFor="account-name">Your name</label><input id="account-name" className="input" value={name} required maxLength={100} onChange={e => setName(e.target.value)} /><button className="btn btn-secondary" disabled={!!busy}>Save profile</button></form></section>
    <section className="mf-card account-panel"><h2>Your training</h2><div className="list-card"><Link className="list-row" to="/workout/stats">Exercise stats & PRs <span className="grow" />↗</Link><Link className="list-row" to="/workout/history">Workout history <span className="grow" />↗</Link><Link className="list-row" to="/exercises">Exercise library <span className="grow" />↗</Link><Link className="list-row" to="/onboarding?new=1">Build a new programme <span className="grow" />↗</Link></div></section>
    <section className="account-panel" aria-label="Calorie Bank overview"><CalorieBankCard userId={profile?.id}/></section>
    <details className="mf-card account-panel"><summary>Optional make-up exercises</summary><p>Missed exercises from the previous full week are spread across unstarted sessions. Up to 4 extras per session, 8 across the week, and at most 2 sets each.</p><p>Extras expire with the week and never build into a backlog. Remove any extra from its session if it does not suit your recovery.</p></details>
    <section className="mf-card account-panel"><h2>Support & billing help</h2><p>Ask about your account, a payment, a refund or your data. Please leave out passwords, card details and medical information. Email <a href="mailto:Lizalisenzo@gmail.com">Lizalisenzo@gmail.com</a>, or send your request below.</p><form onSubmit={support}><label className="label" htmlFor="support-subject">Subject</label><input id="support-subject" className="input" required minLength={3} maxLength={160} value={subject} onChange={e => setSubject(e.target.value)} /><label className="label" htmlFor="support-message">How can we help?</label><textarea id="support-message" className="input" required minLength={10} maxLength={5000} rows={4} value={message} onChange={e => setMessage(e.target.value)} /><button className="btn btn-secondary" disabled={!!busy}>{busy === 'support' ? 'Saving…' : 'Submit support request'}</button></form></section>
    <section className="mf-card account-panel"><h2>Your data, in your hands</h2><p>Download your account, workout and Calorie Bank records as a JSON file.</p><button className="btn btn-secondary" disabled={!!busy} onClick={() => run('export', exportData)}>{busy === 'export' ? 'Preparing export…' : 'Export my data'}</button><p><Link to="/privacy">Privacy & membership terms ↗</Link></p></section>
    <details className="mf-card account-panel"><summary>Delete account</summary><p>This permanently deletes your GymIQ account, workout logs, Calorie Bank and uploaded files. Download your data first. Any remaining membership access will end.</p><label className="label" htmlFor="delete-confirmation">Type DELETE to confirm</label><input id="delete-confirmation" className="input" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" /><button className="btn btn-secondary" style={{ color: 'var(--danger)' }} disabled={!!busy || confirmation !== 'DELETE'} onClick={() => run('delete', deleteAccount)}>{busy === 'delete' ? 'Deleting…' : 'Permanently delete account'}</button></details>
    <button className="btn btn-ghost btn-block" disabled={!!busy} onClick={() => run('logout', logout)}>Sign out</button>
  </TabShell>;
}
