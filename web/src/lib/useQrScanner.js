/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useRef, useState } from 'react';
import jsQR from 'jsqr';

// Camera QR scanning that works on Chrome (BarcodeDetector) AND Safari (jsQR fallback).
export function useQrScanner(onDetect) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const runningRef = useRef(false);
  const lastRef = useRef({ code: '', t: 0 });
  const cbRef = useRef(onDetect); cbRef.current = onDetect;
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const cameraSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  function handle(val) {
    if (!val) return;
    const now = Date.now();
    if (val === lastRef.current.code && now - lastRef.current.t < 2500) return;
    lastRef.current = { code: val, t: now };
    cbRef.current(val);
  }

  async function start() {
    setError('');
    if (!cameraSupported) { setError('This browser can’t use the camera — use the code box below.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) { v.setAttribute('playsinline', 'true'); v.muted = true; v.srcObject = stream; await v.play(); }

      let detector = null;
      if ('BarcodeDetector' in window) { try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (_e) { detector = null; } }
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      runningRef.current = true; setScanning(true);
      const loop = async () => {
        if (!runningRef.current || !videoRef.current) return;
        const vid = videoRef.current;
        try {
          if (detector) {
            const codes = await detector.detect(vid);
            if (codes && codes[0]?.rawValue) handle(codes[0].rawValue.trim());
          } else if (vid.readyState >= 2 && vid.videoWidth) {
            canvas.width = vid.videoWidth; canvas.height = vid.videoHeight;
            ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            if (found?.data) handle(found.data.trim());
          }
        } catch (_e) { /* frame noise */ }
        if (runningRef.current) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch (e) { setError('Camera error: ' + (e.message || e)); }
  }

  function stop() {
    runningRef.current = false; setScanning(false);
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }

  return { videoRef, scanning, error, cameraSupported, start, stop };
}
