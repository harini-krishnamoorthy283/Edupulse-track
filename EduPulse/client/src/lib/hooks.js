import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { onChange } from './live.js';

export function useApi(path, { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const seq = useRef(0);
  const load = useCallback(async (silent = false) => {
    if (skip || !path) { setLoading(false); return; }
    const id = ++seq.current;
    if (silent !== true) setLoading(true);
    try { const d = await api.get(path); if (id === seq.current) { setData(d); setError(null); } }
    catch (e) { if (id === seq.current) setError(e.message); }
    finally { if (id === seq.current) setLoading(false); }
  }, [path, skip]);
  useEffect(() => { load(); }, [load]);
  // Live updates: refetch silently (no spinner) when the server announces a data change.
  useEffect(() => {
    if (skip || !path || path.startsWith('/attendance/roster') || path.startsWith('/auth')) return undefined;
    let t; const off = onChange(() => { clearTimeout(t); t = setTimeout(() => load(true), 350); });
    return () => { off(); clearTimeout(t); };
  }, [path, skip, load]);
  return { data, loading, error, reload: () => load(), setData };
}
export const useStudents = (enabled) => useApi('/students', { skip: !enabled });
