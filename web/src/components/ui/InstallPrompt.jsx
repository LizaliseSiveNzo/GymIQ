import { useEffect, useState } from 'react';

// Subtle PWA install affordance. Chrome/Edge/Android use the native
// beforeinstallprompt; iOS Safari gets "Add to Home Screen" instructions.
export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (standalone) { setInstalled(true); return; }
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (installed) return null;
  if (!prompt && !ios) return null;

  async function install() {
    if (!prompt) return setHelp(true);
    prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }

  return (
    <div className="mf-card" style={{ padding: '10px 14px' }}>
      <button type="button" className="btn btn-ghost btn-block" onClick={install} style={{ fontSize: 13, opacity: 0.85 }}>
        {ios ? 'Add to home screen' : 'Install GymIQ app'}
      </button>
      {ios && help && <p className="subtle" style={{ margin: '8px 0 0', fontSize: 12 }}>In Safari, tap the Share icon, then “Add to Home Screen”.</p>}
    </div>
  );
}
