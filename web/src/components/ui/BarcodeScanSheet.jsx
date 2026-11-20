import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import { validBarcode, barcodePortion } from '../../../../supabase/functions/_shared/nutrition/barcode.js';
import './barcodeScanSheet.css';

export default function BarcodeScanSheet({ onClose, onLog }) {
  const videoRef = useRef(null);
  const [phase, setPhase] = useState('scanning'); // scanning | looking | found | error
  const [product, setProduct] = useState(null);
  const [amount, setAmount] = useState('100');
  const [unit, setUnit] = useState('g');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let stopped = false;
    let stream = null;
    let detector = null;
    async function start() {
      if (!('BarcodeDetector' in window)) { setError('Camera scanning is unavailable in this browser. Enter the barcode digits below.'); setPhase('error'); return; }
      try {
        const formats = (await window.BarcodeDetector.getSupportedFormats()).filter((f) => ['ean_13', 'ean_8', 'upc_a', 'itf'].includes(f));
        if (!formats.length) throw Error('no-format');
        detector = new window.BarcodeDetector({ formats });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const loop = async () => {
          if (stopped) return;
          try {
            const values = await detector.detect(videoRef.current);
            const match = values.find((v) => validBarcode(v.rawValue));
            if (match) { stopped = true; stream.getTracks().forEach((t) => t.stop()); lookup(match.rawValue); return; }
          } catch { /* keep scanning */ }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      } catch { setError('Camera could not open. Enter the barcode digits below.'); setPhase('error'); }
    }
    start();
    return () => { stopped = true; stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookup(barcode) {
    setPhase('looking');
    try {
      const { data, error } = await supabase.functions.invoke('gymiq-barcode', { body: { barcode } });
      if (error) { let message; try { message = (await error.context.json()).error; } catch { message = 'Lookup unavailable.'; } throw Error(message || 'Lookup unavailable.'); }
      if (data?.error) throw Error(data.error);
      setProduct(data.product);
      setUnit(data.product.unit || 'g');
      setAmount('100');
      setPhase('found');
    } catch (e) {
      setError(e.message || 'Lookup failed.');
      setPhase('error');
    }
  }

  let kcal = null;
  try { if (product) kcal = barcodePortion(product, amount); } catch { /* invalid portion */ }

  async function log() {
    if (!product || kcal == null) return;
    setSaving(true);
    try { await onLog({ name: `${product.name} (${amount} ${unit})`.slice(0, 100), kcal }); }
    catch (e) { setError(e.message); setSaving(false); }
  }

  const hasMacros = product && (product.protein_per_100 != null || product.carbs_per_100 != null || product.fat_per_100 != null);

  return (
    <div className="barcode-scan" role="dialog" aria-modal="true" aria-label="Scan a barcode">
      {(phase === 'scanning' || phase === 'looking') && <video ref={videoRef} className="barcode-cam" playsInline muted />}

      {phase === 'scanning' && (
        <div className="barcode-hint">
          <span className="barcode-scan-line" aria-hidden="true" />
          <p>Point the camera at the barcode</p>
        </div>
      )}
      {phase === 'looking' && <div className="barcode-hint"><p>Looking up product…</p></div>}

      {phase === 'found' && product && (
        <div className="barcode-sheet">
          <div className="barcode-sheet-handle" aria-hidden="true" />
          <h2>{product.name}</h2>
          {product.brand && <p className="subtle">{product.brand}</p>}
          <div className="barcode-hero"><div><strong>{kcal == null ? '—' : kcal}</strong><span>kcal</span></div></div>
          {hasMacros && (
            <div className="barcode-macros">
              {product.carbs_per_100 != null && <span><b>{Math.round(product.carbs_per_100 * Number(amount) / 100)}g</b><i>carbs</i></span>}
              {product.protein_per_100 != null && <span><b>{Math.round(product.protein_per_100 * Number(amount) / 100)}g</b><i>protein</i></span>}
              {product.fat_per_100 != null && <span><b>{Math.round(product.fat_per_100 * Number(amount) / 100)}g</b><i>fat</i></span>}
            </div>
          )}
          <p className="subtle">{product.kcal_per_100} kcal per 100 {product.unit || 'g'} · {product.source}</p>
          <div className="barcode-fields">
            <label>Amount<input type="number" inputMode="decimal" min="0.1" max="3000" step="0.1" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label>Unit<select value={unit} onChange={(e) => setUnit(e.target.value)}><option value="g">g</option><option value="ml">ml</option></select></label>
          </div>
          <label className="barcode-check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> This matches my package label.</label>
          <div className="barcode-actions">
            <button type="button" className="btn btn-primary" disabled={saving || !confirmed || kcal == null} onClick={log}>{saving ? 'Logging…' : 'Log to diary'}</button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="barcode-error">
          <h2>Couldn't scan that barcode</h2>
          <p>{error}</p>
          <form onSubmit={(e) => { e.preventDefault(); if (validBarcode(manual)) lookup(manual); else setError('Enter a valid 8, 12, 13 or 14-digit barcode.'); }}>
            <input inputMode="numeric" maxLength="14" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))} placeholder="Barcode digits" aria-label="Barcode digits" />
            <button type="submit" className="btn btn-secondary">Look up</button>
          </form>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      )}

      <button type="button" className="barcode-close" onClick={onClose} aria-label="Close">✕</button>
    </div>
  );
}
