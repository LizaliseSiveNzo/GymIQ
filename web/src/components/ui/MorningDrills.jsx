import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import './morningDrills.css';

const DRILLS = [
  { id: 'pushup', name: 'Push-up', cue: '10–20 reps' },
  { id: 'plank', name: 'Plank', cue: 'Hold 30–60s' },
  { id: 'squat', name: 'Bodyweight squat', cue: '15–25 reps' },
  { id: 'lunge', name: 'Walking lunge', cue: '10 each leg' },
  { id: 'reverselunge', name: 'Reverse lunge', cue: '10 each leg' },
  { id: 'wallsit', name: 'Wall sit', cue: 'Hold 30–60s' },
  { id: 'wallpushup', name: 'Wall push-up', cue: '15–20 reps' },
  { id: 'glutebridge', name: 'Glute bridge', cue: '15–20 reps' },
  { id: 'mountainclimber', name: 'Mountain climber', cue: '30–45s' },
  { id: 'birddog', name: 'Bird dog', cue: '10 each side' },
  { id: 'deadbug', name: 'Dead bug', cue: '10 each side' },
  { id: 'superman', name: 'Superman hold', cue: 'Hold 20–30s' },
  { id: 'hollowhold', name: 'Hollow body hold', cue: 'Hold 20–30s' },
  { id: 'legraise', name: 'Leg raise', cue: '10–15 reps' },
  { id: 'calfraise', name: 'Calf raise', cue: '20–30 reps' },
  { id: 'sideplank', name: 'Side plank', cue: 'Hold 20–30s each side' },
  { id: 'bicyclecrunch', name: 'Bicycle crunch', cue: '20–30 reps' },
  { id: 'highknees', name: 'High knees', cue: '30–45s' },
];

function localDay() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function daySeed(dateStr) {
  return Math.floor(new Date(`${dateStr}T12:00:00`).getTime() / 86400000);
}

// Deterministic daily rotation: shuffle the pool with a date seed, take 3.
function dailyThree(ids, dateStr) {
  if (!ids || ids.length < 3) return [];
  const arr = [...ids];
  let seed = daySeed(dateStr);
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr.slice(0, 3).map((id) => DRILLS.find((d) => d.id === id)).filter(Boolean);
}

export default function MorningDrills() {
  const { profile } = useAuth();
  const userId = profile?.id;
  const demo = !!profile?.demo;
  const [selected, setSelected] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!userId || demo) { setLoaded(true); return; }
    let active = true;
    supabase.from('morning_drill_prefs').select('exercise_ids').eq('user_id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data?.exercise_ids) setSelected(data.exercise_ids.filter((id) => DRILLS.some((d) => d.id === id)));
        setLoaded(true);
      });
    return () => { active = false; };
  }, [userId, demo]);

  const daily = dailyThree(selected, localDay());

  function toggle(id) { setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); }

  async function save() {
    if (selected.length < 3) return;
    if (demo) { setPicker(false); return; }
    setBusy(true); setNotice('');
    const { error } = await supabase.from('morning_drill_prefs').upsert({ user_id: userId, exercise_ids: selected, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) setNotice(error.message);
    else { setPicker(false); setNotice('Morning drills saved.'); }
  }

  return (
    <section className="mf-card morning-drills">
      <div className="section-heading">
        <h2>🌅 Morning drills</h2>
        {!demo && <button type="button" className="btn btn-ghost" onClick={() => setPicker((p) => !p)}>{selected.length ? `Edit · ${selected.length}` : 'Choose exercises'}</button>}
      </div>

      {!loaded ? <p className="subtle">Loading…</p>
        : selected.length < 3 ? <p className="subtle">Pick at least 3 floor or wall exercises and we'll rotate 3 of them for you every morning.</p>
        : <>
          <p className="subtle">Three to start your day — they rotate daily.</p>
          <div className="morning-drills-list">
            {daily.map((d) => (
              <div className="morning-drill" key={d.id}><strong>{d.name}</strong><span>{d.cue}</span></div>
            ))}
          </div>
        </>}

      {notice && <p className="subtle">{notice}</p>}

      {picker && (
        <div className="morning-drills-picker">
          <p className="subtle">Choose your pool — at least 3. We'll rotate 3 of them each morning.</p>
          <div className="morning-drills-options">
            {DRILLS.map((d) => (
              <label key={d.id} className={`drill-option ${selected.includes(d.id) ? 'is-on' : ''}`}>
                <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} />
                <span><b>{d.name}</b><i>{d.cue}</i></span>
              </label>
            ))}
          </div>
          <div className="launch-actions">
            <button type="button" className="btn btn-primary" disabled={busy || selected.length < 3} onClick={save}>
              {selected.length < 3 ? `Choose at least 3 (${selected.length})` : `Save ${selected.length} exercises`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
