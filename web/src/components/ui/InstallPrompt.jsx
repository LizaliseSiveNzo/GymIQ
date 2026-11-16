import { useEffect, useState } from 'react';

// Subtle PWA install affordance. Chrome/Edge/Android use the native
// beforeinstallprompt; iOS Safari gets "Add to Home Screen" instructions.
// A dismissible hint appears after a few visits.
export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [hint, setHint] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (standalone) { setInstalled(true); return; }
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    try {
      const visits = Number(localStorage.getItem('gymiq_visits') || 0) + 1;
      localStorage.setItem('gymiq_visits', String(visits));
      if (visits >= 3 && localStorage.getItem('gymiq_install_dismissed') !== '1') setHint(true);
    } catch {}
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (installed) return null;
  if (!prompt && !ios) return null;

  async function install() {
    if (prompt) { prompt.prompt(); await prompt.userChoice; setPrompt(null); setHint(false); }
    else { setIosHelp(true); setHint(true); }
  }
  function dismiss() { setHint(false); setIosHelp(false); try { localStorage.setItem('gymiq_install_dismissed', '1'); } catch {} }

  return (
    <>
      {hint && (
        <div role="status" style={{ position: 'fixed', left: 12, right: 12, bottom: 76, zIndex: 50, background: 'var(--surface-2, #171717)', border: '1px solid var(--border-strong, #333)', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
          <span style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>{iosHelp ? 'In Safari, tap Share, then “Add to Home Screen”.' : 'Get GymIQ on your home screen — no browser bar.'}</span>
          {!iosHelp && <button type="button" className="btn btn-primary" onClick={install} style={{ minHeight: 36 }}>Install</button>}
          <button type="button" className="btn btn-ghost" onClick={dismiss} aria-label="Dismiss" style={{ minHeight: 36, width: 36, padding: 0 }}>✕</button>
        </div>
      )}
      <button type="button" className="btn btn-ghost" onClick={install} title={ios ? 'Add to home screen' : 'Install app'} style={{ fontSize: 12, padding: '4px 10px', minHeight: 28, opacity: 0.85 }}>
        ⤓ {ios ? 'App' : 'Install'}
      </button>
    </>
  );
}
