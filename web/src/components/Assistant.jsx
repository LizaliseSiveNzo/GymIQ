/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useState } from 'react';

// AI assistant — UI is live; responses are PLACEHOLDER for now. When an Anthropic
// key is added as a Supabase secret, swap `respond()` for a call to an edge
// function that passes the client's programme/nutrition/progress as context.
const SUGGESTIONS = [
  'Suggest a beginner push/pull/legs split',
  'What should my daily protein be?',
  'Give me a high-protein meal idea',
  'How do I improve my squat depth?',
];

function respond(text) {
  const t = text.toLowerCase();
  if (t.includes('protein')) return 'A common target is roughly 1.6–2.2 g of protein per kg of bodyweight per day for building muscle. Set your number in the Nutrition tab and log daily to stay on track. (Personalised AI guidance from your own data is coming soon.)';
  if (t.includes('meal') || t.includes('eat') || t.includes('diet')) return 'A simple high-protein meal: grilled chicken, rice, and mixed veg with olive oil — easy to hit ~40g protein. Build your full plan in the Nutrition tab. (Tailored AI meal plans are coming soon.)';
  if (t.includes('squat') || t.includes('form') || t.includes('technique')) return 'For squat depth: work on ankle and hip mobility, keep the bar over midfoot, and drive your knees out. Try the AI form check to get cues on your own reps. (Full AI coaching is coming soon.)';
  if (t.includes('split') || t.includes('programme') || t.includes('program') || t.includes('workout')) return 'A solid beginner split is Push / Pull / Legs, 3–6 days a week. Add it in the My plan tab — days for Push, Pull and Legs, then pick your exercises. (AI-generated programmes from your goals are coming soon.)';
  return "I'm your GymIQ assistant. I can help with training, nutrition and form once full AI is switched on. For now, try one of the suggestions below — and set up your plan, nutrition and form checks in the tabs.";
}

export default function Assistant() {
  const [msgs, setMsgs] = useState([{ role: 'assistant', text: "Hi! I'm your GymIQ assistant. Ask me about training, nutrition or form. (AI coaching is in preview — responses are general for now.)" }]);
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
