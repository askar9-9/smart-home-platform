import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAreasList } from '../features/areas/hooks';
import { useCreateDevice, useDevicesList } from '../features/devices/hooks';
import { DeviceForm } from '../components/DeviceForm';
import { useToast } from '../components/Toast';
import { Badge, Button, Card, Select } from '../components/ui';
import { PageHeader } from '../components/PageHeader';

export function DevicesPage() {
  const { toast } = useToast();
  const [type, setType] = useState('');
  const [areaId, setAreaId] = useState('');
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const devices = useDevicesList({ type, area_id: areaId, status });
  const areas = useAreasList();
  const create = useCreateDevice();

  async function handleCreate(values: Parameters<typeof create.mutateAsync>[0]) {
    await create.mutateAsync(values);
    toast('Устройство создано', 'success');
    setShowCreate(false);
  }

  const items = useMemo(() => devices.data?.devices ?? [], [devices.data?.devices]);
  const types = useMemo(
    () =>
      Array.from(
        new Set(items.map((device) => device.type).concat(['light', 'switch', 'sensor', 'climate', 'energy_meter']))
      ),
    [items]
  );
  const TYPE_LABELS: Record<string, string> = {
    light: 'Свет',
    switch: 'Выключатель',
    sensor: 'Датчик',
    climate: 'Климат',
    binary_sensor: 'Бинарный датчик',
    energy_meter: 'Счётчик энергии',
  };

  return (
    <>
      <PageHeader
        title="Устройства"
        subtitle="Все устройства"
        actions={
          <Button onClick={() => setShowCreate((value) => !value)}>
            <Plus className="h-4 w-4" />
            {showCreate ? 'Скрыть форму' : 'Добавить устройство'}
          </Button>
        }
      />
      {showCreate ? (
        <Card className="mb-4">
          <DeviceForm
            areas={areas.data ?? []}
            mode="create"
            submitLabel="Создать устройство"
            pending={create.isPending}
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </Card>
      ) : null}
      <Card className="mb-4 grid gap-3 md:grid-cols-3">
        <Select aria-label="Тип устройства" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">Все типы</option>
          {types.map((item) => (
            <option key={item} value={item}>
              {TYPE_LABELS[item] ?? item}
            </option>
          ))}
        </Select>
        <Select aria-label="Зона" value={areaId} onChange={(event) => setAreaId(event.target.value)}>
          <option value="">Все зоны</option>
          {areas.data?.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Статус" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Любой статус</option>
          <option value="online">онлайн</option>
          <option value="offline">офлайн</option>
        </Select>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((device) => (
          <Link key={device.id} to={`/devices/${device.id}`}>
            <Card className="h-full transition hover:border-primary hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{device.name_by_user ?? device.name}</div>
                  <div className="text-xs text-muted">
                    {TYPE_LABELS[device.type] ?? device.type} · {device.area_name ?? 'Зона не указана'}
                  </div>
                </div>
                <Badge tone={device.status === 'online' ? 'success' : 'danger'}>
                  {device.status === 'online' ? 'В сети' : 'Нет связи'}
                </Badge>
              </div>
              <div className="mt-4 text-sm text-muted">
                {device.manufacturer ?? 'Неизвестно'} {device.model ?? ''}
              </div>
              <div className="mt-2 text-xs text-muted">
                {(device.entity_count ?? device.entities?.length ?? 0) > 0
                  ? `${device.entity_count ?? device.entities?.length} объектов`
                  : 'Нет объектов'}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
