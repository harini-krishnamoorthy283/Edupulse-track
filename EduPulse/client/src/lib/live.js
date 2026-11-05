import { useSyncExternalStore } from 'react';

const bus = new EventTarget();
let es = null; let connected = false; const subs = new Set();
const setConnected = (v) => { if (connected !== v) { connected = v; subs.forEach((f) => f()); } };

export function startLive() {
  if (es || typeof EventSource === 'undefined') return;
  es = new EventSource('/api/events', { withCredentials: true });
  es.onopen = () => setConnected(true);
  es.onerror = () => setConnected(false); // EventSource reconnects automatically
  es.addEventListener('change', (e) => { try { bus.dispatchEvent(new CustomEvent('change', { detail: JSON.parse(e.data) })); } catch { /* ignore */ } });
}
export function stopLive() { es?.close(); es = null; setConnected(false); }
export const onChange = (fn) => { const h = (e) => fn(e.detail); bus.addEventListener('change', h); return () => bus.removeEventListener('change', h); };
export const useLiveStatus = () => useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => connected);
