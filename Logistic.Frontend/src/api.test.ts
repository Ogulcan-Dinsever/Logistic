import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, normalizeUser, persistSession } from './api';
import { connection } from './config';

vi.mock('./config', () => ({
  connection: { mode: 'live', baseUrl: 'https://localhost:7228/api' },
}));

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('sessionStorage', storage());
  connection.mode = 'live';
});
describe('Existing Logistic backend adapter', () => {
  it('uses the actual Login route and unwraps Response<UserResponse>', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `header.${btoa(JSON.stringify({ exp }))}.signature`;
    const backend = {
      id: 'u1',
      name: 'Deniz',
      surName: 'Kaya',
      email: 'admin@test.com',
      role: 'Admin',
      token,
      status: true,
    };
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ data: backend, errors: null }));
    const session = await api.login('admin@test.com', 'Password1');
    expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/Logistic\/User\/Login$/);
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual({
      email: 'admin@test.com',
      password: 'Password1',
    });
    expect(session.user.fullName).toBe('Deniz Kaya');
    expect(session.user.role).toBe('admin');
    expect(session.accessToken).toBe(token);
    expect(session.expiresAt).toBe(new Date(exp * 1000).toISOString());
    expect(session.user.isActive).toBe(true);
  });
  it('registers via the existing command and then logs in', async () => {
    const user = {
      id: 'u2',
      name: 'Elif',
      surName: 'Yılmaz',
      email: 'employee@test.com',
      role: 'User',
      status: true,
    };
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ data: user, errors: null }, { status: 201 }))
      .mockResolvedValueOnce(
        Response.json({ data: { ...user, token: 'test-token' }, errors: null }),
      );
    const session = await api.register('Elif Yılmaz', 'employee@test.com', 'Password1');
    const command = JSON.parse(fetcher.mock.calls[0][1]!.body as string);
    expect(command).toEqual({
      name: 'Elif',
      surName: 'Yılmaz',
      email: 'employee@test.com',
      password: 'Password1',
      isAdmin: false,
      createdBy: 'self-registration',
    });
    expect(fetcher.mock.calls[0][0]).toMatch(/\/Logistic\/User\/CreateUser$/);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(session.user.role).toBe('employee');
  });
  it('reports the existing backend error array and refuses unknown roles', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ data: null, errors: ['wrong password..'] }, { status: 409 }),
    );
    await expect(api.login('wrong@test.com', 'wrong')).rejects.toThrow('wrong password..');
    expect(() =>
      normalizeUser({
        id: 'u',
        name: 'A',
        surName: 'B',
        email: 'x@test.com',
        role: 'Guest',
        status: true,
      }),
    ).toThrow('rolü tanınmıyor');
  });
  it('sends Bearer token and Idempotency-Key for a stock mutation', async () => {
    persistSession({
      accessToken: 'signed-token',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      user: {
        id: 'u1',
        fullName: 'Deniz Kaya',
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      },
    });
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ id: 'r1' }, { status: 201 }));
    await api.createReceipt(
      { productId: 'p1', quantity: 10, supplier: 'Test', note: '' },
      'operation-id',
    );
    const headers = fetcher.mock.calls[0][1]!.headers as Headers;
    expect(fetcher.mock.calls[0][0]).toBe('https://localhost:7228/api/Receipt');
    expect(headers.get('Authorization')).toBe('Bearer signed-token');
    expect(headers.get('Idempotency-Key')).toBe('operation-id');
  });
  it('places products on the live shelf endpoint with token and operation key', async () => {
    persistSession({
      accessToken: 'user-token',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      user: {
        id: 'u2',
        fullName: 'Elif Yılmaz',
        email: 'user@test.com',
        role: 'employee',
        isActive: true,
      },
    });
    const payload = {
      productBarcode: '8690000001001',
      sourceShelfId: 'receiving-id',
      targetShelfCode: 'A-01',
      quantity: 10,
    };
    const movement = {
      id: 'm1',
      type: 'putaway',
      productId: 'p1',
      quantity: 10,
      fromShelfId: 'receiving-id',
      toShelfId: 's1',
      reference: 'RF-20261006-m1',
      createdAt: '2026-10-06T10:00:00Z',
      userName: 'Elif Yılmaz',
    };
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ data: movement, errors: null }, { status: 201 }));
    expect(await api.putaway(payload, 'putaway-operation-id')).toEqual(movement);
    const [url, options] = fetcher.mock.calls[0];
    const headers = options!.headers as Headers;
    expect(url).toBe('https://localhost:7228/api/Stock/Putaway');
    expect(options!.method).toBe('POST');
    expect(JSON.parse(options!.body as string)).toEqual(payload);
    expect(headers.get('Authorization')).toBe('Bearer user-token');
    expect(headers.get('Idempotency-Key')).toBe('putaway-operation-id');
  });
  it.each([
    [400, 'Miktar pozitif olmalıdır.'],
    [409, 'Hedef raf kapasitesi yetersiz.'],
  ])('reports a rejected putaway (%s) without accepting a movement', async (status, message) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ data: null, errors: [message] }, { status }),
    );
    await expect(
      api.putaway(
        {
          productBarcode: '8690000001001',
          sourceShelfId: 'receiving-id',
          targetShelfCode: 'A-01',
          quantity: 10,
        },
        'putaway-operation-id',
      ),
    ).rejects.toMatchObject({ message, status });
  });
  it('preserves the demo putaway route and operation key', async () => {
    connection.mode = 'demo';
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ id: 'm1' }, { status: 201 }));
    await api.putaway(
      {
        productBarcode: '8690000001001',
        sourceShelfId: 'receiving-id',
        targetShelfCode: 'A-01',
        quantity: 1,
      },
      'demo-putaway-key',
    );
    expect(fetcher.mock.calls[0][0]).toBe('https://localhost:7228/api/stock/putaway');
    expect((fetcher.mock.calls[0][1]!.headers as Headers).get('Idempotency-Key')).toBe(
      'demo-putaway-key',
    );
  });
  it.each([
    ['products', 'Product', 'products'],
    ['shelves', 'Shelf', 'shelves'],
    ['stock', 'Stock', 'stock'],
    ['receipts', 'Receipt', 'receipts'],
  ] as const)(
    'uses live pagination and preserves demo routes for %s',
    async (method, live, demo) => {
      const rows = [{ id: 'one' }];
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(Response.json({ data: rows }));
      expect(await api[method]()).toEqual(rows);
      expect(fetcher.mock.calls[0][0]).toBe(
        `https://localhost:7228/api/${live}?pageId=1&take=1000`,
      );
      connection.mode = 'demo';
      await api[method]();
      expect(fetcher.mock.calls[1][0]).toBe(`https://localhost:7228/api/${demo}`);
    },
  );
  it('creates live products and shelves on the actual backend routes', async () => {
    const product = {
      name: 'Klavye',
      sku: 'ELK-001',
      barcode: '8690000001001',
      category: 'Elektronik',
      unit: 'adet',
      salePrice: 250,
      minStock: 5,
    };
    const shelf = { code: 'A-01', zone: 'A bölgesi', capacity: 100 };
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ data: { ...product, id: 'p1', isActive: true } }))
      .mockResolvedValueOnce(Response.json({ data: { ...shelf, id: 's1', isReceiving: false } }));
    expect((await api.createProduct(product)).id).toBe('p1');
    expect((await api.createShelf(shelf)).id).toBe('s1');
    expect(fetcher.mock.calls[0][0]).toBe('https://localhost:7228/api/Product');
    expect(fetcher.mock.calls[1][0]).toBe('https://localhost:7228/api/Shelf');
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual(product);
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string)).toEqual(shelf);
  });
  it('preserves demo creation routes', async () => {
    connection.mode = 'demo';
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ id: 'created' }));
    await api.createShelf({ code: 'A-01', zone: 'A', capacity: 100 });
    await api.createReceipt({ supplier: 'Test', productId: 'p1', quantity: 1, note: '' }, 'key');
    expect(fetcher.mock.calls[0][0]).toBe('https://localhost:7228/api/shelves');
    expect(fetcher.mock.calls[1][0]).toBe('https://localhost:7228/api/receipts');
  });
  it('does not create a session when login returns no token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        data: {
          id: 'u1',
          name: 'Deniz',
          surName: 'Kaya',
          email: 'admin@logistic.demo',
          role: 'Admin',
          status: true,
        },
      }),
    );
    await expect(api.login('admin@logistic.demo', 'Demo123!')).rejects.toThrow(
      'Giriş cevabında token bulunamadı.',
    );
  });
});
