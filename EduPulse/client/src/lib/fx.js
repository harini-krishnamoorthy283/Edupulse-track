import { useEffect, useRef, useState } from 'react';

// Adds the "in" class when the element scrolls into view (CSS handles the transition).
export function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { el.classList.add('in'); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('in'); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return ref;
}
export function useCountUp(target, ms = 1400) {
  const [n, setN] = useState(0); const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const run = () => { const t0 = performance.now(); const step = (t) => { const p = Math.min(1, (t - t0) / ms); setN(Math.round(target * (1 - (1 - p) ** 3))); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); };
    if (typeof IntersectionObserver === 'undefined') { setN(target); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { run(); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el); return () => io.disconnect();
  }, [target, ms]);
  return [n, ref];
}
