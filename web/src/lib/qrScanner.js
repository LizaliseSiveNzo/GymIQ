/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import jsQR from 'jsqr';

// Start scanning QR codes from the given <video> element.
// Uses the native BarcodeDetector where supported (Chrome/Android) and falls
// back to jsQR on a canvas everywhere else (Safari/iOS, Firefox).
// Returns a stop() function that halts scanning and releases the camera.
export async function startQrScanner(video, onCode) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  video.setAttribute('playsinline', 'true');
  video.muted = true;
  video.srcObject = stream;
  await video.play();

  let running = true;
  let raf;
  let detector = null;
  if ('BarcodeDetector' in window) {
    try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (_e) { detector = null; }
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const tick = async () => {
    if (!running) return;
    try {
      if (detector) {
        const codes = await detector.detect(video);
        if (codes && codes[0] && codes[0].rawValue) onCode(codes[0].rawValue);
      } else if (video.readyState >= 2 && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (res && res.data) onCode(res.data);
      }
    } catch (_e) { /* frame decode noise */ }
    if (running) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    try { stream.getTracks().forEach((t) => t.stop()); } catch (_e) {}
    try { video.srcObject = null; } catch (_e) {}
  };
}
