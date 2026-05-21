import type { ReactNode } from 'react';
import { Activity, Bot, Home, PlugZap, Zap } from 'lucide-react';
import { useDashboard } from '../features/dashboard/hooks';
import { useEntitiesList } from '../features/entities/hooks';
import { Card, EmptyState } from '../components/ui';
import { EntityControl } from '../components/EntityControl';
import { FloorPlanCard } from '../components/FloorPlanCard';
import { PageHeader } from '../components/PageHeader';
import { formatDateTime } from '../utils/format';

export function DashboardPage() {
  const dashboard = useDashboard();
  const entities = useEntitiesList();
  const allEntities = entities.data?.entities ?? [];
  const controls = allEntities.filter((entity) => ['light', 'switch'].includes(entity.domain)).slice(0, 4);

  return (
    <>
      <PageHeader title={dashboard.data?.home.name ?? 'Обзор'} subtitle="Обзор дома" />
      {dashboard.isError ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-warning">
          Нет связи с сервером — данные могут быть устаревшими. Обновление произойдёт автоматически.
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric
          icon={<PlugZap />}
          label="Устройства"
          value={`${dashboard.data?.summary.devices_online ?? 0}/${dashboard.data?.summary.devices_total ?? 0}`}
        />
        <Metric icon={<Bot />} label="Активных автоматизаций" value={dashboard.data?.summary.automations_active ?? 0} />
        <Metric icon={<Zap />} label="Текущая мощность" value={`${dashboard.data?.summary.current_power_w ?? 0} Вт`} />
        <Metric icon={<Activity />} label="Сегодня" value={`${dashboard.data?.summary.energy_today_kwh ?? 0} кВт·ч`} />
        <Metric icon={<Home />} label="Зоны" value={dashboard.data?.areas.length ?? 0} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Зоны</h2>
          {dashboard.data?.areas.length ? (
            <FloorPlanCard areas={dashboard.data.areas} />
          ) : (
            <EmptyState
              title="Зон пока нет"
              action={<span className="text-xs text-muted">Добавьте первую зону в разделе «Зоны»</span>}
            />
          )}
        </div>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Последние события</h2>
          <div className="space-y-3">
            {dashboard.data?.recent_events
              .filter((event) => event.entity_id && event.old_state !== event.new_state)
              .slice(0, 10)
              .map((event) => (
                <div key={event.id} className="border-b border-line pb-2 last:border-0">
                  <div className="truncate text-sm">{event.entity_id}</div>
                  <div className="text-xs text-muted">
                    {event.old_state ?? '-'} → {event.new_state ?? '-'} · {event.source} · {formatDateTime(event.created_at)}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>
      <div className="mt-4">
        <h2 className="mb-3 text-lg font-semibold">Управление</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {controls.map((entity) => (
            <EntityControl key={entity.entity_id} entity={entity} compact />
          ))}
        </div>
      </div>
    </>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <div className="flex items-center justify-between text-muted [&_svg]:h-5 [&_svg]:w-5">{icon}</div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </Card>
  );
}
