import { useState } from 'react';
import { Download, Search } from 'lucide-react';
import { useWarehouse } from '../context';
import { Button, Movements, PageHeader } from '../components/ui';
const csvCell = (value: string) =>
  `"${(/^[=+\-@]/.test(value) ? "'" : '') + value.replace(/"/g, '""')}"`;
export default function MovementsPage() {
  const { data } = useWarehouse();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  if (!data) return null;
  const rows = data.movements.filter(
    (m) =>
      (type === 'all' || m.type === type) &&
      `${m.reference} ${m.userName} ${data.products.find((p) => p.id === m.productId)?.name}`
        .toLocaleLowerCase('tr')
        .includes(search.toLocaleLowerCase('tr')),
  );
  const download = () => {
    const values = [
      ['Referans', 'Tip', 'Ürün', 'Miktar', 'Kaynak', 'Hedef', 'Kullanıcı', 'Tarih'],
      ...rows.map((m) => [
        m.reference,
        m.type,
        data.products.find((p) => p.id === m.productId)?.name || '',
        String(m.quantity),
        data.shelves.find((s) => s.id === m.fromShelfId)?.code || '',
        data.shelves.find((s) => s.id === m.toShelfId)?.code || '',
        m.userName,
        m.createdAt,
      ]),
    ];
    const blob = new Blob(['\uFEFF' + values.map((r) => r.map(csvCell).join(';')).join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'logistic-stok-hareketleri.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeader
        eyebrow="İŞLEM GÜNLÜĞÜ"
        title="Stok hareketleri"
        description="Her giriş, her yerleştirme ve her çıkış kayıt altında."
        actions={
          <Button variant="secondary" onClick={download}>
            <Download size={16} />
            CSV indir
          </Button>
        }
      />
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Stok hareketi ara"
              placeholder="Ürün, referans veya kullanıcı ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Hareket türü filtresi"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="all">Tüm işlemler</option>
            <option value="receipt">Mal kabul</option>
            <option value="putaway">Raf yerleştirme</option>
            <option value="sale">Satış</option>
          </select>
          <span className="result-count">{rows.length} hareket</span>
        </div>
        <Movements rows={rows} data={data} />
      </section>
    </>
  );
}
