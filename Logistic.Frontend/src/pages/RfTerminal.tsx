import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Barcode,
  Check,
  ChevronRight,
  Package,
  Radio,
  ScanLine,
  Warehouse,
} from 'lucide-react';
import { api } from '../api';
import { connection } from '../config';
import { useAction, useToast, useWarehouse } from '../context';
import type { Movement, Product, Shelf } from '../types';
import {
  Badge,
  Button,
  ErrorBox,
  Field,
  number,
  PageHeader,
  ProductLabel,
  Success,
} from '../components/ui';

export default function RfTerminal() {
  const { data, refresh } = useWarehouse();
  const toast = useToast();
  const [params] = useSearchParams();
  const action = useAction();
  const scanner = useAction();
  const targetInput = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState(params.get('barcode') || '');
  const [product, setProduct] = useState<Product | null>(null);
  const [sourceId, setSourceId] = useState('');
  const [targetCode, setTargetCode] = useState(params.get('target') || '');
  const [target, setTarget] = useState<Shelf | null>(null);
  const [targetError, setTargetError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [last, setLast] = useState<Movement | null>(null);
  if (!data) return null;
  const sources = product
    ? data.stock.filter((s) => s.productId === product.id && s.quantity > 0)
    : [];
  const available = sources.find((s) => s.shelfId === sourceId)?.quantity || 0;
  const targetUsed = target
    ? data.stock.filter((s) => s.shelfId === target.id).reduce((sum, s) => sum + s.quantity, 0)
    : 0;
  const step = !product ? 1 : !target ? 2 : 3;
  const scanProduct = (code: string) => {
    setLast(null);
    setTarget(null);
    setTargetError('');
    setProduct(null);
    void scanner.run(
      code,
      async () => {
        const found = data.products.find((p) => p.isActive && p.barcode === code.trim());
        if (!found) throw new Error('Bu barkoda ait aktif ürün bulunamadı.');
        return found;
      },
      (p) => {
        setBarcode(p.barcode);
        setProduct(p);
        const rows = data.stock.filter((s) => s.productId === p.id && s.quantity > 0);
        setSourceId(
          rows.find((s) => data.shelves.find((r) => r.id === s.shelfId)?.isReceiving)?.shelfId ||
            rows[0]?.shelfId ||
            '',
        );
        setQuantity(1);
        targetInput.current?.focus();
      },
    );
  };
  const scanShelf = (code: string) => {
    const shelf = data.shelves.find((s) => s.code.toUpperCase() === code.trim().toUpperCase());
    if (!shelf || shelf.isReceiving) {
      setTarget(null);
      setTargetError('Depolama rafı bulunamadı. Örn. A-01 kodunu kullan.');
      return;
    }
    if (shelf.id === sourceId) {
      setTarget(null);
      setTargetError('Hedef raf, kaynak rafla aynı olamaz.');
      return;
    }
    setTargetCode(shelf.code);
    setTarget(shelf);
    setTargetError('');
    action.clearError();
  };
  const exampleProduct =
    data.products.find(
      (p) =>
        p.isActive &&
        data.stock.some(
          (s) =>
            s.productId === p.id &&
            s.quantity > 0 &&
            data.shelves.find((r) => r.id === s.shelfId)?.isReceiving,
        ),
    ) || data.products.find((p) => p.isActive);
  const exampleShelf = data.shelves.find(
    (s) =>
      !s.isReceiving &&
      s.id !== sourceId &&
      data.stock.filter((row) => row.shelfId === s.id).reduce((sum, row) => sum + row.quantity, 0) <
        s.capacity,
  );
  return (
    <>
      <PageHeader
        eyebrow="RF / BARKOD İŞLEMLERİ"
        title="RF terminali"
        description="Barkodu okut, rafı eşleştir, ürününü doğru yere yerleştir."
        actions={
          <Badge tone="green">
            <Radio size={13} />
            Klavye & simülasyon hazır
          </Badge>
        }
      />
      <div className="rf-layout">
        <section className="rf-device">
          <div className="rf-device-header">
            <span>
              <ScanLine size={19} />
              Logistic RF
            </span>
            <span className="rf-device-status">
              <i />
              Bağlı
            </span>
          </div>
          <div className="rf-device-body">
            <div className="rf-task-heading">
              <small>DEPO GÖREVİ</small>
              <h2>Rafa yerleştirme</h2>
              <p>Mal kabulden rafa, tek akışta.</p>
            </div>
            <div className="rf-stepper">
              {['Ürün', 'Raf', 'Onay'].map((name, i) => (
                <div
                  className={step > i + 1 ? 'complete' : step === i + 1 ? 'current' : ''}
                  key={name}
                >
                  <span>{step > i + 1 ? <Check size={14} /> : i + 1}</span>
                  <small>{name}</small>
                  {i < 2 && <i />}
                </div>
              ))}
            </div>
            <div className="rf-section">
              <div className="rf-section-title">
                <span>01</span>
                <h3>Ürün barkodunu okut</h3>
                {product && <Check size={17} className="text-green" />}
              </div>
              <div className="rf-scan-input">
                <Barcode size={25} />
                <input
                  aria-label="RF ürün barkodu"
                  placeholder="Ürün barkodu"
                  value={barcode}
                  disabled={action.busy || scanner.busy}
                  onChange={(e) => {
                    setBarcode(e.target.value);
                    setProduct(null);
                    setTarget(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      scanProduct(barcode);
                    }
                  }}
                />
                <button
                  aria-label="Ürün barkodunu okut"
                  disabled={!barcode || scanner.busy || action.busy}
                  onClick={() => scanProduct(barcode)}
                >
                  <ChevronRight size={21} />
                </button>
              </div>
              <button
                className="simulate-button"
                disabled={scanner.busy || action.busy || !exampleProduct}
                onClick={() => {
                  if (exampleProduct) scanProduct(exampleProduct.barcode);
                }}
              >
                <ScanLine size={15} />
                Örnek ürün barkodu okut
              </button>
              <ErrorBox message={scanner.error} />
              {product && (
                <div className="scanned-product">
                  <ProductLabel product={product} />
                  <Badge tone="green">Eşleşti</Badge>
                </div>
              )}
            </div>
            <div className={`rf-section ${!product ? 'section-disabled' : ''}`}>
              <div className="rf-section-title">
                <span>02</span>
                <h3>Kaynak & hedef raf</h3>
                {target && <Check size={17} className="text-green" />}
              </div>
              <Field label="Kaynak konum" htmlFor="rf-source">
                <select
                  id="rf-source"
                  disabled={!product || action.busy}
                  value={sourceId}
                  onChange={(e) => {
                    setSourceId(e.target.value);
                    setTarget(null);
                    setQuantity(1);
                  }}
                >
                  <option value="">Konum seç</option>
                  {sources.map((s) => (
                    <option key={s.shelfId} value={s.shelfId}>
                      {data.shelves.find((r) => r.id === s.shelfId)?.code} · {s.quantity} adet
                    </option>
                  ))}
                </select>
              </Field>
              {product && sources.length === 0 && (
                <ErrorBox message="Bu ürünün taşınabilir stoğu yok. Önce mal kabul yap." />
              )}
              <div className="rf-scan-input">
                <Warehouse size={23} />
                <input
                  ref={targetInput}
                  aria-label="RF hedef raf barkodu"
                  placeholder="Hedef raf kodu · A-01"
                  value={targetCode}
                  disabled={!product || action.busy}
                  onChange={(e) => {
                    setTargetCode(e.target.value.toUpperCase());
                    setTarget(null);
                    setTargetError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      scanShelf(targetCode);
                    }
                  }}
                />
                <button
                  aria-label="Hedef rafı okut"
                  disabled={!product || !targetCode || action.busy}
                  onClick={() => scanShelf(targetCode)}
                >
                  <ChevronRight size={21} />
                </button>
              </div>
              <button
                className="simulate-button"
                disabled={!product || !exampleShelf || action.busy}
                onClick={() => scanShelf(targetCode || exampleShelf?.code || '')}
              >
                <ScanLine size={15} />
                Örnek raf barkodu okut
              </button>
              <ErrorBox message={targetError} />
              {target && (
                <div className="rf-target-ok">
                  <Check size={16} />
                  <strong>{target.code}</strong>
                  <span>{number(target.capacity - targetUsed)} adet boş kapasite</span>
                </div>
              )}
            </div>
            <form
              className={`rf-section rf-confirm ${!target ? 'section-disabled' : ''}`}
              onSubmit={(e) => {
                e.preventDefault();
                if (!product || !target) return;
                const payload = {
                  productBarcode: product.barcode,
                  sourceShelfId: sourceId,
                  targetShelfCode: target.code,
                  quantity,
                };
                void action.run(
                  payload,
                  (key) => api.putaway(payload, key),
                  async (movement) => {
                    setLast(movement);
                    setProduct(null);
                    setTarget(null);
                    setBarcode('');
                    setTargetCode('');
                    setSourceId('');
                    setQuantity(1);
                    toast(`${movement.reference}: ürünler rafa yerleştirildi.`);
                    await refresh();
                  },
                );
              }}
            >
              <div className="rf-section-title">
                <span>03</span>
                <h3>Miktarı onayla</h3>
              </div>
              <div className="rf-quantity">
                <Field label="Taşınacak miktar" htmlFor="rf-quantity">
                  <input
                    id="rf-quantity"
                    type="number"
                    min="1"
                    max={Math.min(available, target ? target.capacity - targetUsed : available)}
                    required
                    disabled={!target || action.busy}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </Field>
                <div>
                  <strong>{number(available)}</strong>
                  <small>kaynakta mevcut</small>
                </div>
              </div>
              <ErrorBox message={action.error} />
              <Button
                type="submit"
                className="full-width"
                disabled={!product || !target || !sourceId || available === 0}
                busy={action.busy}
              >
                <Check size={18} />
                Rafa yerleştir
              </Button>
            </form>
          </div>
          <div className="rf-device-footer">
            <span />
            SIMÜLASYON TERMİNALİ <span />
          </div>
        </section>
        <aside className="rf-guide">
          <div className="rf-guide-intro">
            <span className="section-icon large">
              <Barcode size={27} />
            </span>
            <h2>
              Okuyucun yok mu?
              <br />
              Sorun değil.
            </h2>
            <p>
              Örnek okutma düğmeleri, barkod okuyucunun klavyeden yazıp Enter'a basmasıyla aynı
              akışı çalıştırır.
            </p>
          </div>
          <div className="panel aside-card">
            <h3>Görüşmede deneyebileceğin akış</h3>
            <ol className="flow-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>Mal kabul yap</strong>
                  <p>Bir ürün için 10 adet stok girişi kaydet.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Ürün ve raf okut</strong>
                  <p>Örnek ürün barkodunu, ardından raf kodunu okut.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>10 adet yerleştir</strong>
                  <p>KABUL alanından hedef rafa stok taşınır.</p>
                </div>
              </li>
              {connection.mode === 'demo' && (
                <li>
                  <span>4</span>
                  <div>
                    <strong>Satışla stok düş</strong>
                    <p>Satış ekranında aynı raftan 2 adet sat.</p>
                  </div>
                </li>
              )}
            </ol>
            <Link to="/inventory" className="text-link">
              Rafları kontrol et
              <ArrowRight size={16} />
            </Link>
          </div>
          {last && (
            <Success title="Yerleştirme tamamlandı">
              {last.reference} · {number(last.quantity)} adet ürün{' '}
              {data.shelves.find((s) => s.id === last.toShelfId)?.code} rafına taşındı.
            </Success>
          )}
          <div className="rf-example-code">
            <Package size={17} />
            <div>
              <small>ÖRNEK ÜRÜN BARKODU</small>
              <code>{exampleProduct?.barcode || 'Ürün oluştur'}</code>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
