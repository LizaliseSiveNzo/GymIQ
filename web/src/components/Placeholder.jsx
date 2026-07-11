/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

export default function Placeholder({ title, note }) {
  return (
    <div className="container">
      <div className="card">
        <h1>{title}</h1>
        <p>{note}</p>
        <span className="badge badge-neutral">Coming in a later phase</span>
      </div>
    </div>
  );
}
