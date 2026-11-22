import { useEffect, useState } from 'react';
import './productScanSheet.css';

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function useCountUp(target, duration = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
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
  }, [target, duration]);
  return value;
}

export default function ProductScanSheet({ preview, product, onClose, onLog }) {
  const [amount, setAmount] = useState(product?.serving_g ? String(Math.round(product.serving_g)) : '100');
  const [unit, setUnit] = useState('g');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const per100 = Number(product?.kcal_per_100g) || 0;
  const grams = Number(amount) || 0;
  const kcal = Math.round(per100 * grams / 100);
  const shownKcal = useCountUp(kcal);
  const macro = (v) => (v != null ? Math.round(v * grams / 100) : null);

  async function log() {
    if (kcal < 1 || kcal > 10000) { setError('Check the amount.'); return; }
    setSaving(true);
    try { await onLog({ name: `${product.name} (${grams} ${unit})`.slice(0, 100), kcal }); }
    catch (e) { setError(e.message); setSaving(false); }
  }

  return (
    <div className="product-scan" role="dialog" aria-modal="true" aria-label="Product result">
      <img src={preview} alt="" className="product-scan-photo" />
      <div className="product-sheet">
        <div className="product-sheet-handle" aria-hidden="true" />
        <h2>{product.name}</h2>
        {product.brand && <p className="subtle">{product.brand}</p>}
        <div className="product-hero"><div><strong>{shownKcal.toLocaleString()}</strong><span>kcal</span></div></div>
        <div className="product-macros">
          {macro(product.carbs_per_100g) != null && <span><b>{macro(product.carbs_per_100g)}g</b><i>carbs</i></span>}
          {macro(product.protein_per_100g) != null && <span><b>{macro(product.protein_per_100g)}g</b><i>protein</i></span>}
          {macro(product.fat_per_100g) != null && <span><b>{macro(product.fat_per_100g)}g</b><i>fat</i></span>}
        </div>
        <p className="subtle">{product.kcal_per_100g} kcal per 100 {unit} · {product.source}</p>
        <div className="product-fields">
          <label>Amount<input type="number" inputMode="decimal" min="0.1" max="3000" step="0.1" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <label>Unit<select value={unit} onChange={(e) => setUnit(e.target.value)}><option value="g">g</option><option value="ml">ml</option></select></label>
        </div>
        {error && <p className="inline-error" role="alert">{error}</p>}
        <div className="product-actions">
          <button type="button" className="btn btn-primary" disabled={saving || kcal < 1} onClick={log}>{saving ? 'Logging…' : 'Log to diary'}</button>
        </div>
      </div>
      <button type="button" className="product-close" onClick={onClose} aria-label="Close">✕</button>
    </div>
  );
}
