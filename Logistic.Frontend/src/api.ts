import { connection } from './config';
import type {
  Dashboard,
  Movement,
  Product,
  ProductInput,
  PutawayInput,
  Receipt,
  ReceiptInput,
  Sale,
  SaleInput,
  Session,
  Shelf,
  ShelfInput,
  Stock,
  User,
  UserInput,
} from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
  }
}
export function storedSession(): Session | null {
  try {
    return JSON.parse(sessionStorage.getItem('logistic.session') || 'null');
  } catch {
    return null;
  }
}
export function persistSession(session: Session | null) {
  if (session) sessionStorage.setItem('logistic.session', JSON.stringify(session));
  else sessionStorage.removeItem('logistic.session');
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = storedSession();
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body) headers.set('Content-Type', 'application/json');
  if (session) headers.set('Authorization', `Bearer ${session.accessToken}`);
  let response: Response;
  try {
    response = await fetch(`${connection.baseUrl}${path}`, {
      ...options,
      headers,
      signal: options.signal || AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(
      'API bağlantısı kurulamadı. Backend adresini, sunucuyu ve CORS ayarını kontrol et.',
      0,
    );
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && session) {
      persistSession(null);
      window.dispatchEvent(new Event('logistic:unauthorized'));
    }
    const validation = body?.errors ? Object.values(body.errors).flat().join(' ') : '';
    throw new ApiError(
      body?.detail || validation || body?.title || 'İşlem tamamlanamadı.',
      response.status,
      body?.errors,
    );
  }
  return (body && Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body) as T;
}
const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });
const endpoint = (live: string, demo: string) => (connection.mode === 'live' ? live : demo);
const listEndpoint = (live: string, demo: string) =>
  connection.mode === 'live' ? `${live}?pageId=1&take=1000` : demo;
interface BackendUser {
  id: string;
  name: string;
  surName: string;
  email: string;
  role: string;
  token?: string;
  status: boolean;
}
export function normalizeUser(user: BackendUser | User): User {
  const rawRole = user.role?.toLowerCase();
  if (!['admin', 'user', 'employee'].includes(rawRole))
    throw new ApiError('Backend kullanıcı rolü tanınmıyor.', 502);
  const role = rawRole === 'admin' ? 'admin' : 'employee';
  if ('fullName' in user) return { ...user, role };
  return {
    id: user.id,
    fullName: `${user.name} ${user.surName}`.trim(),
    email: user.email,
    role,
    isActive: user.status,
  };
}
function toSession(user: BackendUser): Session {
  if (!user.token) throw new ApiError('Giriş cevabında token bulunamadı.', 502);
  let expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  try {
    const part = user.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(part));
    if (typeof claims.exp === 'number') expiresAt = new Date(claims.exp * 1000).toISOString();
  } catch {
    /* Demo tokens use the same session shape without being signed JWTs. */
  }
  return { accessToken: user.token, expiresAt, user: normalizeUser(user) };
}
function userCommand(
  fullName: string,
  email: string,
  password: string,
  role: User['role'] = 'employee',
) {
  const words = fullName.trim().split(/\s+/);
  if (words.length < 2) throw new ApiError('Ad ve soyadını birlikte gir.', 400);
  return {
    name: words.slice(0, -1).join(' '),
    surName: words.at(-1),
    email,
    password,
    isAdmin: role === 'admin',
    createdBy: storedSession()?.user.id || 'self-registration',
  };
}
export const api = {
  login: async (email: string, password: string) =>
    toSession(await post<BackendUser>('/Logistic/User/Login', { email, password })),
  register: async (fullName: string, email: string, password: string) => {
    await post<BackendUser>('/Logistic/User/CreateUser', userCommand(fullName, email, password));
    return toSession(await post<BackendUser>('/Logistic/User/Login', { email, password }));
  },
  dashboard: () => request<Dashboard>('/dashboard'),
  products: () => request<Product[]>(listEndpoint('/Product', '/products')),
  createProduct: (body: ProductInput) => post<Product>(endpoint('/Product', '/products'), body),
  updateProduct: (id: string, body: ProductInput) =>
    request<Product>(`/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  shelves: () => request<Shelf[]>(listEndpoint('/Shelf', '/shelves')),
  createShelf: (body: ShelfInput) => post<Shelf>(endpoint('/Shelf', '/shelves'), body),
  stock: () => request<Stock[]>(listEndpoint('/Stock', '/stock')),
  movements: () => request<Movement[]>('/stock/movements'),
  lookupProduct: (barcode: string) =>
    request<Product>(`/products/by-barcode/${encodeURIComponent(barcode)}`),
  receipts: () => request<Receipt[]>(listEndpoint('/Receipt', '/receipts')),
  createReceipt: (body: ReceiptInput, key: string) =>
    request<Receipt>(endpoint('/Receipt', '/receipts'), {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Idempotency-Key': key },
    }),
  putaway: (body: PutawayInput, key: string) =>
    request<Movement>(endpoint('/Stock/Putaway', '/stock/putaway'), {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Idempotency-Key': key },
    }),
  sales: () => request<Sale[]>('/sales'),
  createSale: (body: SaleInput, key: string) =>
    request<Sale>('/sales', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Idempotency-Key': key },
    }),
  users: async () => (await request<(BackendUser | User)[]>('/users')).map(normalizeUser),
  createUser: async (body: UserInput) =>
    normalizeUser(
      await post<BackendUser>(
        '/Logistic/User/CreateUser',
        userCommand(body.fullName, body.email, body.password, body.role),
      ),
    ),
  updateUser: (id: string, body: { role: User['role']; isActive: boolean }) =>
    request<User>(`/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};
