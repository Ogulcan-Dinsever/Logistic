import { dayKey, seedDatabase } from './seed';
import type { DemoDatabase, DemoUser } from './seed';
import type { Dashboard, ProductInput, SaleLine } from '../types';

const STORE = 'logistic.demo.v1';
let memory = seedDatabase();
function read(): DemoDatabase {
  if (typeof localStorage === 'undefined') return structuredClone(memory);
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved?.version === 1) return saved;
  } catch {
    /* Reset invalid demo data. */
  }
  return seedDatabase();
}
function save(db: DemoDatabase) {
  if (typeof localStorage === 'undefined') memory = structuredClone(db);
  else localStorage.setItem(STORE, JSON.stringify(db));
}
export function resetDemo() {
  save(seedDatabase());
}
class RuleError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
function check(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new RuleError(message, status);
}
function textField(value: unknown, label: string, max = 200): string {
  check(
    typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max,
    `${label} alanını kontrol et.`,
  );
  return value.trim();
}
function amount(value: unknown, label: string, min = 1): number {
  check(
    typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= 1000000,
    `${label} geçerli bir tam sayı olmalı.`,
  );
  return value;
}
function price(value: unknown): number {
  check(
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10000000,
    'Birim fiyat geçerli değil.',
  );
  return Math.round(value * 100) / 100;
}
function publicUser(user: DemoUser) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}
function backendUser(user: DemoUser, token?: string) {
  const parts = user.fullName.split(' ');
  return {
    id: user.id,
    name: parts.slice(0, -1).join(' '),
    surName: parts.at(-1),
    email: user.email,
    role: user.role === 'admin' ? 'Admin' : 'User',
    status: user.isActive,
    ...(token ? { token } : {}),
  };
}
async function hash(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function authenticate(db: DemoDatabase, request: Request): DemoUser {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
  const session = db.tokens[token];
  const user = db.users.find((u) => u.id === session?.userId);
  check(
    user && user.isActive && session.expires > Date.now(),
    'Oturumun sona erdi. Tekrar giriş yap.',
    401,
  );
  return user;
}
function admin(user: DemoUser) {
  check(user.role === 'admin', 'Bu işlem için Admin yetkisi gerekiyor.', 403);
}
function changeStock(db: DemoDatabase, productId: string, shelfId: string, delta: number) {
  const row = db.stock.find((s) => s.productId === productId && s.shelfId === shelfId);
  if (row) row.quantity += delta;
  else db.stock.push({ productId, shelfId, quantity: delta });
  db.stock = db.stock.filter((s) => s.quantity > 0);
}
const json = (data: unknown, status = 200) => Response.json(data, { status });
function nextReference(db: DemoDatabase, prefix: string) {
  const values = db.movements
    .filter((m) => m.reference.startsWith(`${prefix}-`))
    .map((m) => Number(m.reference.split('-').at(-1)));
  return `${prefix}-${Math.max(1000, ...values.filter(Number.isFinite)) + 1}`;
}
function dashboard(db: DemoDatabase): Dashboard {
  const today = dayKey(new Date());
  const storage = db.shelves.filter((s) => !s.isReceiving);
  return {
    totalUnits: db.stock.reduce((sum, s) => sum + s.quantity, 0),
    activeProducts: db.products.filter((p) => p.isActive).length,
    occupiedShelves: storage.filter((s) =>
      db.stock.some((row) => row.shelfId === s.id && row.quantity > 0),
    ).length,
    totalShelves: storage.length,
    lowStockCount: db.products.filter(
      (p) =>
        p.isActive &&
        db.stock.filter((s) => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0) <
          p.minStock,
    ).length,
    todayReceipts: db.receipts.filter((r) => dayKey(new Date(r.createdAt)) === today).length,
    todaySales: db.sales.filter((r) => dayKey(new Date(r.createdAt)) === today).length,
    todayRevenue: db.sales
      .filter((r) => dayKey(new Date(r.createdAt)) === today)
      .reduce((sum, r) => sum + r.total, 0),
    dailyActivity: Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - 6 + i);
      const key = dayKey(date);
      const rows = db.movements.filter((m) => dayKey(new Date(m.createdAt)) === key);
      return {
        date: key,
        received: rows.filter((m) => m.type === 'receipt').reduce((s, m) => s + m.quantity, 0),
        sold: rows.filter((m) => m.type === 'sale').reduce((s, m) => s + m.quantity, 0),
      };
    }),
  };
}

// The demo implements the HTTP contract. Production requests go to the .NET API.
export async function handleDemoRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname.slice(url.pathname.indexOf('/api') + 4);
    const method = request.method;
    const body = method === 'GET' ? {} : ((await request.json()) as Record<string, unknown>);
    // Password hashing happens before taking a fresh database snapshot.
    const passwordHash = typeof body.password === 'string' ? await hash(body.password) : undefined;
    const seedHash = path.endsWith('/Login') ? await hash('Demo123!') : undefined;
    const db = read();
    if (path === '/Logistic/User/Login' && method === 'POST') {
      const user = db.users.find(
        (u) => u.email.toLowerCase() === String(body.email).trim().toLowerCase(),
      );
      check(
        user?.isActive && passwordHash === (user.passwordHash || seedHash),
        'E-posta veya şifre hatalı.',
        401,
      );
      const token = `demo-${crypto.randomUUID()}`;
      db.tokens[token] = { userId: user.id, expires: Date.now() + 60 * 60 * 1000 };
      save(db);
      return json({ data: backendUser(user, token), errors: null });
    }
    if (path === '/Logistic/User/CreateUser' && method === 'POST') {
      let creator: DemoUser | null = null;
      if (request.headers.has('Authorization')) {
        creator = authenticate(db, request);
        admin(creator);
      }
      const email = textField(body.email, 'E-posta').toLowerCase();
      check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Geçerli bir e-posta gir.');
      check(!db.users.some((u) => u.email === email), 'Bu e-posta zaten kayıtlı.', 409);
      check(
        typeof body.password === 'string' && body.password.length >= 8,
        'Şifre en az 8 karakter olmalı.',
      );
      const user: DemoUser = {
        id: crypto.randomUUID(),
        fullName: `${textField(body.name, 'Ad', 80)} ${textField(body.surName, 'Soyad', 80)}`,
        email,
        role: creator && body.isAdmin === true ? 'admin' : 'employee',
        isActive: true,
        passwordHash,
      };
      db.users.push(user);
      save(db);
      return json({ data: backendUser(user), errors: null }, 201);
    }
    const user = authenticate(db, request);
    if (method === 'GET') {
      if (path === '/auth/me') return json(publicUser(user));
      if (path === '/dashboard') return json(dashboard(db));
      if (path === '/products') return json(db.products);
      if (path.startsWith('/products/by-barcode/')) {
        const product = db.products.find(
          (p) => p.barcode === decodeURIComponent(path.split('/').at(-1)!) && p.isActive,
        );
        check(product, 'Bu barkoda ait ürün bulunamadı.', 404);
        return json(product);
      }
      if (path === '/shelves') return json(db.shelves);
      if (path === '/stock') return json(db.stock);
      if (path === '/stock/movements')
        return json([...db.movements].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      if (path === '/receipts') return json([...db.receipts].reverse());
      if (path === '/sales') return json([...db.sales].reverse());
      if (path === '/users') {
        admin(user);
        return json(db.users.map(publicUser));
      }
    }
    if (path.startsWith('/users/') && method === 'PATCH') {
      admin(user);
      const target = db.users.find((u) => u.id === path.split('/').at(-1));
      check(target, 'Kullanıcı bulunamadı.', 404);
      check(target.id !== user.id, 'Kendi yetkini veya durumunu değiştiremezsin.');
      check(
        ['admin', 'employee'].includes(String(body.role)) && typeof body.isActive === 'boolean',
        'Rol veya durum geçerli değil.',
      );
      target.role = body.role as DemoUser['role'];
      target.isActive = body.isActive as boolean;
      save(db);
      return json(publicUser(target));
    }
    if (
      (path === '/products' && method === 'POST') ||
      (path.startsWith('/products/') && method === 'PUT')
    ) {
      admin(user);
      const id = method === 'PUT' ? path.split('/').at(-1)! : crypto.randomUUID();
      const input: ProductInput = {
        name: textField(body.name, 'Ürün adı'),
        sku: textField(body.sku, 'SKU', 40).toUpperCase(),
        barcode: textField(body.barcode, 'Barkod', 60),
        category: textField(body.category, 'Kategori', 60),
        unit: textField(body.unit, 'Birim', 20),
        salePrice: price(body.salePrice),
        minStock: amount(body.minStock, 'Minimum stok', 0),
      };
      check(['adet', 'kutu', 'paket'].includes(input.unit), 'Birim adet, kutu veya paket olmalı.');
      check(
        !db.products.some(
          (p) => p.id !== id && (p.sku === input.sku || p.barcode === input.barcode),
        ),
        'SKU veya barkod başka bir üründe kullanılıyor.',
        409,
      );
      const existing = db.products.find((p) => p.id === id);
      if (method === 'PUT') check(existing, 'Ürün bulunamadı.', 404);
      const product = { ...input, id, isActive: true };
      if (existing) Object.assign(existing, product);
      else db.products.push(product);
      save(db);
      return json(product, method === 'POST' ? 201 : 200);
    }
    if (path === '/shelves' && method === 'POST') {
      admin(user);
      const code = textField(body.code, 'Raf kodu', 30).toUpperCase();
      check(!db.shelves.some((s) => s.code === code), 'Bu raf kodu zaten var.', 409);
      const shelf = {
        id: crypto.randomUUID(),
        code,
        zone: textField(body.zone, 'Bölge', 60),
        capacity: amount(body.capacity, 'Kapasite'),
        isReceiving: false,
      };
      db.shelves.push(shelf);
      save(db);
      return json(shelf, 201);
    }
    if (method === 'POST' && ['/receipts', '/stock/putaway', '/sales'].includes(path)) {
      const key = request.headers.get('Idempotency-Key');
      check(key && key.length <= 100, 'Idempotency-Key başlığı gerekli.');
      const operationKey = `${user.id}:${path}:${key}`;
      const fingerprint = JSON.stringify(body);
      const cached = db.operations[operationKey];
      if (cached) {
        check(
          cached.fingerprint === fingerprint,
          'Bu işlem anahtarı farklı bir istek için kullanılmış.',
          409,
        );
        return json(cached.data);
      }
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      let result: unknown;
      if (path === '/receipts') {
        const product = db.products.find((p) => p.id === body.productId && p.isActive);
        check(product, 'Ürün bulunamadı.', 404);
        const quantity = amount(body.quantity, 'Miktar');
        const shelf = db.shelves.find((s) => s.isReceiving);
        check(shelf, 'Mal kabul alanı tanımlı değil.', 409);
        check(
          db.stock.filter((s) => s.shelfId === shelf.id).reduce((sum, s) => sum + s.quantity, 0) +
            quantity <=
            shelf.capacity,
          'Mal kabul alanının kapasitesi yetersiz.',
          409,
        );
        const receipt = {
          id,
          reference: nextReference(db, 'MK'),
          supplier: textField(body.supplier, 'Tedarikçi'),
          productId: product.id,
          quantity,
          note: typeof body.note === 'string' ? body.note.slice(0, 500) : '',
          createdAt,
          userName: user.fullName,
        };
        changeStock(db, product.id, shelf.id, quantity);
        db.receipts.push(receipt);
        db.movements.push({
          id,
          type: 'receipt',
          productId: product.id,
          quantity,
          fromShelfId: null,
          toShelfId: shelf.id,
          reference: receipt.reference,
          createdAt,
          userName: user.fullName,
        });
        result = receipt;
      }
      if (path === '/stock/putaway') {
        const product = db.products.find((p) => p.barcode === body.productBarcode && p.isActive);
        check(product, 'Ürün barkodu bulunamadı.', 404);
        const source = db.shelves.find((s) => s.id === body.sourceShelfId);
        const target = db.shelves.find(
          (s) => s.code === String(body.targetShelfCode).trim().toUpperCase(),
        );
        check(source && target && !target.isReceiving, 'Geçerli bir kaynak ve hedef raf seç.');
        check(source.id !== target.id, 'Kaynak ve hedef raf aynı olamaz.');
        const quantity = amount(body.quantity, 'Miktar');
        const available =
          db.stock.find((s) => s.productId === product.id && s.shelfId === source.id)?.quantity ||
          0;
        check(available >= quantity, 'Kaynak rafta yeterli stok yok.', 409);
        const used = db.stock
          .filter((s) => s.shelfId === target.id)
          .reduce((sum, s) => sum + s.quantity, 0);
        check(used + quantity <= target.capacity, 'Hedef rafın kapasitesi yetersiz.', 409);
        changeStock(db, product.id, source.id, -quantity);
        changeStock(db, product.id, target.id, quantity);
        const movement = {
          id,
          type: 'putaway' as const,
          productId: product.id,
          quantity,
          fromShelfId: source.id,
          toShelfId: target.id,
          reference: nextReference(db, 'RF'),
          createdAt,
          userName: user.fullName,
        };
        db.movements.push(movement);
        result = movement;
      }
      if (path === '/sales') {
        check(
          Array.isArray(body.lines) && body.lines.length > 0 && body.lines.length <= 100,
          'Satışa en az bir ürün ekle.',
        );
        const customer = textField(body.customer, 'Müşteri');
        const lines: SaleLine[] = [];
        const required = new Map<string, number>();
        for (const input of body.lines) {
          const product = db.products.find((p) => p.id === input.productId && p.isActive);
          const shelf = db.shelves.find((s) => s.id === input.shelfId && !s.isReceiving);
          check(product && shelf, 'Satış ürünü ve depolama rafı geçerli olmalı.');
          const quantity = amount(input.quantity, 'Miktar');
          const pair = `${product.id}:${shelf.id}`;
          required.set(pair, (required.get(pair) || 0) + quantity);
          const available =
            db.stock.find((s) => s.productId === product.id && s.shelfId === shelf.id)?.quantity ||
            0;
          check(
            available >= required.get(pair)!,
            `${product.name} için ${shelf.code} rafında yeterli stok yok.`,
            409,
          );
          lines.push({
            productId: product.id,
            shelfId: shelf.id,
            quantity,
            unitPrice: price(input.unitPrice),
          });
        }
        // Validate every line before mutating any stock (atomic sale).
        const sale = {
          id,
          reference: nextReference(db, 'ST'),
          customer,
          lines,
          total:
            Math.round(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0) * 100) / 100,
          createdAt,
          userName: user.fullName,
        };
        for (const line of lines) {
          changeStock(db, line.productId, line.shelfId, -line.quantity);
          db.movements.push({
            id: crypto.randomUUID(),
            type: 'sale',
            productId: line.productId,
            quantity: line.quantity,
            fromShelfId: line.shelfId,
            toShelfId: null,
            reference: sale.reference,
            createdAt,
            userName: user.fullName,
          });
        }
        db.sales.push(sale);
        result = sale;
      }
      db.operations[operationKey] = { fingerprint, data: result };
      save(db);
      return json(result, 201);
    }
    throw new RuleError('Endpoint bulunamadı.', 404);
  } catch (error) {
    if (error instanceof RuleError)
      return json(
        { title: 'İşlem tamamlanamadı', status: error.status, detail: error.message },
        error.status,
      );
    return json(
      { title: 'Geçersiz istek', status: 400, detail: 'Gönderilen verileri kontrol et.' },
      400,
    );
  }
}
