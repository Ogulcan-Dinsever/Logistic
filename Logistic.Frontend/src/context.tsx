import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, persistSession, storedSession } from './api';
import { connection } from './config';
import type { Session, WarehouseData } from './types';

interface AuthState {
  session: Session | null;
  loading: boolean;
  setSession: (session: Session) => void;
  logout: () => void;
}
const AuthContext = createContext<AuthState>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setCurrent] = useState<Session | null>(storedSession);
  const [loading, setLoading] = useState(!!session);
  const logout = useCallback(() => {
    persistSession(null);
    setCurrent(null);
  }, []);
  const setSession = (next: Session) => {
    persistSession(next);
    setCurrent(next);
  };
  useEffect(() => {
    const saved = storedSession();
    if (saved && new Date(saved.expiresAt).getTime() <= Date.now()) logout();
    setLoading(false);
    window.addEventListener('logistic:unauthorized', logout);
    return () => {
      window.removeEventListener('logistic:unauthorized', logout);
    };
  }, [logout]);
  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      if (new Date(session.expiresAt).getTime() <= Date.now()) logout();
    }, 30000);
    return () => clearInterval(timer);
  }, [session, logout]);
  return (
    <AuthContext.Provider value={{ session, loading, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);

interface DataState {
  data: WarehouseData | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}
const DataContext = createContext<DataState>(null!);
export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WarehouseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++sequence.current;
    setLoading(true);
    setError('');
    try {
      if (connection.mode === 'live') {
        const [products, shelves, stock, receipts] = await Promise.all([
          api.products(),
          api.shelves(),
          api.stock(),
          api.receipts(),
        ]);
        if (id === sequence.current)
          setData({
            products,
            shelves,
            stock,
            receipts,
            movements: [],
            sales: [],
            dashboard: {
              totalUnits: stock.reduce((sum, row) => sum + row.quantity, 0),
              activeProducts: products.filter((p) => p.isActive).length,
              occupiedShelves: new Set(
                stock.filter((row) => row.quantity > 0).map((row) => row.shelfId),
              ).size,
              totalShelves: shelves.length,
              lowStockCount: 0,
              todayReceipts: 0,
              todaySales: 0,
              todayRevenue: 0,
              dailyActivity: [],
            },
          });
      } else {
        const [dashboard, products, shelves, stock, movements, receipts, sales] = await Promise.all(
          [
            api.dashboard(),
            api.products(),
            api.shelves(),
            api.stock(),
            api.movements(),
            api.receipts(),
            api.sales(),
          ],
        );
        if (id === sequence.current)
          setData({ dashboard, products, shelves, stock, movements, receipts, sales });
      }
    } catch (e) {
      if (id === sequence.current)
        setError(e instanceof Error ? e.message : 'Veriler yüklenemedi.');
    } finally {
      if (id === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => {
      sequence.current++;
    };
  }, [refresh]);
  return (
    <DataContext.Provider value={{ data, loading, error, refresh }}>
      {children}
    </DataContext.Provider>
  );
}
export const useWarehouse = () => useContext(DataContext);

const ToastContext = createContext<(message: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 4500);
      return () => clearTimeout(timer);
    }
  }, [message]);
  return (
    <ToastContext.Provider value={setMessage}>
      {children}
      {message && (
        <div className="toast" role="status">
          <span className="toast-tick">✓</span>
          {message}
          <button aria-label="Bildirimi kapat" onClick={() => setMessage('')}>
            ×
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);

// Reuse the same operation key after a failed request with identical payload.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const attempt = useRef({ payload: '', key: '' });
  const run = async <T,>(
    payload: unknown,
    operation: (key: string) => Promise<T>,
    onSuccess: (value: T) => void | Promise<void>,
  ) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    const encoded = JSON.stringify(payload);
    if (attempt.current.payload !== encoded || !attempt.current.key)
      attempt.current = { payload: encoded, key: crypto.randomUUID() };
    try {
      const value = await operation(attempt.current.key);
      attempt.current = { payload: '', key: '' };
      await onSuccess(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem tamamlanamadı.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return { busy, error, run, clearError: () => setError('') };
}
