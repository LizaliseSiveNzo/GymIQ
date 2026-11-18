import { supabase } from './supabaseClient.js';

// Downscale a photo to ~1024px JPEG (keeps the vision call cheap and private),
// then ask the meal-analyze edge function to identify foods and portions.
export async function analyzeMealPhoto(file) {
  const base64 = await downscaleImage(file);
  const { data, error } = await supabase.functions.invoke('meal-analyze', { body: { image: base64 } });
  if (error) throw Error(error?.message || 'Could not analyse the photo.');
  if (data?.error) throw Error(data.error);
  return data;
}

function downscaleImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 1024;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(Error('Could not read that image.')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(Error('Could not read that image.')); };
    img.src = url;
  });
}
