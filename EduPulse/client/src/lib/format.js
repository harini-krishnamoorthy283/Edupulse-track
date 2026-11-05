export const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
export const pct = (n, d = 1) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(d).replace(/\.0$/, '')}%`);
export const fdate = (s) => (s ? new Date(String(s).length === 10 ? s + 'T00:00:00' : s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fdatetime = (s) => (s ? new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const ago = (s) => {
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24); return d < 30 ? `${d}d ago` : fdate(s);
};
export const today = () => new Date().toISOString().slice(0, 10);
export const monthLabel = (ym) => { const [y, m] = ym.split('-'); return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }); };
export const initials = (n = '') => n.replace(/^(Dr|Mr|Mrs|Ms|Prof)\.?\s+/i, '').split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
export const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);
export const toneForPct = (p) => (p === null || p === undefined ? 'slate' : p >= 75 ? 'emerald' : p >= 60 ? 'amber' : 'rose');
