import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAreasList } from '../features/areas/hooks';
import { useDeleteDevice, useDeviceDetail, useUpdateDevice } from '../features/devices/hooks';
import { useEntityHistory } from '../features/entities/hooks';
import { DeviceForm } from '../components/DeviceForm';
import { useToast } from '../components/Toast';
import { Badge, Button, Card } from '../components/ui';
import { EntityControl } from '../components/EntityControl';
import { PageHeader } from '../components/PageHeader';
import { chartTime, formatDateTime } from '../utils/format';

export function DeviceDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const device = useDeviceDetail(id);
  const areas = useAreasList();
  const firstEntity = device.data?.entities?.[0]?.entity_id;
  const history = useEntityHistory(firstEntity ?? '');
  const update = useUpdateDevice(id);
  const remove = useDeleteDevice(id);

  async function handleUpdate(values: Parameters<typeof update.mutateAsync>[0]) {
    await update.mutateAsync(values);
    toast('Устройство обновлено', 'success');
    setIsEditing(false);
  }

  async function handleRemove() {
    await remove.mutateAsync();
    toast('Устройство удалено', 'success');
    navigate('/devices');
  }

  const data =
    history.data
      ?.map((point) => ({
        time: chartTime(point.last_changed),
        value: Number(point.state === 'on' ? 1 : point.state === 'off' ? 0 : point.state),
      }))
      .filter((point) => Number.isFinite(point.value)) ?? [];

  return (
    <>
      <PageHeader
        title={device.data?.name_by_user ?? device.data?.name ?? 'Устройство'}
        subtitle={`${device.data?.type ?? ''} · ${device.data?.area_name ?? 'Не назначено'}`}
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setIsEditing((value) => !value)}>
              <Pencil className="h-4 w-4" />
              {isEditing ? 'Скрыть форму' : 'Редактировать'}
            </Button>
            <Button
              className="border-red-200 bg-red-50 text-danger hover:bg-red-100"
              onClick={() => {
                if (window.confirm(`Удалить устройство «${device.data?.name_by_user ?? device.data?.name ?? ''}»?`)) {
                  void handleRemove();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Удалить
            </Button>
          </div>
        }
      />
      {isEditing && device.data ? (
        <Card className="mb-4">
          <DeviceForm
            areas={areas.data ?? []}
            initialValue={device.data}
            mode="edit"
            submitLabel="Сохранить устройство"
            pending={update.isPending}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditing(false)}
          />
        </Card>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-muted">Производитель</div>
              <div className="font-semibold">{device.data?.manufacturer ?? 'Не указан'}</div>
            </div>
            <Badge tone={device.data?.status === 'online' ? 'success' : 'danger'}>
              {device.data?.status === 'online'
                ? 'В сети'
                : device.data?.status === 'offline'
                  ? 'Нет связи'
                  : 'Неизвестно'}
            </Badge>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <dt className="text-muted">Модель</dt>
            <dd>{device.data?.model ?? '-'}</dd>
            <dt className="text-muted">Добавлено</dt>
            <dd>{formatDateTime(device.data?.created_at) ?? '—'}</dd>
            <dt className="text-muted">Обновлено</dt>
            <dd>{formatDateTime(device.data?.updated_at) ?? '—'}</dd>
          </dl>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">История</h2>
          <div className="h-64">
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
      </div>
      <h2 className="mb-3 mt-4 text-base font-semibold">Объекты</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {device.data?.entities?.map((entity) => (
          <EntityControl key={entity.entity_id} entity={entity} />
        ))}
      </div>
    </>
  );
}
