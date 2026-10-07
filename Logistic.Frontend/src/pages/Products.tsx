import { useState } from 'react';
import { Pencil, Plus, Search } from 'lucide-react';
import { api } from '../api';
import { connection } from '../config';
import { useAction, useAuth, useToast, useWarehouse } from '../context';
import type { Product, ProductInput } from '../types';
import {
  Badge,
  Button,
  Empty,
  ErrorBox,
  Field,
  Modal,
  money,
  number,
  PageHeader,
  ProductLabel,
} from '../components/ui';
const blank: ProductInput = {
  name: '',
  sku: '',
  barcode: '',
  category: 'Elektronik',
  unit: 'adet',
  salePrice: 0,
  minStock: 10,
};
export default function Products() {
  const { data, refresh } = useWarehouse();
  const { session } = useAuth();
  const toast = useToast();
  const action = useAction();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [editor, setEditor] = useState<Product | 'new' | null>(null);
  const [form, setForm] = useState<ProductInput>(blank);
  if (!data) return null;
  const isAdmin = session?.user.role === 'admin';
  const canEdit = isAdmin && connection.mode === 'demo';
  const rows = data.products.filter(
    (p) =>
      `${p.name} ${p.sku} ${p.barcode}`
        .toLocaleLowerCase('tr')
        .includes(search.toLocaleLowerCase('tr')) &&
      (category === 'all' || p.category === category),
  );
  const open = (product: Product | 'new') => {
    setEditor(product);
    setForm(product === 'new' ? { ...blank } : { ...product });
    action.clearError();
  };
  const update = (key: keyof ProductInput, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));
  return (
    <>
      <PageHeader
        eyebrow="ÜRÜN KATALOĞU"
        title="Ürünler"
        description="Ürün bilgileri, barkodlar ve stok seviyeleri tek bir yerde."
        actions={
          isAdmin && (
            <Button onClick={() => open('new')}>
              <Plus size={18} />
              Yeni ürün
            </Button>
          )
        }
      />
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Ürün ara"
              placeholder="Ürün adı, SKU veya barkod ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Kategori filtresi"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">Tüm kategoriler</option>
            {[...new Set(data.products.map((p) => p.category))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <span className="result-count">{rows.length} ürün</span>
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Barkod</th>
                  <th>Kategori</th>
                  <th>Toplam stok</th>
                  <th>Satış fiyatı</th>
                  <th>Durum</th>
                  {canEdit && <th />}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const total = data.stock
                    .filter((s) => s.productId === p.id)
                    .reduce((sum, s) => sum + s.quantity, 0);
                  return (
                    <tr key={p.id}>
                      <td>
                        <ProductLabel product={p} />
                      </td>
                      <td>
                        <code className="barcode-text">{p.barcode}</code>
                      </td>
                      <td className="muted">{p.category}</td>
                      <td>
                        <strong>{number(total)}</strong> <small>{p.unit}</small>
                        <small className="cell-detail">Min. {p.minStock}</small>
                      </td>
                      <td className="numeric">{money(p.salePrice)}</td>
                      <td>
                        <Badge tone={total < p.minStock ? 'orange' : 'green'}>
                          {total < p.minStock ? 'Kritik stok' : 'Stokta'}
                        </Badge>
                      </td>
                      {canEdit && (
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`${p.name} düzenle`}
                            onClick={() => open(p)}
                          >
                            <Pencil size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Ürün bulunamadı"
            description="Arama veya kategori filtresini değiştirebilirsin."
          />
        )}
      </section>
      {editor && (
        <Modal
          title={editor === 'new' ? 'Yeni ürün oluştur' : 'Ürünü düzenle'}
          description="Her ürünün SKU ve barkodu benzersiz olmalı."
          onClose={() => {
            if (!action.busy) setEditor(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(
                form,
                () =>
                  editor === 'new' ? api.createProduct(form) : api.updateProduct(editor.id, form),
                async () => {
                  setEditor(null);
                  toast('Ürün bilgileri kaydedildi.');
                  await refresh();
                },
              );
            }}
          >
            <Field label="Ürün adı" htmlFor="product-name">
              <input
                id="product-name"
                required
                maxLength={200}
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
              />
            </Field>
            <div className="form-grid">
              <Field label="SKU" htmlFor="sku">
                <input
                  id="sku"
                  required
                  maxLength={40}
                  value={form.sku}
                  onChange={(e) => update('sku', e.target.value)}
                  placeholder="ELK-004"
                />
              </Field>
              <Field label="Barkod" htmlFor="barcode">
                <input
                  id="barcode"
                  required
                  maxLength={60}
                  value={form.barcode}
                  onChange={(e) => update('barcode', e.target.value)}
                  placeholder="8690000001009"
                />
              </Field>
              <Field label="Kategori" htmlFor="category">
                <input
                  id="category"
                  required
                  maxLength={60}
                  list="categories"
                  value={form.category}
                  onChange={(e) => update('category', e.target.value)}
                />
                <datalist id="categories">
                  {['Elektronik', 'Ambalaj', 'Tekstil', 'Ev & yaşam', 'Ofis'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </datalist>
              </Field>
              <Field label="Birim" htmlFor="unit">
                <select
                  id="unit"
                  value={form.unit}
                  onChange={(e) => update('unit', e.target.value)}
                >
                  <option>adet</option>
                  <option>kutu</option>
                  <option>paket</option>
                </select>
              </Field>
              <Field label="Satış fiyatı (₺)" htmlFor="price">
                <input
                  id="price"
                  type="number"
                  min="0"
                  max="10000000"
                  step="0.01"
                  required
                  value={form.salePrice}
                  onChange={(e) => update('salePrice', Number(e.target.value))}
                />
              </Field>
              <Field label="Minimum stok" htmlFor="min-stock">
                <input
                  id="min-stock"
                  type="number"
                  min="0"
                  max="1000000"
                  step="1"
                  required
                  value={form.minStock}
                  onChange={(e) => update('minStock', Number(e.target.value))}
                />
              </Field>
            </div>
            <ErrorBox message={action.error} />
            <div className="form-footer">
              <Button
                type="button"
                variant="secondary"
                disabled={action.busy}
                onClick={() => setEditor(null)}
              >
                Vazgeç
              </Button>
              <Button type="submit" busy={action.busy}>
                Ürünü kaydet
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
