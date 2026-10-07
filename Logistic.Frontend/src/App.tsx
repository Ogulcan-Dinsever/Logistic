import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, ToastProvider, useAuth, WarehouseProvider } from './context';
import Layout from './components/Layout';
import { Empty, Loading } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Receipts from './pages/Receipts';
import RfTerminal from './pages/RfTerminal';
import Sales from './pages/Sales';
import MovementsPage from './pages/MovementsPage';
import Users from './pages/Users';
import Settings from './pages/Settings';
import { connection } from './config';
function Protected() {
  const { session, loading } = useAuth();
  if (loading) return <Loading />;
  return session ? (
    <WarehouseProvider>
      <Layout />
    </WarehouseProvider>
  ) : (
    <Navigate to="/login" replace />
  );
}
function AdminOnly() {
  return useAuth().session?.user.role === 'admin' ? <Outlet /> : <Navigate to="/" replace />;
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Protected />}>
              <Route
                index
                element={
                  connection.mode === 'demo' ? <Dashboard /> : <Navigate to="/inventory" replace />
                }
              />
              <Route path="inventory" element={<Inventory />} />
              <Route path="products" element={<Products />} />
              <Route path="receipts" element={<Receipts />} />
              <Route path="rf" element={<RfTerminal />} />
              <Route
                path="sales"
                element={
                  connection.mode === 'demo' ? <Sales /> : <Navigate to="/inventory" replace />
                }
              />
              <Route
                path="movements"
                element={
                  connection.mode === 'demo' ? (
                    <MovementsPage />
                  ) : (
                    <Navigate to="/inventory" replace />
                  )
                }
              />
              <Route element={<AdminOnly />}>
                <Route
                  path="users"
                  element={
                    connection.mode === 'demo' ? <Users /> : <Navigate to="/inventory" replace />
                  }
                />
              </Route>
              <Route path="settings" element={<Settings />} />
              <Route
                path="*"
                element={
                  <Empty
                    title="Bu sayfa bulunamadı"
                    description="Çalışma alanına dönerek devam edebilirsin."
                    action={
                      <Link className="button primary" to="/">
                        Genel bakışa dön
                      </Link>
                    }
                  />
                }
              />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
