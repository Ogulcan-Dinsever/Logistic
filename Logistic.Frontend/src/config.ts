export type Connection = { mode: 'demo' | 'live'; baseUrl: string };
const defaultUrl = import.meta.env.VITE_API_BASE_URL || 'https://localhost:7228/api';
export function readConnection(): Connection {
  try {
    const saved = JSON.parse(localStorage.getItem('logistic.connection') || 'null');
    if (saved && ['demo', 'live'].includes(saved.mode) && typeof saved.baseUrl === 'string')
      return saved;
  } catch {
    /* Fall back to environment settings. */
  }
  return {
    mode: import.meta.env.VITE_ENABLE_DEMO === 'true' ? 'demo' : 'live',
    baseUrl: defaultUrl.replace(/\/$/, ''),
  };
}
export const connection = readConnection();
export function saveConnection(next: Connection) {
  const url = new URL(next.baseUrl);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error('Geçerli bir HTTP veya HTTPS API adresi gir.');
  if (!url.pathname.endsWith('/api')) throw new Error('API adresi /api ile bitmeli.');
  localStorage.setItem(
    'logistic.connection',
    JSON.stringify({ ...next, baseUrl: next.baseUrl.replace(/\/$/, '') }),
  );
  sessionStorage.removeItem('logistic.session');
}
