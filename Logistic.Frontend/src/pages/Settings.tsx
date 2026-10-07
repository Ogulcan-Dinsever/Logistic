import { useState } from 'react';
import { Cable, RotateCcw } from 'lucide-react';
import { connection } from '../config';
import { useAuth } from '../context';
import { Badge, Button, ErrorBox, Modal, PageHeader } from '../components/ui';
import ConnectionPanel from '../components/ConnectionPanel';
export default function Settings() {
  const { session } = useAuth();
  const [reset, setReset] = useState(false);
  const [error, setError] = useState('');
  const resetData = async () => {
    try {
      const { resetDemo } = await import('../demo/engine');
      resetDemo();
      sessionStorage.removeItem('logistic.session');
      window.location.assign('/login');
    } catch {
      setError('Demo sıfırlanamadı. Tarayıcı depolama ayarını kontrol et.');
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="ÇALIŞMA ALANI AYARLARI"
        title="Ayarlar"
        description="Bağlantını yapılandır, demo ile canlı API arasında geçiş yap."
      />
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div className="title-with-icon">
            <span className="section-icon">
              <Cable size={20} />
            </span>
            <div>
              <h2>API bağlantısı</h2>
              <p>Bağlantı tercihi bu tarayıcıda saklanır.</p>
            </div>
          </div>
          <Badge tone={connection.mode === 'demo' ? 'orange' : 'green'}>
            {connection.mode === 'demo' ? 'Demo modu' : 'Canlı API'}
          </Badge>
        </div>
        <div className="panel-body">
          <ConnectionPanel />
        </div>
      </section>
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Hesap bilgileri</h2>
            <p>Mevcut oturum</p>
          </div>
        </div>
        <div className="panel-body account-info">
          <div>
            <small>AD SOYAD</small>
            <strong>{session?.user.fullName}</strong>
          </div>
          <div>
            <small>E-POSTA</small>
            <strong>{session?.user.email}</strong>
          </div>
          <div>
            <small>ROL</small>
            <strong>{session?.user.role === 'admin' ? 'Admin' : 'Employee'}</strong>
          </div>
        </div>
      </section>
      {connection.mode === 'demo' && session?.user.role === 'admin' && (
        <section className="panel settings-panel">
          <div className="panel-body reset-settings">
            <div>
              <h2>Demoyu başa döndür</h2>
              <p>
                Bu tarayıcıdaki örnek depo verilerini ilk durumuna getirir.
                <br />
                Eklediğin demo kayıtları silinir ve oturumun kapanır.
              </p>
            </div>
            <Button variant="secondary" onClick={() => setReset(true)}>
              <RotateCcw size={16} />
              Demo verilerini sıfırla
            </Button>
          </div>
        </section>
      )}
      {reset && (
        <Modal
          title="Demo verileri sıfırlansın mı?"
          description="Bu tarayıcıda eklediğin demo ürünler, stok işlemleri ve kullanıcılar silinecek."
          onClose={() => setReset(false)}
        >
          <ErrorBox message={error} />
          <div className="form-footer">
            <Button variant="secondary" onClick={() => setReset(false)}>
              Vazgeç
            </Button>
            <Button variant="danger" onClick={() => void resetData()}>
              Demoyu sıfırla
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
