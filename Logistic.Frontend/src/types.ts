export type Role = 'admin' | 'employee';
export interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
}
export interface Session {
  accessToken: string;
  expiresAt: string;
  user: User;
}
export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  unit: string;
  salePrice: number;
  minStock: number;
  isActive: boolean;
}
export interface Shelf {
  id: string;
  code: string;
  zone: string;
  capacity: number;
  isReceiving: boolean;
}
export interface Stock {
  productId: string;
  shelfId: string;
  quantity: number;
}
export interface Movement {
  id: string;
  type: 'receipt' | 'putaway' | 'sale';
  productId: string;
  quantity: number;
  fromShelfId: string | null;
  toShelfId: string | null;
  reference: string;
  createdAt: string;
  userName: string;
}
export interface Receipt {
  id: string;
  reference: string;
  supplier: string;
  productId: string;
  quantity: number;
  note: string;
  createdAt: string;
  userName: string;
}
export interface SaleLine {
  productId: string;
  shelfId: string;
  quantity: number;
  unitPrice: number;
}
export interface Sale {
  id: string;
  reference: string;
  customer: string;
  lines: SaleLine[];
  total: number;
  createdAt: string;
  userName: string;
}
export interface Dashboard {
  totalUnits: number;
  activeProducts: number;
  occupiedShelves: number;
  totalShelves: number;
  lowStockCount: number;
  todayReceipts: number;
  todaySales: number;
  todayRevenue: number;
  dailyActivity: { date: string; received: number; sold: number }[];
}
export interface ReceiptInput {
  supplier: string;
  productId: string;
  quantity: number;
  note: string;
}
export interface PutawayInput {
  productBarcode: string;
  sourceShelfId: string;
  targetShelfCode: string;
  quantity: number;
}
export interface SaleInput {
  customer: string;
  lines: SaleLine[];
}
export type ProductInput = Omit<Product, 'id' | 'isActive'>;
export type UserInput = { fullName: string; email: string; password: string; role: Role };
export type ShelfInput = Pick<Shelf, 'code' | 'zone' | 'capacity'>;
export interface WarehouseData {
  dashboard: Dashboard;
  products: Product[];
  shelves: Shelf[];
  stock: Stock[];
  movements: Movement[];
  receipts: Receipt[];
  sales: Sale[];
}
