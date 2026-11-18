import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import foods from '../../../../supabase/functions/_shared/nutrition/foods.json';

const toggle = (values, id) => (values.includes(id) ? values.filter((x) => x !== id) : [...values, id]);
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 };
const label = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '8px 10px', background: '#20231e', borderRadius: 10, fontSize: 13 };
const fieldset = { border: 0, padding: '8px 0', margin: '8px 0' };

export default function CoachKitchen({ userId }) {
  const [equipment, setEquipment] = useState([]);
  const [gyms, setGyms] = useState([]);
  const [gymEquipment, setGymEquipment] = useState([]);
  const [kitchen, setKitchen] = useState({ pantry: [], equipment: [] });
  const [savedKitchen, setSavedKitchen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const dirty = JSON.stringify(kitchen) !== JSON.stringify(savedKitchen);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const results = await Promise.all([
        supabase.from('coach_settings').select('pantry,equipment').eq('user_id', userId).maybeSingle(),
        supabase.from('equipment_items').select('id,name').order('sort_order'),
        supabase.from('gym_profiles').select('id,name').eq('user_id', userId),
        supabase.from('gym_profile_equipment').select('profile_id,equipment_id,selected').eq('selected', true),
      ]);
      if (!mounted) return;
      if (results.some((r) => r.error)) { setError('Could not load your ingredients and equipment.'); return; }
      const [settings, items, profiles, selections] = results.map((r) => r.data);
      const saved = settings || { pantry: [], equipment: [] };
      const value = {
        pantry: saved.pantry || [],
        equipment: (saved.equipment && saved.equipment.length) ? saved.equipment : [...new Set(selections.map((x) => x.equipment_id).filter((id) => id !== 'bodyweight'))],
      };
      setKitchen(value);
      setSavedKitchen({ pantry: saved.pantry || [], equipment: saved.equipment || [] });
      setEquipment(items); setGyms(profiles); setGymEquipment(selections);
    }
    void load();
    return () => { mounted = false; };
  }, [userId]);

  async function save() {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    const { error } = await supabase.from('coach_settings').upsert({ user_id: userId, ...kitchen, updated_at: new Date().toISOString() });
    if (error) { setError('Could not save your ingredients and equipment.'); setBusy(false); return; }
    setSavedKitchen(structuredClone(kitchen)); setNotice('Ingredients and equipment saved.'); setBusy(false);
  }

  return (
    <section className="mf-card account-panel">
      <h2>Coach · ingredients & equipment</h2>
      <p className="subtle">What your AI coach can cook with and train with. Change these any time; your coach reads them when it builds meals and workouts.</p>
      <fieldset style={fieldset} disabled={busy}><legend>Available ingredients</legend><div style={grid}>{foods.map((f) => <label key={f.id} style={label}><input type="checkbox" checked={kitchen.pantry.includes(f.id)} onChange={() => setKitchen((k) => ({ ...k, pantry: toggle(k.pantry, f.id) }))} />{f.name}</label>)}</div></fieldset>
      {gyms.length > 0 && <label style={{ display: 'grid', gap: 8 }}>Use equipment from a saved gym<select defaultValue="" disabled={busy} onChange={(e) => { if (e.target.value) setKitchen((k) => ({ ...k, equipment: gymEquipment.filter((x) => x.profile_id === e.target.value).map((x) => x.equipment_id) })); }}><option value="">Choose a gym</option>{gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
      <fieldset style={fieldset} disabled={busy}><legend>Available equipment</legend><div style={grid}>{equipment.filter((e) => e.id !== 'bodyweight').map((e) => <label key={e.id} style={label}><input type="checkbox" checked={kitchen.equipment.includes(e.id)} onChange={() => setKitchen((k) => ({ ...k, equipment: toggle(k.equipment, e.id) }))} />{e.name}</label>)}</div></fieldset>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {notice && <p className="nutrition-notice" role="status">{notice}</p>}
      <button className="btn btn-primary" disabled={busy || !dirty} onClick={save}>Save ingredients & equipment</button>
    </section>
  );
}
