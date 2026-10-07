import { useState } from 'react';
import { Cable, MonitorPlay, Save } from 'lucide-react';
import { connection, saveConnection } from '../config';
import type { Connection } from '../config';
import { Button, ErrorBox, Field } from './ui';

export default function ConnectionPanel() {
  const [mode, setMode] = useState<Connection['mode']>(connection.mode);
  const [baseUrl, setBaseUrl] = useState(connection.baseUrl);
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        try {
          saveConnection({ mode, baseUrl });
          window.location.assign('/login');
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Adres geçersiz.');
        }
      }}
    >
      <div className="connection-options">
        <button
          type="button"
          className={mode === 'demo' ? 'selected' : ''}
          onClick={() => setMode('demo')}
        >
          <MonitorPlay size={21} />
          <strong>Demo modu</strong>
          <small>Örnek depo ile hemen dene</small>
        </button>
        <button
          type="button"
          className={mode === 'live' ? 'selected' : ''}
          onClick={() => setMode('live')}
        >
          <Cable size={21} />
          <strong>Backend bağlantısı</strong>
          <small>.NET API ile çalış</small>
        </button>
      </div>
      <Field
        label="API adresi"
        htmlFor="base-url"
        hint="Logistic.API HTTPS profili: https://localhost:7228/api"
      >
        <input
          id="base-url"
          type="url"
          required
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </Field>
      <ErrorBox message={error} />
      <div className="form-footer">
        <small>Kaydettiğinde mevcut oturum kapanır.</small>
        <Button type="submit">
          <Save size={16} />
          Bağlantıyı kaydet
        </Button>
      </div>
    </form>
  );
}
