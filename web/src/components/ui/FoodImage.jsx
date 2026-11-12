/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import images from '../../lib/foodImages.json';
import './foodImage.css';

const EXTENSIONS = ['webp', 'jpg', 'png'];

// Food thumbnail. Looks the food up in foodImages.json first; when there is no
// mapping entry it falls back to /foods/<foodId>.<ext>. Hides itself when no image
// loads, so foods without an uploaded image stay text-only (no broken-image icons).
export default function FoodImage({ foodId }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [foodId]);
  if (!foodId) return null;
  const mapped = images[foodId];
  const sources = mapped ? [mapped] : EXTENSIONS.map((ext) => `/foods/${foodId}.${ext}`);
  if (idx >= sources.length) return null;
  return (
    <img
      className="food-image"
      src={sources[idx]}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setIdx((v) => v + 1)}
    />
  );
}
