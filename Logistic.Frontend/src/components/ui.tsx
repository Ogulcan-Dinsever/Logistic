import { useEffect, useRef } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Box,
  Check,
  Loader2,
  Package,
  Shirt,
  X,
} from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Movement, Product, WarehouseData } from '../types';

export const number = (value: number) => new Intl.NumberFormat('tr-TR').format(value);
export const money = (value: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value));
export function Button({
  children,
  variant = 'primary',
  busy = false,
  className = '',
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  busy?: boolean;
}) {
  return (
    <button {...props} disabled={disabled || busy} className={`button ${variant} ${className}`}>
      {busy && <Loader2 size={16} className="spin" />}
      {children}
    </button>
  );
}
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}
export function Badge({
  children,
  tone = 'green',
}: {
  children: ReactNode;
  tone?: 'green' | 'orange' | 'neutral' | 'blue';
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function ProductIcon({ product }: { product?: Product }) {
  const Icon =
    product?.category === 'Tekstil' ? Shirt : product?.category === 'Ambalaj' ? Package : Box;
  return (
    <span
      className={`product-icon ${product?.category === 'Elektronik' ? 'mint' : product?.category === 'Tekstil' ? 'lavender' : 'sand'}`}
    >
      <Icon size={19} strokeWidth={1.6} />
    </span>
  );
}
export function ProductLabel({
  product,
  compact = false,
}: {
  product?: Product;
  compact?: boolean;
}) {
  return (
    <div className="product-label">
      <ProductIcon product={product} />
      <div>
        <strong>{product?.name || 'Ürün'}</strong>
        {!compact && <small>{product?.sku}</small>}
      </div>
    </div>
  );
}
export function ErrorBox({ message }: { message?: string }) {
  return message ? (
    <div role="alert" className="error-box">
      {message}
    </div>
  ) : null;
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Package size={26} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <Loader2 className="spin" size={23} />
      <span>Depo bilgileri yükleniyor…</span>
    </div>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-heading">
        <div>
          <h2 id="modal-title">{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button className="icon-button" aria-label="Pencereyi kapat" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Success({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="success-panel">
      <span>
        <Check size={18} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}
const movementMeta = {
  receipt: { label: 'Mal kabul', tone: 'green', Icon: ArrowDownLeft },
  putaway: { label: 'Raf yerleştirme', tone: 'blue', Icon: ArrowRightLeft },
  sale: { label: 'Satış', tone: 'orange', Icon: ArrowUpRight },
} as const;
export function Movements({ rows, data }: { rows: Movement[]; data: WarehouseData }) {
  if (!rows.length)
    return (
      <Empty
        title="Henüz hareket yok"
        description="İlk mal kabul veya satış işlemin burada görünecek."
      />
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>İşlem / ürün</th>
            <th>Miktar</th>
            <th>Konum</th>
            <th>İşlemi yapan</th>
            <th>Tarih</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const meta = movementMeta[row.type];
            const product = data.products.find((p) => p.id === row.productId);
            const source = data.shelves.find((s) => s.id === row.fromShelfId)?.code;
            const target = data.shelves.find((s) => s.id === row.toShelfId)?.code;
            return (
              <tr key={row.id}>
                <td>
                  <div className="movement-label">
                    <span className={`movement-icon ${meta.tone}`}>
                      <meta.Icon size={17} />
                    </span>
                    <div>
                      <strong>{product?.name || 'Ürün'}</strong>
                      <small>
                        {meta.label} · {row.reference}
                      </small>
                    </div>
                  </div>
                </td>
                <td className="numeric">
                  <span
                    className={
                      row.type === 'sale'
                        ? 'text-orange'
                        : row.type === 'receipt'
                          ? 'text-green'
                          : ''
                    }
                  >
                    {row.type === 'sale' ? '−' : row.type === 'receipt' ? '+' : ''}
                    {number(row.quantity)}
                  </span>{' '}
                  <small>{product?.unit || 'adet'}</small>
                </td>
                <td>
                  <span className="shelf-code">
                    {source && target ? `${source} → ${target}` : source || target}
                  </span>
                </td>
                <td>{row.userName}</td>
                <td className="muted nowrap">{dateTime(row.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
