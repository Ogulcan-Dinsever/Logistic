import { beforeEach, describe, expect, it } from 'vitest';
import { handleDemoRequest, resetDemo } from './engine';
import type { Stock } from '../types';

const origin = 'https://localhost:7228/api';
async function call(path: string, method = 'GET', body?: unknown, token?: string, key?: string) {
  const response = await handleDemoRequest(
    new Request(`${origin}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
  return { status: response.status, body: await response.json() };
}
async function login(role = 'admin') {
  const result = await call('/Logistic/User/Login', 'POST', {
    email: `${role}@logistic.demo`,
    password: 'Demo123!',
  });
  expect(result.status).toBe(200);
  return result.body.data.token as string;
}
async function quantity(token: string, productId: string, shelfId: string) {
  const { body } = await call('/stock', 'GET', undefined, token);
  return (
    (body as Stock[]).find((s) => s.productId === productId && s.shelfId === shelfId)?.quantity || 0
  );
}
beforeEach(resetDemo);
describe('Warehouse HTTP contract', () => {
  it('executes receipt → putaway → sale with conserved stock', async () => {
    const token = await login();
    const before = await quantity(token, 'p1', 's1');
    const dockBefore = await quantity(token, 'p1', 'receiving');
    expect(
      (
        await call(
          '/receipts',
          'POST',
          { supplier: 'Test Tedarik', productId: 'p1', quantity: 10, note: '' },
          token,
          'receipt-1',
        )
      ).status,
    ).toBe(201);
    expect(await quantity(token, 'p1', 'receiving')).toBe(dockBefore + 10);
    expect(
      (
        await call(
          '/stock/putaway',
          'POST',
          {
            productBarcode: '8690000001001',
            sourceShelfId: 'receiving',
            targetShelfCode: 'A-01',
            quantity: 10,
          },
          token,
          'put-1',
        )
      ).status,
    ).toBe(201);
    expect(await quantity(token, 'p1', 'receiving')).toBe(dockBefore);
    expect(await quantity(token, 'p1', 's1')).toBe(before + 10);
    const sale = await call(
      '/sales',
      'POST',
      {
        customer: 'Test Müşteri',
        lines: [{ productId: 'p1', shelfId: 's1', quantity: 2, unitPrice: 249.9 }],
      },
      token,
      'sale-1',
    );
    expect(sale.status).toBe(201);
    expect(sale.body.total).toBe(499.8);
    expect(await quantity(token, 'p1', 's1')).toBe(before + 8);
  });
  it('does not apply a retried stock command twice and rejects changed payload', async () => {
    const token = await login();
    const before = await quantity(token, 'p1', 'receiving');
    const payload = { supplier: 'Test', productId: 'p1', quantity: 10, note: '' };
    const first = await call('/receipts', 'POST', payload, token, 'same-key');
    const again = await call('/receipts', 'POST', payload, token, 'same-key');
    expect(again.body.id).toBe(first.body.id);
    expect(await quantity(token, 'p1', 'receiving')).toBe(before + 10);
    expect(
      (await call('/receipts', 'POST', { ...payload, quantity: 20 }, token, 'same-key')).status,
    ).toBe(409);
  });
  it('rejects an entire multi-line sale when a later line lacks stock', async () => {
    const token = await login();
    const before = await quantity(token, 'p1', 's1');
    const result = await call(
      '/sales',
      'POST',
      {
        customer: 'Test',
        lines: [
          { productId: 'p1', shelfId: 's1', quantity: 2, unitPrice: 249.9 },
          { productId: 'p2', shelfId: 's2', quantity: 100, unitPrice: 589 },
        ],
      },
      token,
      'atomic',
    );
    expect(result.status).toBe(409);
    expect(await quantity(token, 'p1', 's1')).toBe(before);
  });
  it('aggregates duplicate shelf/product lines before checking availability', async () => {
    const token = await login();
    const line = { productId: 'p2', shelfId: 's2', quantity: 15, unitPrice: 589 };
    expect(
      (await call('/sales', 'POST', { customer: 'Test', lines: [line, line] }, token, 'aggregate'))
        .status,
    ).toBe(409);
    expect(await quantity(token, 'p2', 's2')).toBe(24);
  });
  it('rejects selling from receiving, over-capacity putaway and negative stock', async () => {
    const token = await login();
    expect(
      (
        await call(
          '/sales',
          'POST',
          {
            customer: 'Test',
            lines: [{ productId: 'p1', shelfId: 'receiving', quantity: 1, unitPrice: 1 }],
          },
          token,
          'dock',
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await call(
          '/stock/putaway',
          'POST',
          {
            productBarcode: '8690000001003',
            sourceShelfId: 's4',
            targetShelfCode: 'B-03',
            quantity: 200,
          },
          token,
          'capacity',
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          '/receipts',
          'POST',
          { supplier: 'Test', productId: 'p1', quantity: -3 },
          token,
          'negative',
        )
      ).status,
    ).toBe(400);
  });
  it('requires authentication and enforces employee restrictions server-side', async () => {
    expect((await call('/stock')).status).toBe(401);
    expect((await call('/stock', 'GET', undefined, 'demo-forged')).status).toBe(401);
    const token = await login('employee');
    expect((await call('/users', 'GET', undefined, token)).status).toBe(403);
    expect(
      (await call('/shelves', 'POST', { code: 'D-01', zone: 'D', capacity: 100 }, token)).status,
    ).toBe(403);
    expect(
      (
        await call(
          '/Logistic/User/CreateUser',
          'POST',
          {
            name: 'Yeni',
            surName: 'Admin',
            email: 'bad@test.com',
            password: 'Password1',
            isAdmin: true,
          },
          token,
        )
      ).status,
    ).toBe(403);
  });
  it('forces public registration to Employee even with tampered isAdmin', async () => {
    expect(
      (
        await call('/Logistic/User/CreateUser', 'POST', {
          name: 'Yeni',
          surName: 'Çalışan',
          email: 'new@test.com',
          password: 'Password1',
          isAdmin: true,
        })
      ).status,
    ).toBe(201);
    const result = await call('/Logistic/User/Login', 'POST', {
      email: 'new@test.com',
      password: 'Password1',
    });
    expect(result.body.data.role).toBe('User');
    expect((await call('/users', 'GET', undefined, result.body.data.token)).status).toBe(403);
  });
  it('invalidates access for disabled users and prevents self-demotion', async () => {
    const admin = await login();
    const employee = await login('employee');
    expect(
      (await call('/users/u1', 'PATCH', { role: 'employee', isActive: false }, admin)).status,
    ).toBe(400);
    expect(
      (await call('/users/u2', 'PATCH', { role: 'employee', isActive: false }, admin)).status,
    ).toBe(200);
    expect((await call('/stock', 'GET', undefined, employee)).status).toBe(401);
  });
  it('rejects unknown barcodes and duplicate catalog keys', async () => {
    const token = await login();
    expect((await call('/products/by-barcode/unknown', 'GET', undefined, token)).status).toBe(404);
    const product = (await call('/products', 'GET', undefined, token)).body[0];
    expect((await call('/products', 'POST', product, token)).status).toBe(409);
  });
});
