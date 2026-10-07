import { useCallback, useEffect, useState } from 'react';
import { Plus, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '../api';
import { useAction, useAuth, useToast } from '../context';
import type { Role, User, UserInput } from '../types';
import {
  Badge,
  Button,
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  PageHeader,
} from '../components/ui';
const blank: UserInput = { fullName: '', email: '', password: '', role: 'employee' };
export default function Users() {
  const { session } = useAuth();
  const toast = useToast();
  const action = useAction();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [create, setCreate] = useState(false);
  const [form, setForm] = useState<UserInput>(blank);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await api.users());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kullanıcılar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const edit = (user: User, role: Role, isActive: boolean) =>
    void action.run(
      { id: user.id, role, isActive },
      () => api.updateUser(user.id, { role, isActive }),
      async () => {
        toast('Kullanıcı yetkileri güncellendi.');
        await load();
      },
    );
  return (
    <>
      <PageHeader
        eyebrow="EKİP YÖNETİMİ"
        title="Kullanıcılar"
        description="Ekibine kullanıcı ekle, rol ve erişimlerini yönet."
        actions={
          <Button
            onClick={() => {
              setCreate(true);
              action.clearError();
            }}
          >
            <Plus size={18} />
            Yeni kullanıcı
          </Button>
        }
      />
      <div className="role-cards">
        <div>
          <span className="section-icon">
            <ShieldCheck size={21} />
          </span>
          <div>
            <strong>Admin</strong>
            <p>Ürün, raf, kullanıcı ve tüm depo işlemlerini yönetir.</p>
          </div>
        </div>
        <div>
          <span className="section-icon sand">
            <UserRound size={21} />
          </span>
          <div>
            <strong>Employee</strong>
            <p>Stokları görür, mal kabul, yerleştirme ve satış yapar.</p>
          </div>
        </div>
      </div>
      <ErrorBox message={error || (!create ? action.error : '')} />
      {error && (
        <Button variant="secondary" onClick={() => void load()}>
          Tekrar dene
        </Button>
      )}
      <section className="panel">
        {loading ? (
          <Loading />
        ) : users.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>E-posta</th>
                  <th>Rol</th>
                  <th>Durum</th>
                  <th>Erişim</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-label">
                        <span className="avatar light">
                          {u.fullName
                            .split(' ')
                            .map((s) => s[0])
                            .slice(0, 2)
                            .join('')}
                        </span>
                        <div>
                          <strong>{u.fullName}</strong>
                          {u.id === session?.user.id && <small>Senin hesabın</small>}
                        </div>
                      </div>
                    </td>
                    <td className="muted">{u.email}</td>
                    <td>
                      <select
                        aria-label={`${u.fullName} rolü`}
                        value={u.role}
                        disabled={u.id === session?.user.id || action.busy}
                        onChange={(e) => edit(u, e.target.value as Role, u.isActive)}
                      >
                        <option value="admin">Admin</option>
                        <option value="employee">Employee</option>
                      </select>
                    </td>
                    <td>
                      <Badge tone={u.isActive ? 'green' : 'neutral'}>
                        {u.isActive ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        disabled={u.id === session?.user.id || action.busy}
                        onClick={() => edit(u, u.role, !u.isActive)}
                      >
                        {u.isActive ? 'Pasife al' : 'Aktifleştir'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Kullanıcı bulunamadı"
            description="Yeni kullanıcı ekleyerek ekibini oluştur."
          />
        )}
      </section>
      {create && (
        <Modal
          title="Yeni kullanıcı ekle"
          description="Kullanıcıya başlangıç şifresi ve bir rol tanımla."
          onClose={() => {
            if (!action.busy) setCreate(false);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(
                form,
                () => api.createUser(form),
                async () => {
                  setCreate(false);
                  setForm(blank);
                  toast('Yeni kullanıcı oluşturuldu.');
                  await load();
                },
              );
            }}
          >
            <Field label="Ad soyad" htmlFor="user-name">
              <input
                id="user-name"
                required
                maxLength={160}
                autoComplete="name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </Field>
            <Field label="E-posta" htmlFor="user-email">
              <input
                id="user-email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Başlangıç şifresi" htmlFor="user-password" hint="En az 8 karakter.">
              <input
                id="user-password"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Field label="Rol" htmlFor="user-role">
              <select
                id="user-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <ErrorBox message={action.error} />
            <div className="form-footer">
              <Button type="submit" busy={action.busy}>
                Kullanıcı oluştur
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
