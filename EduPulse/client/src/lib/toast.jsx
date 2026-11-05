import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Modal } from './ui.jsx';

const Ctx = createContext(null);
export const useToast = () => useContext(Ctx).toast;
export const useConfirm = () => useContext(Ctx).confirm;

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const [dlg, setDlg] = useState(null);
  const toast = useCallback((message, type = 'success') => {
    const id = Math.random();
    setItems((x) => [...x, { id, message, type }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200);
  }, []);
  toast.error = (m) => toast(m, 'error');
  const confirm = useCallback((opts) => new Promise((resolve) => setDlg({ ...opts, resolve })), []);
  const close = (v) => { dlg?.resolve(v); setDlg(null); };
  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,380px)]" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`flex items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-pop text-sm ${i.type === 'error' ? 'border-rose-200' : 'border-emerald-200'}`}>
            {i.type === 'error' ? <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
            <p className="flex-1 text-slate-700">{i.message}</p>
            <button onClick={() => setItems((x) => x.filter((k) => k.id !== i.id))} aria-label="Dismiss"><X className="h-4 w-4 text-slate-400" /></button>
          </div>
        ))}
      </div>
      <Modal open={!!dlg} onClose={() => close(false)} title={dlg?.title || 'Are you sure?'} size="sm"
        footer={<><button className="btn-secondary" onClick={() => close(false)}>Cancel</button><button className={dlg?.danger === false ? 'btn-primary' : 'btn-danger'} onClick={() => close(true)}>{dlg?.confirmText || 'Confirm'}</button></>}>
        <p className="text-sm text-slate-600">{dlg?.message}</p>
      </Modal>
    </Ctx.Provider>
  );
}
