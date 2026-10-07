import { useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Barcode,
  Box,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings2,
  ShoppingBag,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import { useAuth, useWarehouse } from '../context';
import { connection } from '../config';
import { Badge, Button, ErrorBox, Loading } from './ui';
const links = [
  { to: '/', label: 'Genel bakış', icon: LayoutDashboard },
  { to: '/inventory', label: 'Stok & raflar', icon: Warehouse },
  { to: '/products', label: 'Ürünler', icon: Package },
  { to: '/receipts', label: 'Mal kabul', icon: ArrowDownToLine },
  { to: '/rf', label: 'RF terminali', icon: Barcode },
  { to: '/sales', label: 'Satışlar', icon: ShoppingBag },
  { to: '/movements', label: 'Stok hareketleri', icon: Activity },
];
const livePaths = ['/inventory', '/products', '/receipts', '/rf'];
export default function Layout() {
  const { session, logout } = useAuth();
  const { data, loading, error, refresh } = useWarehouse();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const selected = [
    ...links,
    { to: '/users', label: 'Kullanıcılar' },
    { to: '/settings', label: 'Ayarlar' },
  ].find((l) => l.to === location.pathname);
  const isSettings = location.pathname === '/settings';
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        İçeriğe geç
      </a>
      {menu && (
        <button
          className="sidebar-backdrop"
          aria-label="Menüyü kapat"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <Link className="brand" to="/" onClick={() => setMenu(false)}>
          <span className="brand-mark">
            <Box size={24} strokeWidth={1.7} />
          </span>
          <span>
            logistic<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="workspace">
          <span className="workspace-symbol">
            <Warehouse size={18} />
          </span>
          <div>
            <strong>Ana depo</strong>
            <small>İstanbul · Merkez</small>
          </div>
          <ChevronDown size={14} aria-hidden="true" />
        </div>
        <span className="nav-caption">ÇALIŞMA ALANI</span>
        <nav aria-label="Ana menü">
          {links
            .filter((link) => connection.mode === 'demo' || livePaths.includes(link.to))
            .map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={() => setMenu(false)}
              >
                <link.icon size={19} strokeWidth={1.7} />
                <span>{link.label}</span>
                {link.to === '/rf' && <span className="nav-tag">RF</span>}
              </NavLink>
            ))}
          <div className="nav-divider" />
          <span className="nav-caption">YÖNETİM</span>
          {connection.mode === 'demo' && session?.user.role === 'admin' && (
            <NavLink to="/users" onClick={() => setMenu(false)}>
              <Users size={19} />
              <span>Kullanıcılar</span>
            </NavLink>
          )}
          <NavLink to="/settings" onClick={() => setMenu(false)}>
            <Settings2 size={19} />
            <span>Ayarlar</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <Link to="/rf" className="sidebar-tip">
            <span className="tip-icon">
              <Barcode size={19} />
            </span>
            <strong>Depo cebinde.</strong>
            <p>
              RF terminaliyle barkod okut,
              <br />
              ürünleri raflara yerleştir.
            </p>
            <span>
              Terminali aç <ArrowUpRight size={15} />
            </span>
          </Link>
          <div className="profile">
            <span className="avatar">
              {session?.user.fullName
                .split(' ')
                .map((s) => s[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div>
              <strong>{session?.user.fullName}</strong>
              <small>
                {session?.user.role === 'admin'
                  ? 'Admin'
                  : connection.mode === 'live'
                    ? 'User'
                    : 'Employee'}
              </small>
            </div>
            <button aria-label="Çıkış yap" title="Çıkış yap" onClick={logout}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label={menu ? 'Menüyü kapat' : 'Menüyü aç'}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>Çalışma alanı</span>
            <span className="crumb-slash">/</span>
            <strong>{selected?.label || 'Sayfa'}</strong>
          </div>
          <div className="topbar-right">
            <Badge tone={connection.mode === 'demo' ? 'orange' : 'green'}>
              <span className="status-dot" />
              {connection.mode === 'demo' ? 'Demo modu' : 'Canlı API'}
            </Badge>
            <span className="topbar-date">
              {new Intl.DateTimeFormat('tr-TR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'Europe/Istanbul',
              }).format(new Date())}
            </span>
          </div>
        </header>
        <main id="main-content" className="page-content">
          {isSettings ? (
            <Outlet />
          ) : loading && !data ? (
            <Loading />
          ) : error ? (
            <div className="panel connection-error">
              <h2>Depo bilgileri alınamadı</h2>
              <p>
                API adresini ve gerekli endpointleri kontrol et. Backend sözleşmesi proje içindeki
                docs klasöründe.
              </p>
              <ErrorBox message={error} />
              <Button onClick={() => void refresh()}>Tekrar dene</Button>{' '}
              <Link to="/settings" className="text-link">
                Bağlantı ayarları →
              </Link>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
        <footer className="app-footer">
          <span>
            Logistic ERP <span className="footer-dot">·</span> Depo operasyonları
          </span>
          <span>
            <span className={`status-dot ${loading ? 'orange' : ''}`} />
            {loading ? 'Veriler güncelleniyor' : 'Çalışma alanın hazır'}
          </span>
        </footer>
      </div>
    </div>
  );
}
