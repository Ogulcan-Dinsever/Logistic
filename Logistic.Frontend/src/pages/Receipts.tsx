import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowRight, Barcode, PackageCheck, ScanLine } from 'lucide-react';
import { api } from '../api';
import { useAction, useToast, useWarehouse } from '../context';
import type { Receipt } from '../types';
import {
  Badge,
  Button,
  dateTime,
  Empty,
  ErrorBox,
  Field,
  number,
  PageHeader,
  ProductLabel,
  Success,
} from '../components/ui';
export default function Receipts() {
  const { data, refresh } = useWarehouse();
  const toast = useToast();
  const action = useAction();
  const scanner = useAction();
  const [form, setForm] = useState({
    supplier: '',
    productId: '',
    quantity: 1,
    note: '',
  });
  const [barcode, setBarcode] = useState('');
  const [saved, setSaved] = useState<Receipt | null>(null);
  if (!data) return null;
  const product = data.products.find((p) => p.id === form.productId);
  const scan = (code: string) =>
    void scanner.run(
      code,
      async () => {
        const found = data.products.find((p) => p.isActive && p.barcode === code.trim());
        if (!found) throw new Error('Bu barkoda ait aktif ürün bulunamadı.');
        return found;
      },
      (p) => {
        setForm((f) => ({ ...f, productId: p.id }));
        setBarcode(p.barcode);
      },
    );
  return (
    <>
      <PageHeader
        eyebrow="GELEN ÜRÜNLER"
        title="Mal kabul"
        description="Gelen ürünleri kaydet, stoklarına güvenli bir başlangıç yap."
      />
      <div className="operation-grid">
        <section className="panel form-panel">
          <div className="panel-heading">
            <div className="title-with-icon">
              <span className="section-icon">
                <ArrowDownToLine size={20} />
              </span>
              <div>
                <h2>Yeni mal kabul</h2>
                <p>Ürünler önce mal kabul alanına alınır.</p>
              </div>
            </div>
            <Badge tone="neutral">KABUL</Badge>
          </div>
          <div className="panel-body">
            <div className="scan-inline">
              <Field
                label="Ürün barkodu"
                htmlFor="receipt-barcode"
                hint="Barkodu yazıp Enter'a basabilir veya örnek okutabilirsin."
              >
                <div className="input-with-icon">
                  <Barcode size={19} />
                  <input
                    id="receipt-barcode"
                    value={barcode}
                    placeholder="8690000001001"
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        scan(barcode);
                      }
                    }}
                  />
                </div>
              </Field>
              <Button
                variant="secondary"
                busy={scanner.busy}
                onClick={() => scan(barcode || data.products[0]?.barcode || '')}
              >
                <ScanLine size={17} />
                {barcode ? 'Barkodu okut' : 'Örnek okut'}
              </Button>
            </div>
            <ErrorBox message={scanner.error} />
            <div className="or-divider">veya listeden seç</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(
                  form,
                  (key) => api.createReceipt(form, key),
                  async (receipt) => {
                    setSaved(receipt);
                    setForm((f) => ({ ...f, quantity: 1, note: '' }));
                    toast(`${receipt.reference} mal kabul kaydedildi.`);
                    await refresh();
                  },
                );
              }}
            >
              <Field label="Ürün" htmlFor="receipt-product">
                <select
                  id="receipt-product"
                  required
                  value={form.productId}
                  onChange={(e) => {
                    setForm({ ...form, productId: e.target.value });
                    setBarcode(data.products.find((p) => p.id === e.target.value)?.barcode || '');
                    setSaved(null);
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
              <div className="form-grid">
                <Field label="Tedarikçi" htmlFor="supplier">
                  <input
                    id="supplier"
                    required
                    placeholder="Örn. Marmara Tedarik"
                    maxLength={200}
                    value={form.supplier}
                    onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  />
                </Field>
                <Field label={`Miktar (${product?.unit || 'adet'})`} htmlFor="receipt-quantity">
                  <input
                    id="receipt-quantity"
                    type="number"
                    min="1"
                    max="1000000"
                    required
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <Field label="Not (isteğe bağlı)" htmlFor="receipt-note">
                <textarea
                  id="receipt-note"
                  maxLength={500}
                  rows={3}
                  placeholder="Teslimatla ilgili bir not ekle…"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </Field>
              <ErrorBox message={action.error} />
              <div className="form-footer">
                <span className="muted">
                  <PackageCheck size={15} />
                  KABUL alanına eklenecek
                </span>
                <Button type="submit" busy={action.busy}>
                  <ArrowDownToLine size={16} />
                  Mal kabulü kaydet
                </Button>
              </div>
            </form>
            {saved && (
              <Success title={`${saved.reference} kaydedildi`}>
                {number(saved.quantity)} adet stoklara eklendi.{' '}
                <Link
                  to={`/rf?barcode=${encodeURIComponent(data.products.find((p) => p.id === saved.productId)?.barcode || '')}`}
                  className="text-link"
                >
                  Şimdi rafa yerleştir <ArrowRight size={14} />
                </Link>
              </Success>
            )}
          </div>
        </section>
        <aside className="operation-aside">
          <div className="panel aside-card">
            <span className="aside-kicker">NASIL ÇALIŞIR?</span>
            <h2>
              Ürün girişinden
              <br />
              rafa, üç adım.
            </h2>
            <ol className="flow-steps">
              <li>
                <span>01</span>
                <div>
                  <strong>Ürünü tanımla</strong>
                  <p>Barkodu okut veya ürün listesinden seç.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Mal kabulü kaydet</strong>
                  <p>Miktarı ve tedarikçiyi gir. Stok KABUL alanına eklenir.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Rafa yerleştir</strong>
                  <p>RF terminalinde ürün ve raf barkodunu eşleştir.</p>
                </div>
              </li>
            </ol>
            <Link to="/rf" className="text-link">
              RF terminaline git
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="note-card">
            <PackageCheck size={22} />
            <strong>Önce kabul, sonra satış.</strong>
            <p>KABUL alanındaki ürünler satışa çıkmaz. Önce bir depolama rafına yerleştir.</p>
          </div>
        </aside>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Mal kabul kayıtları</h2>
            <p>{data.receipts.length} teslimat kaydı</p>
          </div>
        </div>
        {data.receipts.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Referans</th>
                  <th>Ürün</th>
                  <th>Tedarikçi</th>
                  <th>Miktar</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {data.receipts.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="reference">{r.reference}</span>
                    </td>
                    <td>
                      <ProductLabel product={data.products.find((p) => p.id === r.productId)} />
                    </td>
                    <td>{r.supplier}</td>
                    <td className="numeric text-green">+{number(r.quantity)}</td>
                    <td className="muted nowrap">{dateTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="İlk teslimatını kaydet"
            description="Mal kabul kayıtların burada listelenecek."
          />
        )}
      </section>
    </>
  );
}
