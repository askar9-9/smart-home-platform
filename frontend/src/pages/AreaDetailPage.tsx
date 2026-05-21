import { Link, useParams } from 'react-router-dom';
import { useAreasList } from '../features/areas/hooks';
import { useDevicesList } from '../features/devices/hooks';
import { Badge, Card, EmptyState } from '../components/ui';
import { EntityControl } from '../components/EntityControl';
import { PageHeader } from '../components/PageHeader';

export function AreaDetailPage() {
  const { id = '' } = useParams();
  const areas = useAreasList();
  const devices = useDevicesList(id ? { area_id: id } : undefined);
  const area = areas.data?.find((item) => item.id === id);
  const items = devices.data?.devices ?? [];

  return (
    <>
      <PageHeader title={area?.name ?? 'Зона'} subtitle={`${items.length} устройств в этой зоне`} />
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((device) => (
          <Card key={device.id}>
            <Link to={`/devices/${device.id}`} className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{device.name_by_user ?? device.name}</div>
                <div className="text-xs text-muted">{[device.manufacturer, device.model].filter(Boolean).join(' ') || 'Производитель неизвестен'}</div>
              </div>
              <Badge tone={device.status === 'online' ? 'success' : 'danger'}>
                {device.status === 'online' ? 'В сети' : 'Нет связи'}
              </Badge>
            </Link>
            <div className="mt-4 grid gap-3">
              {device.entities?.map((entity) => <EntityControl key={entity.entity_id} entity={entity} compact />)}
            </div>
          </Card>
        ))}
      </div>
      {!items.length ? <EmptyState title="В этой зоне пока нет устройств" /> : null}
    </>
  );
}
