import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '../api';
import { Button, Card, Input } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { queryKeys } from '../shared/queryKeys';
import { formatDateTime } from '../utils/format';

const LIMIT = 20;

export function EventsPage() {
  const [entityId, setEntityId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const params = { entity_id: entityId, from, to, limit: LIMIT, offset };
  const events = useQuery({ queryKey: queryKeys.events.list(params), queryFn: () => eventsApi.list(params) });
  const total = events.data?.total ?? 0;

  return (
    <>
      <PageHeader title="События" subtitle="Журнал событий" />
      <Card className="mb-4 grid gap-3 md:grid-cols-4">
        <Input aria-label="Фильтр по объекту" placeholder="Фильтр по объекту" value={entityId} onChange={(event) => { setOffset(0); setEntityId(event.target.value); }} />
        <Input aria-label="С" type="datetime-local" lang="ru" value={from} onChange={(event) => { setOffset(0); setFrom(event.target.value); }} />
        <Input aria-label="По" type="datetime-local" lang="ru" value={to} onChange={(event) => { setOffset(0); setTo(event.target.value); }} />
        <div className="flex gap-2"><Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>← Назад</Button><Button disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)}>Вперёд →</Button></div>
      </Card>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs text-muted"><tr><th className="py-2">Время</th><th>Объект</th><th>Было</th><th>Стало</th><th>Источник</th><th>Тип</th></tr></thead>
          <tbody>
            {events.data?.events.map((event) => (
              <tr key={event.id} className="border-t border-line">
                <td className="py-2">{formatDateTime(event.created_at)}</td>
                <td>{event.entity_id}</td>
                <td>{event.old_state ?? '-'}</td>
                <td>{event.new_state ?? '-'}</td>
                <td>{event.source}</td>
                <td>{event.event_type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
