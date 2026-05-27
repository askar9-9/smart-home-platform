import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Gauge } from 'lucide-react';
import { ApiError } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Input, PrimaryButton } from '../components/ui';

export function LoginPage() {
  const { token, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (token) return <Navigate to="/dashboard" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate((location.state as { from?: string } | null)?.from ?? '/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Неверное имя пользователя или пароль');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-panel px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-line bg-white p-6 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <Gauge className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">homeIQ</h1>
            <p className="text-sm text-muted">Войдите в систему</p>
          </div>
        </div>
        <label className="block text-sm font-medium">
          Логин
          <Input
            autoComplete="username"
            className="mt-2 w-full"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Пароль
          <Input
            autoComplete="current-password"
            className="mt-2 w-full"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <div role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-danger">{error}</div> : null}
        <PrimaryButton className="mt-6 w-full" disabled={loading}>
          {loading ? 'Вхожу…' : 'Войти'}
        </PrimaryButton>
      </form>
    </main>
  );
}
