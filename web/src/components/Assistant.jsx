/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useState } from 'react';

// Legacy AI assistant — placeholder canned responses only. The real Personal AI
// coach (DeepSeek-backed) lives in pages/mf/PersonalCoach.jsx at /coach.
const SUGGESTIONS = [
  'Suggest a beginner push/pull/legs split',
  'What should my daily protein be?',
  'Give me a high-protein meal idea',
  'How do I improve my squat depth?',
];

function respond(text) {
  const t = text.toLowerCase();
  if (t.includes('protein')) return 'A common target is roughly 1.6–2.2 g of protein per kg of bodyweight per day for building muscle. Set your number in the Nutrition tab and log daily to stay on track. (The Personal AI coach gives you guidance from your own data.)';
  if (t.includes('meal') || t.includes('eat') || t.includes('diet')) return 'A simple high-protein meal: grilled chicken, rice, and mixed veg with olive oil — easy to hit ~40g protein. Build your full plan in the Nutrition tab. (Tailored AI meal plans are available in Nutrition.)';
  if (t.includes('squat') || t.includes('form') || t.includes('technique')) return 'For squat depth: work on ankle and hip mobility, keep the bar over midfoot, and drive your knees out. Try the AI form check to get cues on your own reps. (The Personal AI coach covers form and technique too.)';
  if (t.includes('split') || t.includes('programme') || t.includes('program') || t.includes('workout')) return 'A solid beginner split is Push / Pull / Legs, 3–6 days a week. Add it in the My plan tab — days for Push, Pull and Legs, then pick your exercises. (Onboarding generates a programme from your goals.)';
  return "I'm your GymIQ assistant. For general training, nutrition and form tips, try one of the suggestions below — and open the Personal AI coach for guidance from your own data.";
}

export default function Assistant() {
  const [msgs, setMsgs] = useState([{ role: 'assistant', text: "Hi! I'm your GymIQ assistant. Ask me about training, nutrition or form. (For personal AI coaching, open the Personal AI coach.)" }]);
  const [input, setInput] = useState('');

  function send(text) {
    const q = (text ?? input).trim();
    if (!q) return;
    setMsgs((m) => [...m, { role: 'user', text: q }, { role: 'assistant', text: respond(q) }]);
    setInput('');
  }

  return (
    <div className="card">
      <div className="section-header"><h4 style={{ margin: 0 }}>Assistant</h4><span className="badge badge-warning">Preview</span></div>

      <div className="stack" style={{ gap: 8, marginBottom: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%', padding: '10px 12px', borderRadius: 12, fontSize: 14,
            background: m.role === 'user' ? 'var(--green-600)' : 'var(--surface-2)',
            color: m.role === 'user' ? 'var(--on-accent)' : 'var(--ink)',
          }}>{m.text}</div>
        ))}
      </div>

      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {SUGGESTIONS.map((s) => (
          <span key={s} className="badge badge-neutral" style={{ cursor: 'pointer' }} onClick={() => send(s)}>{s}</span>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="row" style={{ gap: 8 }}>
        <input className="input" style={{ flex: 1 }} placeholder="Ask about training, nutrition or form…" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn btn-primary" disabled={!input.trim()}>Send</button>
      </form>
    </div>
  );
}
