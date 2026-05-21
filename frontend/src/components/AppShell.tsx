import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, AreaChart, Bot, BrainCircuit, Gauge, Home, Layers3, Link2, LogOut, Menu, Power, Server } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import { useAuth } from '../auth/AuthProvider';
import { useRealtimeSync } from '../features/realtime/hooks';
import { useMe } from '../hooks/useMe';
import { Button } from './ui';

const navItems = [
  { to: '/dashboard', label: 'Обзор', icon: Home },
  { to: '/areas', label: 'Зоны', icon: Layers3 },
  { to: '/devices', label: 'Устройства', icon: Server },
  { to: '/entities', label: 'Объекты', icon: Power },
  { to: '/automations', label: 'Автоматизации', icon: Bot },
  { to: '/energy', label: 'Энергия', icon: AreaChart },
  { to: '/ml/anomalies', label: 'ML Аномалии', icon: BrainCircuit },
  { to: '/events', label: 'События', icon: Activity },
  { to: '/integrations', label: 'Интеграции', icon: Link2 },
];

export function AppShell() {
  const [open, setOpen] = useState(false);
  const { logout, user } = useAuth();
  const me = useMe();
  const status = useRealtimeSync();
  const navigate = useNavigate();
  const resolvedUser = user ?? me.data;

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-line bg-surface">
      <div className="flex h-16 items-center gap-2 border-b border-line px-4">
        <Gauge className="h-6 w-6 text-primary" />
        <div>
          <div className="text-sm font-semibold text-ink">Умный дом</div>
          <div className="text-xs text-muted">Панель управления</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              clsx('flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition', isActive ? 'shadow-[inset_3px_0_0_0_#0b7fab] bg-sky-50 text-sky-800 font-semibold' : 'text-muted hover:bg-panel hover:text-ink')
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <Button onClick={handleLogout} className="w-full justify-start">
          <LogOut className="h-4 w-4" />
          Выйти
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-panel text-ink">
      <div className="fixed inset-y-0 left-0 hidden lg:block">{sidebar}</div>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Закрыть меню" className="absolute inset-0 bg-slate-900/30" onClick={() => setOpen(false)} />
          <div className="relative h-full">{sidebar}</div>
        </div>
      ) : null}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-surface px-4">
          <div className="flex items-center gap-3">
            <Button aria-label="Открыть меню" className="lg:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-4 w-4" />
            </Button>
            <div>
              <div className="text-sm font-semibold">{resolvedUser?.name ?? 'Умный дом'}</div>
              <div className="text-xs text-muted">{me.isError ? 'Нет связи с сервером' : 'Подключено'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className={clsx(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              status === 'live' ? 'bg-green-50 text-green-800' : status === 'polling' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-danger'
            )}>
              <span className={clsx('h-1.5 w-1.5 rounded-full', status === 'live' ? 'bg-success' : status === 'polling' ? 'bg-warning' : 'bg-danger')} />
              {status === 'live' ? 'Подключено' : status === 'polling' ? 'Синхронизация…' : 'Нет связи'}
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
