import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Barcode, Box, Plus, Search, Warehouse } from 'lucide-react';
import { api } from '../api';
import { useAction, useAuth, useToast, useWarehouse } from '../context';
import type { Shelf } from '../types';
import {
  Badge,
  Button,
  Empty,
  ErrorBox,
  Field,
  Modal,
  number,
  PageHeader,
  ProductLabel,
} from '../components/ui';
export default function Inventory() {
  const { data, refresh } = useWarehouse();
  const { session } = useAuth();
  const toast = useToast();
  const action = useAction();
  const [tab, setTab] = useState('shelves');
  const [search, setSearch] = useState('');
  const [zone, setZone] = useState('all');
  const [selected, setSelected] = useState<Shelf | null>(null);
  const [create, setCreate] = useState(false);
  const [form, setForm] = useState({ code: '', zone: '', capacity: 600 });
  if (!data) return null;
  const shelves = data.shelves.filter((s) => !s.isReceiving);
  const stockFor = (id: string) => data.stock.filter((s) => s.shelfId === id && s.quantity > 0);
  const used = (id: string) => stockFor(id).reduce((s, row) => s + row.quantity, 0);
  const query = search.toLocaleLowerCase('tr');
  const matches = shelves.filter(
    (s) =>
      (zone === 'all' || s.zone === zone) &&
      (`${s.code} ${s.zone}`.toLocaleLowerCase('tr').includes(query) ||
        stockFor(s.id).some((r) =>
          data.products
            .find((p) => p.id === r.productId)
            ?.name.toLocaleLowerCase('tr')
            .includes(query),
        )),
  );
  const stockRows = data.stock.filter((s) => {
    const shelf = data.shelves.find((r) => r.id === s.shelfId);
    const product = data.products.find((p) => p.id === s.productId);
    return (
      s.quantity > 0 &&
      (zone === 'all' || shelf?.zone === zone) &&
      `${product?.name} ${product?.sku} ${shelf?.code}`.toLocaleLowerCase('tr').includes(query)
    );
  });
  const receiving = data.shelves.find((s) => s.isReceiving);
  return (
    <>
      <PageHeader
        eyebrow="DEPO PLANI"
        title="Stok & raflar"
        description="Ürünlerin nerede olduğunu gör, depo alanını kolayca yönet."
        actions={
          session?.user.role === 'admin' && (
            <Button
              onClick={() => {
                setCreate(true);
                action.clearError();
              }}
            >
              <Plus size={18} />
              Yeni raf
            </Button>
          )
        }
      />
      <div className="inventory-tabs">
        <div className="tabs">
          <button className={tab === 'shelves' ? 'active' : ''} onClick={() => setTab('shelves')}>
            <Warehouse size={16} />
            Raf görünümü
          </button>
          <button className={tab === 'stock' ? 'active' : ''} onClick={() => setTab('stock')}>
            <Box size={16} />
            Stok listesi
          </button>
        </div>
        <span className="muted">
          {shelves.length} raf · {number(data.dashboard.totalUnits)} adet stok
        </span>
      </div>
      {receiving && (
        <section className="receiving-strip">
          <span className="receiving-strip-icon">
            <Barcode size={25} />
          </span>
          <div>
            <strong>
              Mal kabul alanı{' '}
              <Badge tone="orange">{number(used(receiving.id))} adet bekliyor</Badge>
            </strong>
            <p>Gelen ürünler, RF terminalinden raflara yerleştirilmeyi bekliyor.</p>
          </div>
          <Link to="/rf" className="button secondary">
            Raflara yerleştir
            <ArrowRight size={16} />
          </Link>
        </section>
      )}
      <div className="table-toolbar inventory-filter">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Stok veya raf ara"
            placeholder="Raf kodu veya ürün ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select aria-label="Bölge filtresi" value={zone} onChange={(e) => setZone(e.target.value)}>
          <option value="all">Tüm bölgeler</option>
          {[...new Set(data.shelves.map((s) => s.zone))].map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>
      </div>
      {tab === 'shelves' ? (
        matches.length ? (
          <div className="shelf-grid">
            {matches.map((s) => {
              const qty = used(s.id);
              const ratio = Math.round((qty / s.capacity) * 100);
              return (
                <button className="shelf-card" key={s.id} onClick={() => setSelected(s)}>
                  <div className="shelf-card-top">
                    <span className="shelf-symbol">
                      <Warehouse size={20} />
                    </span>
                    <Badge tone={qty ? (ratio >= 80 ? 'orange' : 'green') : 'neutral'}>
                      {qty ? 'Kullanımda' : 'Boş raf'}
                    </Badge>
                  </div>
                  <h2>
                    {s.code}
                    <ArrowUpRightIcon />
                  </h2>
                  <p>{s.zone}</p>
                  <div className="shelf-visual" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div key={i} className={i < Math.ceil(ratio / 20) ? 'filled' : ''}>
                        <Box size={23} strokeWidth={1.5} />
                      </div>
                    ))}
                  </div>
                  <div className="shelf-details">
                    <strong>
                      {number(qty)}
                      <small> / {number(s.capacity)} adet</small>
                    </strong>
                    <span>%{ratio}</span>
                  </div>
                  <div className="progress">
                    <div
                      className={ratio >= 80 ? 'orange' : ''}
                      style={{ width: `${Math.min(ratio, 100)}%` }}
                    />
                  </div>
                  <small className="shelf-product-count">{stockFor(s.id).length} ürün çeşidi</small>
                </button>
              );
            })}
          </div>
        ) : (
          <Empty
            title="Raf bulunamadı"
            description="Filtreyi değiştir veya yeni bir raf oluştur."
          />
        )
      ) : (
        <section className="panel">
          {stockRows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th>Raf</th>
                    <th>Bölge</th>
                    <th>Miktar</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((s) => {
                    const shelf = data.shelves.find((r) => r.id === s.shelfId)!;
                    return (
                      <tr key={`${s.productId}:${s.shelfId}`}>
                        <td>
                          <ProductLabel product={data.products.find((p) => p.id === s.productId)} />
                        </td>
                        <td>
                          <span className="shelf-code">{shelf.code}</span>
                        </td>
                        <td className="muted">{shelf.zone}</td>
                        <td className="numeric">
                          <strong>{number(s.quantity)}</strong>
                        </td>
                        <td>
                          <Badge tone={shelf.isReceiving ? 'orange' : 'green'}>
                            {shelf.isReceiving ? 'Yerleştirme bekliyor' : 'Satışa hazır'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Stok bulunamadı"
              description="Mal kabul ile depona ürün ekleyebilirsin."
            />
          )}
        </section>
      )}
      {selected && (
        <Modal
          title={`${selected.code} rafı`}
          description={`${selected.zone} · ${number(used(selected.id))} / ${number(selected.capacity)} adet`}
          onClose={() => setSelected(null)}
        >
          {stockFor(selected.id).length ? (
            <div className="shelf-stock-list">
              {stockFor(selected.id).map((row) => (
                <div key={row.productId}>
                  <ProductLabel product={data.products.find((p) => p.id === row.productId)} />
                  <Badge>{number(row.quantity)} adet</Badge>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Bu raf boş" description="RF terminalinden bu rafa ürün taşıyabilirsin." />
          )}
          <div className="form-footer">
            <Link className="button primary" to={`/rf?target=${encodeURIComponent(selected.code)}`}>
              <Barcode size={17} />
              RF terminalinde aç
            </Link>
          </div>
        </Modal>
      )}
      {create && (
        <Modal
          title="Yeni raf oluştur"
          description="Raf kodunu RF terminalinde barkod gibi kullanabilirsin."
          onClose={() => {
            if (!action.busy) setCreate(false);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(
                form,
                () => api.createShelf(form),
                async () => {
                  setCreate(false);
                  setForm({ code: '', zone: '', capacity: 600 });
                  toast('Yeni raf oluşturuldu.');
                  await refresh();
                },
              );
            }}
          >
            <Field label="Raf kodu" htmlFor="shelf-code">
              <input
                id="shelf-code"
                placeholder="D-01"
                required
                maxLength={30}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Bölge" htmlFor="shelf-zone">
              <input
                id="shelf-zone"
                placeholder="D bölgesi"
                required
                maxLength={60}
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value })}
              />
            </Field>
            <Field label="Kapasite (adet)" htmlFor="capacity">
              <input
                id="capacity"
                type="number"
                required
                min="1"
                max="1000000"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
              />
            </Field>
            <ErrorBox message={action.error} />
            <div className="form-footer">
              <Button type="submit" busy={action.busy}>
                Rafı oluştur
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={18} className="muted" />;
}
