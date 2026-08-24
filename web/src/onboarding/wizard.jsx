/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

// Shared wizard chrome + small controls for the onboarding funnel.
// One decision per screen; progress always visible; sticky CTA that stays
// disabled until the step is valid.

export function Wizard({ stepIndex, totalSteps, onBack, title, sub, children, nextLabel, nextDisabled, onNext, skipLabel, onSkip }) {
  const pct = Math.round(((stepIndex + (nextDisabled ? 0 : 1)) / totalSteps) * 100);
  return (
    <div className="ob-app">
      <div className="ob-topbar">
        {stepIndex > 0 && <button className="ob-back" onClick={onBack} aria-label="Back">‹</button>}
        <span className="ob-brand"><span className="dot" /> GymIQ</span>
      </div>
      <div className="ob-progress"><i style={{ width: `${pct}%` }} /></div>
      <div className="ob-stepcount">Step {stepIndex + 1} of {totalSteps}</div>

      <div className="ob-body">
        <h1 className="ob-title">{title}</h1>
        {sub && <p className="ob-sub">{sub}</p>}
        {children}
      </div>

      <div className="ob-footer">
        <button className="ob-next" disabled={nextDisabled} onClick={onNext}>
          {nextLabel || 'Continue'}
        </button>
        {skipLabel && !nextDisabled && (
          <button className="ob-skip" onClick={onSkip}>{skipLabel}</button>
        )}
      </div>
    </div>
  );
}

export function OptionCard({ icon, title, desc, selected, onClick }) {
  return (
    <button type="button" className={`ob-option ${selected ? 'on' : ''}`} onClick={onClick}>
      {icon && <span className="ic">{icon}</span>}
      <span>
        <span className="tt" style={{ display: 'block' }}>{title}</span>
        {desc && <span className="dd">{desc}</span>}
      </span>
      <span className="radio" />
    </button>
  );
}

export function StepperControl({ value, min, max, onChange, unit }) {
  return (
    <div className="stepper">
      <button disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Decrease">−</button>
      <div>
        <div className="val">{value}</div>
        {unit && <span className="unit" style={{ textAlign: 'center' }}>{unit}</span>}
      </div>
      <button disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Increase">+</button>
    </div>
  );
}
