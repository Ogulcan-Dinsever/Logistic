import { useState } from 'react';
import { Check, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAction, useToast, useWarehouse } from '../context';
import type { Sale, SaleLine } from '../types';
import {
  Badge,
  Button,
  dateTime,
  Empty,
  ErrorBox,
  Field,
  Modal,
  money,
  number,
  PageHeader,
  ProductLabel,
  Success,
} from '../components/ui';
type CartLine = SaleLine & { key: string };
export default function Sales() {
  const { data, refresh } = useWarehouse();
  const toast = useToast();
  const action = useAction();
  const [customer, setCustomer] = useState('');
  const [productId, setProductId] = useState('');
  const [shelfId, setShelfId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartError, setCartError] = useState('');
  const [saved, setSaved] = useState<Sale | null>(null);
  const [detail, setDetail] = useState<Sale | null>(null);
  if (!data) return null;
  const reserved = (pid: string, sid: string) =>
    cart
      .filter((l) => l.productId === pid && l.shelfId === sid)
      .reduce((sum, l) => sum + l.quantity, 0);
  const sellable = data.stock.filter(
    (s) =>
      s.productId === productId &&
      s.quantity > reserved(productId, s.shelfId) &&
      !data.shelves.find((r) => r.id === s.shelfId)?.isReceiving,
  );
  const available =
    (data.stock.find((s) => s.productId === productId && s.shelfId === shelfId)?.quantity || 0) -
    reserved(productId, shelfId);
  const total = Math.round(cart.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0) * 100) / 100;
  return (
    <>
      <PageHeader
        eyebrow="SİPARİŞ & STOK ÇIKIŞI"
        title="Satışlar"
        description="Satış oluştur, ürünleri seçtiğin raftan otomatik düş."
      />
      <div className="sales-layout">
        <section className="panel form-panel">
          <div className="panel-heading">
            <div className="title-with-icon">
              <span className="section-icon">
                <ShoppingBag size={20} />
              </span>
              <div>
                <h2>Yeni satış</h2>
                <p>Bir satışa birden fazla ürün ekleyebilirsin.</p>
              </div>
            </div>
            <Badge tone="neutral">Taslak</Badge>
          </div>
          <div className="panel-body">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  !productId ||
                  !shelfId ||
                  !Number.isSafeInteger(quantity) ||
                  quantity < 1 ||
                  quantity > available
                ) {
                  setCartError('Ürün, raf ve miktarı kontrol et. Yeterli raf stoğu olmalı.');
                  return;
                }
                setCart((c) => [
                  ...c,
                  { key: crypto.randomUUID(), productId, shelfId, quantity, unitPrice },
                ]);
                setQuantity(1);
                setShelfId('');
                setCartError('');
                setSaved(null);
              }}
            >
              <Field label="Ürün" htmlFor="sale-product">
                <select
                  id="sale-product"
                  required
                  disabled={action.busy}
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    setShelfId('');
                    setQuantity(1);
                    setUnitPrice(
                      data.products.find((p) => p.id === e.target.value)?.salePrice || 0,
                    );
                  }}
                >
                  <option value="">Ürün seç</option>
                  {data.products
                    .filter((p) => p.isActive)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.sku}
                      </option>
                    ))}
                </select>
              </Field>
              <Field
                label="Stok düşülecek raf"
                htmlFor="sale-shelf"
                hint="Yalnızca depolama rafları listelenir. KABUL alanından satış yapılmaz."
              >
                <select
                  id="sale-shelf"
                  required
                  disabled={!productId || action.busy}
                  value={shelfId}
                  onChange={(e) => {
                    setShelfId(e.target.value);
                    setQuantity(1);
                  }}
                >
                  <option value="">
                    {productId && !sellable.length ? 'Satışa hazır raf stoğu yok' : 'Raf seç'}
                  </option>
                  {sellable.map((s) => (
                    <option key={s.shelfId} value={s.shelfId}>
                      {data.shelves.find((r) => r.id === s.shelfId)?.code} ·{' '}
                      {number(s.quantity - reserved(productId, s.shelfId))} adet kullanılabilir
                    </option>
                  ))}
                </select>
              </Field>
              <div className="form-grid">
                <Field label="Miktar" htmlFor="sale-quantity">
                  <input
                    id="sale-quantity"
                    type="number"
                    required
                    min="1"
                    max={Math.max(1, available)}
                    disabled={action.busy}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </Field>
                <Field label="Birim fiyat (₺)" htmlFor="sale-price">
                  <input
                    id="sale-price"
                    type="number"
                    required
                    min="0"
                    max="10000000"
                    step="0.01"
                    disabled={action.busy}
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                  />
                </Field>
              </div>
              <ErrorBox message={cartError} />
              <div className="form-footer">
                <small>
                  {shelfId
                    ? `${number(available)} adet raf stoğu kullanılabilir`
                    : 'Ürün ve raf seçerek devam et'}
                </small>
                <Button type="submit" variant="secondary" disabled={!shelfId || action.busy}>
                  <Plus size={16} />
                  Satışa ekle
                </Button>
              </div>
            </form>
          </div>
          <div className="cart-section">
            <div className="cart-heading">
              <h3>Satış kalemleri</h3>
              <Badge tone="neutral">{cart.length} kalem</Badge>
            </div>
            {cart.length ? (
              <div className="cart-lines">
                {cart.map((line) => (
                  <div className="cart-line" key={line.key}>
                    <ProductLabel product={data.products.find((p) => p.id === line.productId)} />
                    <div className="cart-line-info">
                      <small>
                        {data.shelves.find((s) => s.id === line.shelfId)?.code} ·{' '}
                        {number(line.quantity)} × {money(line.unitPrice)}
                      </small>
                      <strong>{money(line.quantity * line.unitPrice)}</strong>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Satış kalemini kaldır"
                      disabled={action.busy}
                      onClick={() => setCart((c) => c.filter((l) => l.key !== line.key))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="Satışa ürün ekle"
                description="Ürün ve rafı seçerek ilk kalemini oluştur."
              />
            )}
          </div>
        </section>
        <aside className="sales-summary panel">
          <div className="panel-heading">
            <h2>Satış özeti</h2>
          </div>
          <div className="panel-body">
            <form
              id="sale-submit"
              onSubmit={(e) => {
                e.preventDefault();
                const payload = { customer, lines: cart.map(({ key: _key, ...line }) => line) };
                void action.run(
                  payload,
                  (key) => api.createSale(payload, key),
                  async (sale) => {
                    setSaved(sale);
                    setCart([]);
                    setCustomer('');
                    setShelfId('');
                    toast(`${sale.reference} satış tamamlandı.`);
                    await refresh();
                  },
                );
              }}
            >
              <Field label="Müşteri / firma" htmlFor="customer">
                <input
                  id="customer"
                  placeholder="Örn. Atlas Mağazacılık"
                  required
                  maxLength={200}
                  disabled={action.busy}
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                />
              </Field>
              <div className="summary-row">
                <span>Kalem sayısı</span>
                <strong>{cart.length}</strong>
              </div>
              <div className="summary-row">
                <span>Toplam ürün</span>
                <strong>{number(cart.reduce((sum, l) => sum + l.quantity, 0))} adet</strong>
              </div>
              <div className="summary-total">
                <span>
                  Toplam tutar<small>KDV hariç</small>
                </span>
                <strong>{money(total)}</strong>
              </div>
              <ErrorBox message={action.error} />
              <Button
                type="submit"
                className="full-width"
                disabled={!cart.length}
                busy={action.busy}
              >
                <Check size={18} />
                Satışı tamamla
              </Button>
              <p className="summary-note">
                Onayla birlikte stok, her kalemde seçtiğin raftan düşülür.
              </p>
            </form>
            {saved && (
              <Success title={`${saved.reference} tamamlandı`}>
                {money(saved.total)} tutarında satış kaydedildi. Raf stokları güncellendi.
              </Success>
            )}
          </div>
        </aside>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Satış geçmişi</h2>
            <p>{data.sales.length} tamamlanan satış</p>
          </div>
        </div>
        {data.sales.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Referans</th>
                  <th>Müşteri</th>
                  <th>Ürün adedi</th>
                  <th>Tutar</th>
                  <th>Tarih</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.sales.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="reference">{s.reference}</span>
                    </td>
                    <td>{s.customer}</td>
                    <td className="numeric">
                      {number(s.lines.reduce((sum, l) => sum + l.quantity, 0))}
                    </td>
                    <td className="numeric">
                      <strong>{money(s.total)}</strong>
                    </td>
                    <td className="muted nowrap">{dateTime(s.createdAt)}</td>
                    <td>
                      <button className="text-link" onClick={() => setDetail(s)}>
                        Detay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Henüz satış yok" description="Tamamladığın satışlar burada listelenecek." />
        )}
      </section>
      {detail && (
        <Modal
          title={detail.reference}
          description={`${detail.customer} · ${dateTime(detail.createdAt)}`}
          onClose={() => setDetail(null)}
        >
          <div className="sale-detail-lines">
            {detail.lines.map((line, i) => (
              <div key={i}>
                <ProductLabel product={data.products.find((p) => p.id === line.productId)} />
                <span>
                  {data.shelves.find((s) => s.id === line.shelfId)?.code} · {line.quantity} adet
                </span>
                <strong>{money(line.quantity * line.unitPrice)}</strong>
              </div>
            ))}
          </div>
          <div className="summary-total">
            <span>Toplam</span>
            <strong>{money(detail.total)}</strong>
          </div>
          <small className="muted">İşlemi yapan: {detail.userName}</small>
        </Modal>
      )}
    </>
  );
}
