import { useEffect, useMemo, useState } from 'react';
import FoodPicker from './FoodPicker.jsx';
import './mealScanSheet.css';

const SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'];
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function useCountUp(target, run, duration = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (reduceMotion()) { setValue(target); return; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, duration]);
  return value;
}

function likelySlot(hour) {
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 22) return 'dinner';
  return 'snack';
}

export default function MealScanSheet({ preview, busy, items = [], foods = [], error, defaultDay, onClose, onPatch, onAdd, onRemove, onSave }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState(false);
  const [day, setDay] = useState(defaultDay || new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState(() => likelySlot(new Date().getHours()));
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    for (const f of items) {
      const food = foods.find((x) => x.id === f.food_id);
      if (!food || !(f.grams > 0)) continue;
      t.kcal += (food.kcal * f.grams) / 100;
      t.protein += (food.protein * f.grams) / 100;
      t.carbs += (food.carbs * f.grams) / 100;
      t.fat += (food.fat * f.grams) / 100;
    }
    return t;
  }, [items, foods]);

  const shownKcal = useCountUp(Math.round(totals.kcal), !busy && !error);

  const withKcal = items.map((f) => {
    const food = foods.find((x) => x.id === f.food_id);
    const kcal = food && f.grams > 0 ? Math.round((food.kcal * f.grams) / 100) : 0;
    return { ...f, kcal };
  });

  const mealName = items
    .filter((f) => f.food_id)
    .map((f) => f.name.replace(/·.*$/, '').trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(', ') || 'Your meal';

  const hasItems = items.some((f) => f.food_id && f.grams > 0);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try { await onSave(day, slot); } finally { setSaving(false); }
  }

  return (
    <div className="meal-scan" role="dialog" aria-modal="true" aria-label="Meal scan results">
      <img src={preview} alt="" className="meal-scan-photo" />

      {busy && (
        <div className="meal-scan-busy">
          <span className="meal-scan-line" aria-hidden="true" />
          <p>Analyzing your meal…</p>
        </div>
      )}

      {!busy && error && (
        <div className="meal-scan-error">
          <h2>Couldn't analyse that photo</h2>
          <p>{error}</p>
          <button type="button" className="btn btn-primary" onClick={onClose}>Try another photo</button>
        </div>
      )}

      {!busy && !error && (
        <div className={`meal-scan-sheet${expanded ? ' is-expanded' : ''}`}>
          <button type="button" className="meal-scan-handle" onClick={() => setExpanded((e) => !e)} aria-label={expanded ? 'Collapse results' : 'Expand results'}>
            <span aria-hidden="true" />
          </button>

          <div className="meal-scan-scroll">
            <h2 className="meal-scan-title">{mealName}</h2>

            <div className="meal-scan-hero">
              <div className="meal-scan-kcal"><strong>{shownKcal.toLocaleString()}</strong><span>kcal</span></div>
              <div className="meal-scan-macros">
                <span className="ms-macro ms-carbs"><b>{Math.round(totals.carbs)}g</b><i>carbs</i></span>
                <span className="ms-macro ms-protein"><b>{Math.round(totals.protein)}g</b><i>protein</i></span>
                <span className="ms-macro ms-fat"><b>{Math.round(totals.fat)}g</b><i>fat</i></span>
              </div>
            </div>
            <p className="meal-scan-estimate">Estimates from the photo — check and adjust.</p>

            <div className="meal-scan-items">
              {withKcal.map((f, i) => (
                <div className="meal-scan-item" key={i}>
                  {editing ? (
                    <div className="ms-edit">
                      <FoodPicker foods={foods} value={f.food_id} onChange={(id) => { const food = foods.find((x) => x.id === id); onPatch(i, { food_id: id, name: food?.name || f.name, estimated: false }); }} />
                      <label className="ms-grams"><input type="number" inputMode="decimal" min="1" max="2000" step="1" value={f.grams} onChange={(e) => onPatch(i, { grams: Math.max(0, Number(e.target.value) || 0) })} />g</label>
                      <button type="button" className="ms-remove" aria-label={`Remove ${f.name}`} onClick={() => onRemove(i)}>×</button>
                    </div>
                  ) : (
                    <>
                      <span className="ms-item-name">{f.name}{f.estimated && <em>estimate</em>}</span>
                      <span className="ms-item-portion">{f.grams}g</span>
                      <span className="ms-item-kcal">{f.kcal} kcal</span>
                    </>
                  )}
                </div>
              ))}
              {editing && <button type="button" className="btn btn-ghost ms-add" onClick={() => onAdd(foods[0]?.id)}>+ Add item</button>}
            </div>
          </div>

          <div className="meal-scan-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing((e) => !e)}>{editing ? 'Done' : 'Edit results'}</button>
            <button type="button" className="btn btn-primary" disabled={!hasItems} onClick={() => setPicker((p) => !p)}>Add to meal plan</button>
          </div>

          {picker && (
            <div className="meal-scan-picker">
              <label>Day<input type="date" value={day} max={new Date().toISOString().slice(0, 10)} onChange={(e) => e.target.value && setDay(e.target.value)} /></label>
              <label>Meal<select value={slot} onChange={(e) => setSlot(e.target.value)}>{SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
              <button type="button" className="btn btn-primary" disabled={saving || !hasItems} onClick={handleSave}>{saving ? 'Saving…' : 'Confirm'}</button>
            </div>
          )}
        </div>
      )}

      <button type="button" className="meal-scan-close" onClick={onClose} aria-label="Close and retake">✕</button>
    </div>
  );
}
