import { useEffect, useState } from 'react';
import { REFERENCE_IMAGE } from '../config';

/**
 * Dev-only: press "R" to float the visual reference image in the corner
 * while tuning the fireworks. Never rendered in production builds.
 */
export function ReferenceOverlay() {
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'r' || e.key === 'R') setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open || missing) return null;
  return <img className="reference" src={encodeURI(REFERENCE_IMAGE)} alt="" onError={() => setMissing(true)} />;
}
