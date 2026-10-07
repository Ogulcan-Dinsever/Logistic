import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Barcode,
  Boxes,
  CircleDollarSign,
  Package,
  RefreshCw,
  Warehouse,
} from 'lucide-react';
import { useAuth, useWarehouse } from '../context';
import {
  Badge,
  Button,
  money,
  Movements,
  number,
  PageHeader,
  ProductLabel,
} from '../components/ui';

export default function Dashboard() {
  const { session } = useAuth();
  const { data, refresh, loading } = useWarehouse();
  if (!data) return null;
  const d = data.dashboard;
  const low = data.products.filter(
    (p) =>
      p.isActive &&
      data.stock.filter((s) => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0) <
        p.minStock,
  );
  const receiving = data.stock
    .filter((s) => data.shelves.find((r) => r.id === s.shelfId)?.isReceiving)
    .reduce((sum, s) => sum + s.quantity, 0);
  const max = Math.max(...d.dailyActivity.flatMap((a) => [a.received, a.sold]), 1);
  const occupied = data.shelves
    .filter((s) => !s.isReceiving)
    .map((s) => ({
      ...s,
      used: data.stock.filter((x) => x.shelfId === s.id).reduce((sum, x) => sum + x.quantity, 0),
    }));
  const capacity = occupied.reduce((s, r) => s + r.capacity, 0);
  const used = occupied.reduce((s, r) => s + r.used, 0);
  const ratio = capacity ? Math.round((used / capacity) * 100) : 0;
  return (
    <>
      <PageHeader
        eyebrow="HER ŞEY YOLUNDA"
        title="Genel bakış"
        description={`Merhaba ${session?.user.fullName.split(' ')[0]}, deponun bugünkü özeti burada.`}
        actions={
          <>
            <Button
              variant="secondary"
              aria-label="Verileri yenile"
              busy={loading}
              onClick={() => void refresh()}
            >
              <RefreshCw size={17} />
            </Button>
            <Link to="/receipts" className="button primary">
              <ArrowDownToLine size={17} />
              Yeni mal kabul
            </Link>
          </>
        }
      />
      <section className="welcome-banner">
        <div>
          <span className="banner-kicker">
            <span className="status-dot" /> OPERASYON MERKEZİ
          </span>
          <h2>Küçük adımlar. Düzenli bir depo.</h2>
          <p>
            {receiving > 0
              ? `${number(receiving)} adet ürün raf yerleştirmesi bekliyor. RF terminalinden devam edebilirsin.`
              : 'Mal kabul alanı boş. Yeni ürün girişleri için depon hazır.'}
          </p>
        </div>
        <Link to="/rf" className="banner-button">
          <Barcode size={19} />
          RF terminalini aç
          <ArrowUpRight size={17} />
        </Link>
        <div className="banner-cube" aria-hidden="true">
          <Boxes size={96} strokeWidth={0.7} />
        </div>
      </section>
      <section className="stats-grid" aria-label="Depo özeti">
        {[
          {
            title: 'Toplam stok',
            value: number(d.totalUnits),
            unit: 'adet',
            icon: Boxes,
            bottom: `${d.activeProducts} aktif ürün çeşidi`,
            tone: 'mint',
          },
          {
            title: 'Dolu raflar',
            value: `${d.occupiedShelves}`,
            unit: `/ ${d.totalShelves} raf`,
            icon: Warehouse,
            bottom: `%${ratio} toplam kapasite kullanımı`,
            tone: 'sand',
          },
          {
            title: 'Bugünkü satış',
            value: money(d.todayRevenue),
            unit: '',
            icon: CircleDollarSign,
            bottom: `${d.todaySales} satış işlemi tamamlandı`,
            tone: 'lavender',
          },
          {
            title: 'Kritik stok',
            value: `${d.lowStockCount}`,
            unit: 'ürün',
            icon: Package,
            bottom: low.length
              ? 'Minimum stok seviyesinin altında'
              : 'Tüm ürünler yeterli seviyede',
            tone: 'peach',
          },
        ].map((stat) => (
          <article className="stat-card" key={stat.title}>
            <div className="stat-top">
              <span>{stat.title}</span>
              <span className={`stat-icon ${stat.tone}`}>
                <stat.icon size={19} strokeWidth={1.7} />
              </span>
            </div>
            <div className="stat-value">
              {stat.value}
              <small>{stat.unit}</small>
            </div>
            <div className="stat-bottom">
              <span
                className={`tiny-dot ${stat.title === 'Kritik stok' && low.length ? 'orange' : ''}`}
              />
              {stat.bottom}
            </div>
          </article>
        ))}
      </section>
      <div className="dashboard-middle">
        <section className="panel activity-chart">
          <div className="panel-heading">
            <div>
              <h2>Depo hareketliliği</h2>
              <p>Son 7 günde giren ve satılan ürün miktarı</p>
            </div>
            <Badge tone="neutral">Son 7 gün</Badge>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-green" />
              Mal kabul
            </span>
            <span>
              <i className="legend-light" />
              Satış
            </span>
            <small>adet</small>
          </div>
          <div className="bar-chart">
            <div className="chart-y">
              <span>{number(max)}</span>
              <span>{number(Math.round(max / 2))}</span>
              <span>0</span>
            </div>
            <div className="chart-grid">
              <div className="chart-gridlines">
                <i />
                <i />
                <i />
              </div>
              {d.dailyActivity.map((a) => (
                <div className="chart-day" key={a.date}>
                  <div className="bars">
                    <div
                      className="bar incoming"
                      style={{ height: `${(a.received / max) * 100}%` }}
                      title={`${a.date}: ${a.received} adet mal kabul`}
                    >
                      <span>{a.received}</span>
                    </div>
                    <div
                      className="bar outgoing"
                      style={{ height: `${(a.sold / max) * 100}%` }}
                      title={`${a.date}: ${a.sold} adet satış`}
                    >
                      <span>{a.sold}</span>
                    </div>
                  </div>
                  <small>
                    {new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(
                      new Date(`${a.date}T12:00:00`),
                    )}
                  </small>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="panel capacity-panel">
          <div className="panel-heading">
            <div>
              <h2>Raf kapasitesi</h2>
              <p>Depolama alanı kullanımı</p>
            </div>
            <Warehouse size={18} className="muted" />
          </div>
          <div className="capacity-ring">
            <svg
              viewBox="0 0 160 160"
              role="img"
              aria-label={`Raf kapasitesinin yüzde ${ratio} kadarı dolu`}
            >
              <circle cx="80" cy="80" r="65" fill="none" stroke="#eef1e9" strokeWidth="14" />
              <circle
                cx="80"
                cy="80"
                r="65"
                fill="none"
                stroke="#386d50"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${ratio * 4.084} 408.4`}
                transform="rotate(-90 80 80)"
              />
            </svg>
            <div>
              <strong>%{ratio}</strong>
              <small>doluluk oranı</small>
            </div>
          </div>
          <div className="capacity-bottom">
            <span>
              <i className="legend-green" />
              Dolu <strong>{number(used)}</strong>
            </span>
            <span>
              <i className="legend-light" />
              Boş <strong>{number(Math.max(0, capacity - used))}</strong>
            </span>
          </div>
        </section>
      </div>
      {low.length > 0 && (
        <section className="low-stock-strip">
          <div className="low-stock-title">
            <span className="warning-dot">!</span>
            <div>
              <strong>Stok takibi gerekiyor</strong>
              <small>{low.length} ürün minimum seviyenin altında</small>
            </div>
          </div>
          <div className="low-stock-products">
            {low.slice(0, 2).map((p) => (
              <div key={p.id}>
                <ProductLabel product={p} compact />
                <Badge tone="orange">
                  {number(
                    data.stock
                      .filter((s) => s.productId === p.id)
                      .reduce((sum, s) => sum + s.quantity, 0),
                  )}{' '}
                  / {p.minStock}
                </Badge>
              </div>
            ))}
          </div>
          <Link to="/products" className="text-link">
            Ürünleri gör <ArrowRight size={16} />
          </Link>
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Son stok hareketleri</h2>
            <p>Depoda gerçekleşen son işlemler</p>
          </div>
          <Link className="text-link" to="/movements">
            Tüm hareketler
            <ArrowRight size={15} />
          </Link>
        </div>
        <Movements rows={data.movements.slice(0, 5)} data={data} />
      </section>
    </>
  );
}
