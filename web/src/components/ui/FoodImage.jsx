/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useState } from 'react';
import './foodImage.css';

const EXTENSIONS = ['webp', 'jpg', 'png'];

// Food thumbnail served from /foods/<foodId>.<ext>. Tries webp, then jpg, then png,
// and hides itself when no image exists so foods without an uploaded image stay
// text-only (no broken-image icons).
export default function FoodImage({ foodId }) {
  const [ext, setExt] = useState(0);
  if (!foodId || ext >= EXTENSIONS.length) return null;
  return (
    <img
      className="food-image"
      src={`/foods/${foodId}.${EXTENSIONS[ext]}`}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setExt((v) => v + 1)}
    />
  );
}
