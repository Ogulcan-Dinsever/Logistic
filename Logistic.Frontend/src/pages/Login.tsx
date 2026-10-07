import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Box, Check, Eye, EyeOff, ScanLine, Settings2, Warehouse } from 'lucide-react';
import { api } from '../api';
import { useAction, useAuth } from '../context';
import { connection } from '../config';
import { Badge, Button, ErrorBox, Field, Modal } from '../components/ui';
import ConnectionPanel from '../components/ConnectionPanel';

export default function Login() {
  const { session, setSession } = useAuth();
  const navigate = useNavigate();
  const action = useAction();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [visible, setVisible] = useState(false);
  const [settings, setSettings] = useState(false);
  if (session) return <Navigate to="/inventory" replace />;
  function submit(loginEmail: string, loginPassword: string, createAccount = false) {
    void action.run(
      {
        email: loginEmail,
        password: loginPassword,
        fullName,
        register: createAccount,
      },
      () =>
        createAccount
          ? api.register(fullName, loginEmail.trim(), loginPassword)
          : api.login(loginEmail.trim(), loginPassword),
      (result) => {
        setSession(result);
        navigate('/inventory');
      },
    );
  }
  function quickLogin(role: 'admin' | 'employee') {
    const account = role === 'employee' && connection.mode === 'live' ? 'user' : role;
    const loginEmail = `${account}@logistic.demo`;
    setEmail(loginEmail);
    setPassword('Demo123!');
    setRegister(false);
    action.clearError();
    submit(loginEmail, 'Demo123!');
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">
            <Box size={26} />
          </span>
          <span>
            logistic<span className="brand-dot">.</span>
          </span>
        </div>
        <div className="login-story-content">
          <span className="login-kicker">
            <span className="status-dot" /> DEPO OPERASYONLARI, TEK YERDE.
          </span>
          <h1>
            Her ürünün
            <br />
            yeri belli.
            <br />
            <span>Her adım kontrolünde.</span>
          </h1>
          <p>
            Mal kabulden satışa, deponun bütün akışını
            <br className="desktop-only" /> sade bir çalışma alanında yönet.
          </p>
          <div className="warehouse-art" aria-hidden="true">
            <div className="art-label">
              <Warehouse size={15} /> ANA DEPO <span>AKTİF</span>
            </div>
            <div className="art-shelves">
              {['A', 'B', 'C'].map((row, i) => (
                <div className="art-row" key={row}>
                  <span>{row}</span>
                  {Array.from({ length: 4 }, (_, j) => (
                    <div className={`art-bin bin-${(i + j) % 3}`} key={j}>
                      <Box size={26} strokeWidth={1.2} />
                      <small>
                        {row}-0{j + 1}
                      </small>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="art-scanner">
              <ScanLine size={19} />
              <span>8690000001001</span>
              <span className="art-check">
                <Check size={14} /> Rafla eşleşti
              </span>
            </div>
          </div>
        </div>
        <div className="login-story-footer">
          <span>Mal kabul</span>
          <span>•</span>
          <span>Stok yönetimi</span>
          <span>•</span>
          <span>Satış</span>
        </div>
      </section>
      <section className="login-form-side">
        <button className="login-settings" disabled={action.busy} onClick={() => setSettings(true)}>
          <Settings2 size={16} />
          Bağlantı ayarları
        </button>
        <div className="login-form-wrap">
          <Badge tone="neutral">
            {connection.mode === 'demo' ? 'Görüşme için hazır demo' : 'Logistic.API bağlantısı'}
          </Badge>
          <h2>{register ? 'Hesabını oluştur.' : 'Tekrar hoş geldin.'}</h2>
          <p>
            {register
              ? 'Employee hesabınla depo ekibine katıl.'
              : 'Deponda bugün neler oluyor, birlikte bakalım.'}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(email, password, register);
            }}
          >
            {register && (
              <Field label="Ad soyad" htmlFor="full-name">
                <input
                  id="full-name"
                  autoComplete="name"
                  placeholder="Adın ve soyadın"
                  required
                  disabled={action.busy}
                  maxLength={160}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </Field>
            )}
            <Field label="E-posta adresi" htmlFor="email">
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="ad@firma.com"
                required
                disabled={action.busy}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field
              label="Şifre"
              htmlFor="password"
              hint={register ? 'En az 8 karakter kullan.' : undefined}
            >
              <div className="password-input">
                <input
                  id="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete={register ? 'new-password' : 'current-password'}
                  placeholder="Şifreni gir"
                  required
                  disabled={action.busy}
                  minLength={register ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  disabled={action.busy}
                  aria-label={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            <ErrorBox message={action.error} />
            <Button type="submit" className="full-width login-submit" busy={action.busy}>
              {register ? 'Hesap oluştur' : 'Giriş yap'}
              <ArrowRight size={18} />
            </Button>
          </form>
          <div className="register-toggle">
            {register ? 'Zaten bir hesabın var mı?' : 'Henüz bir hesabın yok mu?'}{' '}
            <button
              disabled={action.busy}
              onClick={() => {
                setRegister(!register);
                action.clearError();
              }}
            >
              {register ? 'Giriş yap' : 'Hesap oluştur'}
            </button>
          </div>
          <div className="demo-accounts">
            <span>{connection.mode === 'demo' ? 'HIZLICA DENE' : 'HIZLI GİRİŞ'}</span>
            <div>
              <button disabled={action.busy} onClick={() => quickLogin('admin')}>
                <span className="demo-avatar">DK</span>
                <div>
                  <strong>Admin ile gir</strong>
                  <small>Deniz Kaya · Tüm yönetim yetkileri</small>
                </div>
                <ArrowRight size={16} />
              </button>
              <button disabled={action.busy} onClick={() => quickLogin('employee')}>
                <span className="demo-avatar employee">EY</span>
                <div>
                  <strong>
                    {connection.mode === 'demo' ? 'Employee ile gir' : 'User ile gir'}
                  </strong>
                  <small>Elif Yılmaz · Depo & satış işlemleri</small>
                </div>
                <ArrowRight size={16} />
              </button>
            </div>
            <small>
              {connection.mode === 'demo' ? 'Demo şifresi' : 'Hesap şifresi'}: <code>Demo123!</code>{' '}
              · Kartla doğrudan giriş yap.
            </small>
          </div>
        </div>
        <div className="login-bottom">Daha düzenli bir depo. Daha rahat bir iş günü.</div>
      </section>
      {settings && (
        <Modal title="Bağlantı ayarları" onClose={() => setSettings(false)}>
          <ConnectionPanel />
        </Modal>
      )}
    </div>
  );
}
