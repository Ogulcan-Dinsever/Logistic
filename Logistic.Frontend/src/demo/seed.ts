import type { Movement, Product, Receipt, Sale, Shelf, Stock, User } from '../types';
export interface DemoUser extends User {
  passwordHash?: string;
}
export interface DemoDatabase {
  version: number;
  users: DemoUser[];
  products: Product[];
  shelves: Shelf[];
  stock: Stock[];
  movements: Movement[];
  receipts: Receipt[];
  sales: Sale[];
  tokens: Record<string, { userId: string; expires: number }>;
  operations: Record<string, { fingerprint: string; data: unknown }>;
}
export const dayKey = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
export function seedDatabase(): DemoDatabase {
  const products: Product[] = [
    {
      id: 'p1',
      name: 'USB-C Şarj Kablosu',
      sku: 'ELK-001',
      barcode: '8690000001001',
      category: 'Elektronik',
      unit: 'adet',
      salePrice: 249.9,
      minStock: 50,
      isActive: true,
    },
    {
      id: 'p2',
      name: 'Kablosuz Mouse',
      sku: 'ELK-002',
      barcode: '8690000001002',
      category: 'Elektronik',
      unit: 'adet',
      salePrice: 589,
      minStock: 30,
      isActive: true,
    },
    {
      id: 'p3',
      name: 'Kraft Kargo Kutusu · M',
      sku: 'PKT-001',
      barcode: '8690000001003',
      category: 'Ambalaj',
      unit: 'adet',
      salePrice: 24.5,
      minStock: 100,
      isActive: true,
    },
    {
      id: 'p4',
      name: 'Pamuklu Basic Tişört',
      sku: 'TKS-001',
      barcode: '8690000001004',
      category: 'Tekstil',
      unit: 'adet',
      salePrice: 399,
      minStock: 40,
      isActive: true,
    },
    {
      id: 'p5',
      name: 'Seramik Kupa · 350 ml',
      sku: 'EV-001',
      barcode: '8690000001005',
      category: 'Ev & yaşam',
      unit: 'adet',
      salePrice: 189,
      minStock: 25,
      isActive: true,
    },
    {
      id: 'p6',
      name: 'A5 Çizgili Defter',
      sku: 'OFS-001',
      barcode: '8690000001006',
      category: 'Ofis',
      unit: 'adet',
      salePrice: 79.9,
      minStock: 50,
      isActive: true,
    },
    {
      id: 'p7',
      name: 'Bluetooth Hoparlör',
      sku: 'ELK-003',
      barcode: '8690000001007',
      category: 'Elektronik',
      unit: 'adet',
      salePrice: 1299,
      minStock: 20,
      isActive: true,
    },
    {
      id: 'p8',
      name: 'Kargo Poşeti · 30×40',
      sku: 'PKT-002',
      barcode: '8690000001008',
      category: 'Ambalaj',
      unit: 'adet',
      salePrice: 4.9,
      minStock: 100,
      isActive: true,
    },
  ];
  const shelves: Shelf[] = [
    { id: 'receiving', code: 'KABUL', zone: 'Mal kabul alanı', capacity: 10000, isReceiving: true },
    ...['A-01', 'A-02', 'A-03', 'B-01', 'B-02', 'B-03', 'C-01', 'C-02', 'C-03'].map((code, i) => ({
      id: `s${i + 1}`,
      code,
      zone: `${code[0]} bölgesi`,
      capacity: 600,
      isReceiving: false,
    })),
  ];
  const stock: Stock[] = [
    { productId: 'p1', shelfId: 's1', quantity: 186 },
    { productId: 'p1', shelfId: 'receiving', quantity: 32 },
    { productId: 'p2', shelfId: 's2', quantity: 24 },
    { productId: 'p3', shelfId: 's4', quantity: 420 },
    { productId: 'p4', shelfId: 's5', quantity: 156 },
    { productId: 'p5', shelfId: 's7', quantity: 68 },
    { productId: 'p6', shelfId: 's8', quantity: 214 },
    { productId: 'p7', shelfId: 's3', quantity: 12 },
    { productId: 'p8', shelfId: 's6', quantity: 490 },
    { productId: 'p4', shelfId: 'receiving', quantity: 24 },
  ];
  const movements: Movement[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(9, 15, 0, 0);
    movements.push({
      id: `seed-r${i}`,
      type: 'receipt',
      productId: 'p1',
      quantity: [32, 48, 64, 40, 72, 56, 32][i],
      fromShelfId: null,
      toShelfId: 'receiving',
      reference: `MK-100${i}`,
      createdAt: date.toISOString(),
      userName: 'Elif Yılmaz',
    });
    date.setHours(10, 30);
    movements.push({
      id: `seed-s${i}`,
      type: 'sale',
      productId: 'p3',
      quantity: [18, 32, 25, 42, 28, 36, 22][i],
      fromShelfId: 's4',
      toShelfId: null,
      reference: `ST-100${i}`,
      createdAt: date.toISOString(),
      userName: 'Elif Yılmaz',
    });
  }
  movements.push({
    id: 'seed-putaway',
    type: 'putaway',
    productId: 'p4',
    quantity: 24,
    fromShelfId: 'receiving',
    toShelfId: 's5',
    reference: 'RF-1001',
    createdAt: new Date().toISOString(),
    userName: 'Elif Yılmaz',
  });
  return {
    version: 1,
    users: [
      {
        id: 'u1',
        fullName: 'Deniz Kaya',
        email: 'admin@logistic.demo',
        role: 'admin',
        isActive: true,
      },
      {
        id: 'u2',
        fullName: 'Elif Yılmaz',
        email: 'employee@logistic.demo',
        role: 'employee',
        isActive: true,
      },
    ],
    products,
    shelves,
    stock,
    movements,
    receipts: movements
      .filter((m) => m.type === 'receipt')
      .map((m) => ({
        id: m.id,
        reference: m.reference,
        supplier: 'Marmara Tedarik',
        productId: 'p1',
        quantity: m.quantity,
        note: 'Örnek mal kabul kaydı',
        createdAt: m.createdAt,
        userName: 'Elif Yılmaz',
      })),
    sales: movements
      .filter((m) => m.type === 'sale')
      .map((m) => ({
        id: m.id,
        reference: m.reference,
        customer: 'Atlas Mağazacılık',
        lines: [{ productId: 'p3', shelfId: 's4', quantity: m.quantity, unitPrice: 24.5 }],
        total: m.quantity * 24.5,
        createdAt: m.createdAt,
        userName: 'Elif Yılmaz',
      })),
    tokens: {},
    operations: {},
  };
}
