import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { energyApi } from '../api';
import type { Period } from '../api/types';
import { Badge, Button, Card } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { queryKeys } from '../shared/queryKeys';
import { chartTime } from '../utils/format';

export function EnergyPage() {
  const [period, setPeriod] = useState<Period>('day');
  const summary = useQuery({ queryKey: queryKeys.energy.summary(period), queryFn: () => energyApi.summary(period) });
  const consumption = useQuery({ queryKey: queryKeys.energy.consumption(period), queryFn: () => energyApi.consumption(period) });
  const devices = useQuery({ queryKey: queryKeys.energy.devices(period), queryFn: () => energyApi.devices(period) });
  const forecast = useQuery({ queryKey: queryKeys.energy.forecast(), queryFn: energyApi.forecast });
  const lineData = consumption.data?.data.map((point) => ({ ...point, label: chartTime(point.timestamp) })) ?? [];
  const forecastData = forecast.data?.forecast.map((point) => ({ label: `${point.hour}:00`, kwh: point.predicted_kwh, power_w: point.predicted_power_w })) ?? [];

  return (
    <>
      <PageHeader title="Энергия" subtitle="Потребление электроэнергии" actions={
        <div className="flex gap-2">
          {([['day', 'За день'], ['week', 'За неделю'], ['month', 'За месяц']] as [Period, string][]).map(([item, label]) => (
            <Button key={item} className={period === item ? 'bg-primary text-white' : ''} onClick={() => setPeriod(item)}>{label}</Button>
          ))}
        </div>
      } />
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Всего за период" value={`${summary.data?.total_kwh ?? 0} кВт·ч`} />
        <Metric label="Стоимость" value={`${summary.data?.total_cost ?? 0} ${summary.data?.currency ?? 'KZT'}`} />
        <Metric label="Сейчас" value={`${summary.data?.current_power_w ?? 0} Вт`} />
        <Metric label="Пиковая нагрузка" value={`${summary.data?.peak_power_w ?? 0} Вт`} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-base font-semibold">Потребление</h2>
          <div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={lineData}><CartesianGrid stroke="#dbe3ed" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Line dataKey="kwh" stroke="#0b7fab" strokeWidth={2} dot={false} /><Line dataKey="power_w" stroke="#15803d" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
        </Card>
        <Card>
          <h2 className="mb-3 text-base font-semibold">Топ потребителей</h2>
          <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={devices.data ?? []}><CartesianGrid stroke="#dbe3ed" /><XAxis dataKey="device_name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="kwh" fill="#0b7fab" /></BarChart></ResponsiveContainer></div>
        </Card>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.7fr]">
        <Card>
          <h2 className="mb-3 text-base font-semibold">Прогноз на 24 часа</h2>
          <div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={forecastData}><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Line dataKey="kwh" stroke="#0b7fab" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
        </Card>
        <Card>
          <h2 className="mb-3 text-base font-semibold">Аномалии</h2>
          <div className="space-y-3">
            {devices.data?.map((device) => <div key={device.entity_id} className="flex items-center justify-between gap-3 border-b border-line pb-2 text-sm last:border-0"><span>{device.device_name}</span>{device.anomaly ? <Badge tone="warning">{device.anomaly_reason ?? 'Аномалия'}</Badge> : <Badge>Норма</Badge>}</div>)}
          </div>
        </Card>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card><div className="text-2xl font-semibold">{value}</div><div className="text-xs text-muted">{label}</div></Card>;
}
