/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useState } from 'react';

// Inline two-click confirm — replaces window.confirm() popups.
// First click arms it ("Confirm?"), second click within 3s runs onConfirm.
export default function ConfirmButton({
  onConfirm,
  children = 'Delete',
  confirmLabel = 'Confirm?',
  className = 'btn btn-ghost',
  style,
  title,
}) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={className}
      style={{ ...(armed ? { color: 'var(--danger)', borderColor: 'var(--danger)' } : null), ...style }}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        if (armed) { setArmed(false); onConfirm(); }
        else { setArmed(true); setTimeout(() => setArmed(false), 3000); }
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
