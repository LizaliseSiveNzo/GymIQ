import { useEffect, useId, useRef, useState } from 'react';
import images from '../../lib/exerciseImages.json';

// Catalogue IDs prevent custom exercises from inheriting an unrelated guide.
export default function ExerciseIllustration({ exerciseId, name, variant = 'thumbnail' }) {
  const media = images[exerciseId];
  const dialog = useRef(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [failedSrc, setFailedSrc] = useState(null);
  useEffect(() => { setOpen(false); }, [exerciseId]);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  if (!media || failedSrc === media.src) return null;
  const label = name || media.name;
  return (
    <div className={`exercise-illustration exercise-illustration--${variant}`}>
      <button type="button" className="exercise-illustration__open" onClick={() => setOpen(true)} aria-label={`View ${label} illustration`} aria-haspopup="dialog">
        <img src={variant === 'thumbnail' ? media.thumbnail : media.src} alt={`${label} movement illustration`} width={media.width} height={media.height} loading="lazy" decoding="async" onError={() => setFailedSrc(media.src)} />
        {variant === 'guide' && <span>View movement ↗</span>}
      </button>
      <dialog ref={dialog} className="exercise-guide-dialog" aria-labelledby={titleId} onClose={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <header>
          <h2 id={titleId}>{label}</h2>
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} aria-label="Close exercise illustration" autoFocus>✕</button>
        </header>
        {open && <img src={media.src} alt={`${label} movement illustration, enlarged`} width={media.width} height={media.height} decoding="async" />}
      </dialog>
    </div>
  );
}
