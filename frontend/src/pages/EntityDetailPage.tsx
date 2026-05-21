import { useParams } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useEntityDetail, useEntityHistory } from '../features/entities/hooks';
import { Card } from '../components/ui';
import { EntityControl } from '../components/EntityControl';
import { PageHeader } from '../components/PageHeader';
import { chartTime } from '../utils/format';

export function EntityDetailPage() {
  const { entityId = '' } = useParams();
  const decoded = decodeURIComponent(entityId);
  const entity = useEntityDetail(decoded);
  const history = useEntityHistory(decoded);
  const data = history.data?.map((point) => ({ time: chartTime(point.last_changed), value: Number(point.state === 'on' ? 1 : point.state === 'off' ? 0 : point.state) })).filter((point) => Number.isFinite(point.value)) ?? [];

  return (
    <>
      <PageHeader title={entity.data?.name ?? decoded} subtitle={decoded} />
      {entity.data ? <EntityControl entity={entity.data} /> : null}
      <Card className="mt-4">
        <h2 className="mb-3 text-base font-semibold">История состояний</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#0b7fab" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  );
}
