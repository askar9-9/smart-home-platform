import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { mlApi } from '../api';
import type { MlAnomalySeverity, Period } from '../api/types';
import { Badge, Button, Card, EmptyState } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { queryKeys } from '../shared/queryKeys';
import { chartTime, formatDateTime } from '../utils/format';

const periods: Array<[Period, string]> = [
  ['day', 'За день'],
  ['week', 'За неделю'],
  ['month', 'За месяц']
];

const severityTone: Record<MlAnomalySeverity, 'neutral' | 'warning' | 'danger'> = {
  low: 'neutral',
  medium: 'warning',
  high: 'danger'
};

const severityLabel: Record<MlAnomalySeverity, string> = {
  low: 'Низкая',
  medium: 'Средняя',
  high: 'Высокая'
};

export function MlAnomaliesPage() {
  const [period, setPeriod] = useState<Period>('day');
  const anomalies = useQuery({
    queryKey: queryKeys.ml.anomalies(period, 100),
    queryFn: () => mlApi.anomalies(period)
  });
  const data = anomalies.data;
  const timeline = data?.timeline.map((point) => ({ ...point, label: chartTime(point.timestamp), anomalyPower: point.anomaly ? point.power_w : null })) ?? [];
  const anomalyPoints = timeline.filter((point) => point.anomaly);

  return (
    <>
      <PageHeader
        title="ML Аномалии"
        subtitle="IsolationForest анализирует профиль потребления по обученной модели"
        actions={
          <div className="flex flex-wrap gap-2">
            {periods.map(([item, label]) => (
              <Button key={item} className={period === item ? 'bg-primary text-white' : ''} onClick={() => setPeriod(item)}>
                {label}
              </Button>
            ))}
          </div>
        }
      />

      {anomalies.isError ? (
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-start gap-3 text-sm text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">ML модель недоступна</div>
              <div>Запустите обучение модели или проверьте backend artifact.</div>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Точек в выборке" value={anomalies.isLoading ? '...' : String(data?.summary.total ?? 0)} />
        <Metric label="Аномалий" value={anomalies.isLoading ? '...' : String(data?.summary.anomalies ?? 0)} />
        <Metric label="Модель" value={data?.model.name ?? 'IsolationForest'} />
        <Metric label="Источник" value={data?.model.dataset ?? 'UCI Household'} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.7fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Профиль потребления</h2>
            <Badge tone="success">confidence: {data?.model.confidence ?? 'ml'}</Badge>
          </div>
          <div className="h-80">
            {anomalies.isLoading ? (
              <EmptyState title="Загрузка временного ряда..." />
            ) : timeline.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline}>
                  <CartesianGrid stroke="#dbe3ed" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="power" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="score" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line yAxisId="power" dataKey="power_w" name="Вт" stroke="#0b7fab" strokeWidth={2} dot={false} />
                  <Line yAxisId="score" dataKey="anomaly_score" name="ML score" stroke="#7c3aed" strokeWidth={2} dot={false} />
                  <Line yAxisId="power" dataKey="anomalyPower" name="Аномалия" stroke="#dc2626" strokeWidth={0} dot={{ r: 5, fill: '#dc2626' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="Нет показаний энергии за выбранный период" />
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-semibold">Точки аномалий</h2>
          <div className="h-80">
            {anomalyPoints.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid stroke="#dbe3ed" />
                  <XAxis dataKey="label" name="Время" tick={{ fontSize: 11 }} type="category" />
                  <YAxis dataKey="anomaly_score" name="Score" tick={{ fontSize: 11 }} />
                  <ZAxis range={[80, 180]} />
                  <Tooltip />
                  <Scatter data={anomalyPoints} fill="#dc2626" />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title={anomalies.isLoading ? 'Загрузка аномалий...' : 'ML аномалии не найдены'} />
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Журнал ML аномалий</h2>
          {data?.model.trained_at ? <span className="text-xs text-muted">Обучена: {formatDateTime(data.model.trained_at)}</span> : null}
        </div>
        {data?.anomalies.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Время</th>
                  <th className="py-2 pr-4 font-medium">Объект</th>
                  <th className="py-2 pr-4 font-medium">Мощность</th>
                  <th className="py-2 pr-4 font-medium">Score</th>
                  <th className="py-2 pr-4 font-medium">Важность</th>
                  <th className="py-2 font-medium">Причина</th>
                </tr>
              </thead>
              <tbody>
                {data.anomalies.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-0">
                    <td className="py-3 pr-4 text-muted">{formatDateTime(item.recorded_at)}</td>
                    <td className="py-3 pr-4">
                      <div className="font-medium">{item.device_name}</div>
                      <div className="text-xs text-muted">{item.entity_id}</div>
                    </td>
                    <td className="py-3 pr-4">{item.power_w} Вт</td>
                    <td className="py-3 pr-4">{item.anomaly_score}</td>
                    <td className="py-3 pr-4">
                      <Badge tone={severityTone[item.severity]}>{severityLabel[item.severity]}</Badge>
                    </td>
                    <td className="py-3">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={anomalies.isLoading ? 'Загрузка журнала...' : 'За выбранный период ML аномалии не найдены'} />
        )}
      </Card>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="truncate text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </Card>
  );
}
