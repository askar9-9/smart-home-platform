import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Link2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { areasApi, integrationsApi } from '../api';
import type { DiscoveredDevice, Integration, MqttDeviceCreate, MqttEntitySpec } from '../api/types';
import { Badge, Button, Card, EmptyState, Input, PrimaryButton, Select, Textarea } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';
import { invalidateDeviceReadModels } from '../shared/queryInvalidation';
import { queryKeys } from '../shared/queryKeys';
import { formatDateTime } from '../utils/format';

type MqttEntityDraft = Omit<MqttEntitySpec, 'attributes'> & {
  row_id: string;
  attributes_text: string;
};

const CONTROLLABLE_DOMAINS = new Set(['light', 'switch', 'climate']);
const DEVICE_TYPE_OPTIONS = [
  { value: 'light', label: 'Свет' },
  { value: 'switch', label: 'Выключатель' },
  { value: 'sensor', label: 'Датчик' },
  { value: 'climate', label: 'Климат' },
  { value: 'energy_meter', label: 'Счётчик энергии' },
];
const ENTITY_DOMAIN_OPTIONS = [
  { value: 'light', label: 'Свет' },
  { value: 'switch', label: 'Выключатель' },
  { value: 'sensor', label: 'Датчик' },
  { value: 'binary_sensor', label: 'Бинарный датчик' },
  { value: 'climate', label: 'Климат' },
];

function slugifyTopic(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_') || 'device';
}

function nextRowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultMqttEntity(type: string, deviceName: string): MqttEntityDraft {
  const slug = slugifyTopic(deviceName);
  const domain = type === 'energy_meter' ? 'sensor' : type;
  const suffix = type === 'energy_meter' ? '_power' : '';
  const stateTopic = type === 'energy_meter' ? `home/custom/${slug}/power/state` : `home/custom/${slug}/state`;
  const commandTopic = CONTROLLABLE_DOMAINS.has(domain) ? `home/custom/${slug}/set` : null;
  return {
    row_id: nextRowId(),
    entity_id: `${domain}.${slug}${suffix}`,
    domain,
    name: deviceName || 'MQTT Device',
    state: domain === 'sensor' ? '0' : 'off',
    state_topic: stateTopic,
    command_topic: commandTopic,
    availability_topic: `home/custom/${slug}/availability`,
    unit_of_measurement: type === 'energy_meter' ? 'W' : null,
    device_class: type === 'energy_meter' ? 'power' : null,
    brightness_state_topic: domain === 'light' ? `home/custom/${slug}/brightness/state` : null,
    brightness_command_topic: domain === 'light' ? `home/custom/${slug}/brightness/set` : null,
    attributes_text: domain === 'light' ? '{"brightness":0}' : '{}',
  };
}

export function IntegrationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const integrations = useQuery({ queryKey: queryKeys.integrations.all(), queryFn: integrationsApi.list });
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: integrationsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() });
      toast('Интеграция удалена', 'success');
    }
  });

  return (
    <>
      <PageHeader
        title="Интеграции"
        subtitle="Подключения устройств и сервисов"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />Добавить
          </Button>
        }
      />

      {showCreate && (
        <CreateIntegrationCard
          onCreated={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() });
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {integrations.data?.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            expanded={expandedId === integration.id}
            onToggle={() => setExpandedId(expandedId === integration.id ? null : integration.id)}
            onRemove={() => remove.mutate(integration.id)}
            onUpdated={() => toast('Интеграция обновлена', 'success')}
          />
        ))}
      </div>

      {!integrations.data?.length ? (
        <EmptyState
          title="Интеграций пока нет"
          action={<span className="text-xs text-muted">Нажмите «Добавить» для подключения</span>}
        />
      ) : null}
    </>
  );
}

function CreateIntegrationCard({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('mqtt');
  const create = useMutation({ mutationFn: integrationsApi.create, onSuccess: onCreated });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({ name, domain });
  }

  return (
    <Card className="mb-4 border-primary">
      <form className="grid gap-3 md:grid-cols-3" onSubmit={submit}>
        <Input aria-label="Название" placeholder="Название интеграции" value={name} onChange={(e) => setName(e.target.value)} required />
        <Select aria-label="Домен" value={domain} onChange={(e) => setDomain(e.target.value)}>
          <option value="mqtt">MQTT</option>
          <option value="demo">Demo</option>
        </Select>
        <div className="flex flex-wrap justify-end gap-2">
          <PrimaryButton type="submit" disabled={create.isPending}>{create.isPending ? 'Создаю…' : 'Создать'}</PrimaryButton>
          <Button type="button" onClick={onCancel}>Отмена</Button>
        </div>
      </form>
      <p className="mt-3 text-sm text-muted">
        Для live demo рекомендуем MQTT: он подключает устройства к реальному потоку состояний и событий.
      </p>
    </Card>
  );
}

function IntegrationCard({
  integration,
  expanded,
  onToggle,
  onRemove,
  onUpdated,
}: {
  integration: Integration;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onUpdated: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [showMqttBuilder, setShowMqttBuilder] = useState(false);
  const [name, setName] = useState(integration.name);
  const [configText, setConfigText] = useState(JSON.stringify(integration.config, null, 2));

  useEffect(() => {
    setName(integration.name);
    setConfigText(JSON.stringify(integration.config, null, 2));
  }, [integration.config, integration.name]);

  const discovery = useQuery({
    queryKey: queryKeys.integrations.discovery(integration.id),
    queryFn: () => integrationsApi.discover(integration.id),
    enabled: expanded,
  });
  const update = useMutation({
    mutationFn: (payload: { name: string; config: Record<string, unknown> }) => integrationsApi.update(integration.id, payload),
    onSuccess: async () => {
      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.integrations.discovery(integration.id) });
      onUpdated();
    },
  });
  const importAll = useMutation({
    mutationFn: () => integrationsApi.import(integration.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() });
      await invalidateDeviceReadModels(queryClient);
      discovery.refetch();
    },
  });

  const DOMAIN_LABELS: Record<string, string> = { demo: 'Demo', mqtt: 'MQTT' };

  function submitUpdate() {
    let config: Record<string, unknown>;
    try {
      config = configText.trim() ? JSON.parse(configText) as Record<string, unknown> : {};
    } catch {
      toast('Конфигурация должна быть валидным JSON', 'error');
      return;
    }
    update.mutate({ name, config });
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{integration.name}</div>
          <div className="mt-1 text-xs text-muted">
            <Badge>{DOMAIN_LABELS[integration.domain] ?? integration.domain}</Badge>
            <span className="ml-2">{integration.device_count} устройств</span>
          </div>
          <div className="mt-1 text-xs text-muted">Создана: {formatDateTime(integration.created_at)}</div>
        </div>
        <div className="flex gap-2">
          {integration.domain === 'mqtt' ? (
            <Button onClick={() => setShowMqttBuilder((value) => !value)}>
              <Plus className="h-4 w-4" />
              {showMqttBuilder ? 'Скрыть MQTT' : 'Добавить MQTT устройство'}
            </Button>
          ) : null}
          <Button onClick={() => setIsEditing((value) => !value)}>
            <Pencil className="h-4 w-4" />
            {isEditing ? 'Скрыть форму' : 'Редактировать'}
          </Button>
          <Button onClick={onToggle}>
            <Search className="h-4 w-4" />
            {expanded ? 'Скрыть' : 'Обнаружение'}
          </Button>
          <Button className="text-danger hover:bg-red-50" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isEditing ? (
        <div className="mt-4 grid gap-3 border-t border-line pt-4">
          <Input aria-label="Название интеграции" value={name} onChange={(event) => setName(event.target.value)} />
          <Textarea aria-label="Конфигурация интеграции JSON" value={configText} onChange={(event) => setConfigText(event.target.value)} />
          <div className="flex gap-2">
            <PrimaryButton disabled={update.isPending} onClick={submitUpdate}>
              {update.isPending ? 'Сохраняю…' : 'Сохранить'}
            </PrimaryButton>
            <Button
              onClick={() => {
                setName(integration.name);
                setConfigText(JSON.stringify(integration.config, null, 2));
                setIsEditing(false);
              }}
            >
              Отмена
            </Button>
          </div>
        </div>
      ) : null}

      {showMqttBuilder ? (
        <MqttDeviceBuilder
          integrationId={integration.id}
          onCreated={() => {
            setShowMqttBuilder(false);
            toast('MQTT устройство создано', 'success');
          }}
        />
      ) : null}

      {expanded && (
        <div className="mt-4 border-t border-line pt-4">
          {discovery.isLoading ? (
            <div className="text-sm text-muted">Поиск устройств…</div>
          ) : discovery.isError ? (
            <div className="text-sm text-danger">Ошибка обнаружения</div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Обнаруженные устройства ({discovery.data?.length ?? 0})</h3>
                {discovery.data?.length ? (
                  <PrimaryButton
                    disabled={importAll.isPending}
                    onClick={() => importAll.mutate()}
                  >
                    <Download className="h-4 w-4" />
                    {importAll.isPending ? 'Импорт…' : 'Импортировать все'}
                  </PrimaryButton>
                ) : null}
              </div>
              <div className="space-y-2">
                {discovery.data?.map((device) => (
                  <DiscoveredDeviceRow
                    key={device.discovered_id}
                    device={device}
                    integrationId={integration.id}
                    onImported={async () => {
                      discovery.refetch();
                      await invalidateDeviceReadModels(queryClient);
                    }}
                  />
                ))}
              </div>
              {importAll.data ? (
                <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800">
                  Импортировано: {importAll.data.imported} устройств
                  {importAll.data.skipped.length ? `, пропущено: ${importAll.data.skipped.length}` : ''}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function MqttDeviceBuilder({
  integrationId,
  onCreated,
}: {
  integrationId: string;
  onCreated: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const areas = useQuery({ queryKey: queryKeys.areas.all(), queryFn: areasApi.list });
  const [deviceName, setDeviceName] = useState('Presentation Lamp');
  const [deviceType, setDeviceType] = useState('light');
  const [areaId, setAreaId] = useState('');
  const [manufacturer, setManufacturer] = useState('homeIQ');
  const [model, setModel] = useState('MQTT-1');
  const [entities, setEntities] = useState<MqttEntityDraft[]>(() => [defaultMqttEntity('light', 'Presentation Lamp')]);

  const create = useMutation({
    mutationFn: (payload: MqttDeviceCreate) => integrationsApi.createMqttDevice(integrationId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.integrations.discovery(integrationId) }),
        invalidateDeviceReadModels(queryClient),
      ]);
      onCreated();
    },
  });

  function updateEntity(rowId: string, patch: Partial<MqttEntityDraft>) {
    setEntities((items) => items.map((item) => (item.row_id === rowId ? { ...item, ...patch } : item)));
  }

  function refillDefaults() {
    setEntities([defaultMqttEntity(deviceType, deviceName)]);
  }

  function addEntity() {
    setEntities((items) => [...items, defaultMqttEntity(deviceType === 'energy_meter' ? 'sensor' : deviceType, deviceName)]);
  }

  function buildPayload(): MqttDeviceCreate | null {
    if (!deviceName.trim()) {
      toast('Название MQTT устройства обязательно', 'error');
      return null;
    }
    if (!entities.length) {
      toast('Добавьте минимум один MQTT объект', 'error');
      return null;
    }

    const parsedEntities = entities.map((entity) => {
      if (!entity.entity_id.trim() || !entity.name.trim() || !entity.state_topic.trim()) {
        throw new Error('Заполните entity_id, имя и state topic для каждого объекта');
      }
      if (CONTROLLABLE_DOMAINS.has(entity.domain) && !entity.command_topic?.trim()) {
        throw new Error(`Для ${entity.entity_id} нужен command topic`);
      }
      let attributes: Record<string, unknown>;
      try {
        attributes = entity.attributes_text.trim() ? JSON.parse(entity.attributes_text) as Record<string, unknown> : {};
      } catch {
        throw new Error(`Атрибуты ${entity.entity_id} должны быть валидным JSON`);
      }
      return {
        entity_id: entity.entity_id.trim(),
        domain: entity.domain,
        name: entity.name.trim(),
        state: entity.state?.trim() || 'unknown',
        state_topic: entity.state_topic.trim(),
        command_topic: entity.command_topic?.trim() || null,
        availability_topic: entity.availability_topic?.trim() || null,
        unit_of_measurement: entity.unit_of_measurement?.trim() || null,
        device_class: entity.device_class?.trim() || null,
        attributes,
        brightness_state_topic: entity.brightness_state_topic?.trim() || null,
        brightness_command_topic: entity.brightness_command_topic?.trim() || null,
      };
    });

    return {
      name: deviceName.trim(),
      type: deviceType,
      area_id: areaId || null,
      manufacturer: manufacturer.trim() || null,
      model: model.trim() || null,
      status: 'online',
      entities: parsedEntities,
    };
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const payload = buildPayload();
      if (payload) create.mutate(payload);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Проверьте MQTT форму', 'error');
    }
  }

  return (
    <div className="mt-4 rounded-md border border-line bg-panel p-3">
      <form className="grid gap-4" onSubmit={submit}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold">MQTT конструктор устройства</h3>
            <p className="text-xs text-muted">Создает устройство, entities и подписки на произвольные topics</p>
          </div>
          <Button type="button" onClick={refillDefaults}>Заполнить topics</Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Input aria-label="MQTT устройство" placeholder="Название устройства" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} required />
          <Select aria-label="Тип MQTT устройства" value={deviceType} onChange={(event) => setDeviceType(event.target.value)}>
            {DEVICE_TYPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
          <Select aria-label="Зона MQTT устройства" value={areaId} onChange={(event) => setAreaId(event.target.value)}>
            <option value="">Без зоны</option>
            {areas.data?.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
          </Select>
          <Input aria-label="Производитель MQTT" placeholder="Производитель" value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} />
          <Input aria-label="Модель MQTT" placeholder="Модель" value={model} onChange={(event) => setModel(event.target.value)} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-xs font-semibold uppercase text-muted">Entities</h4>
            <Button type="button" onClick={addEntity}><Plus className="h-4 w-4" />Добавить entity</Button>
          </div>
          {entities.map((entity, index) => (
            <div key={entity.row_id} className="grid gap-3 rounded-md border border-line bg-surface p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Entity {index + 1}</span>
                <Button
                  type="button"
                  className="text-danger hover:bg-red-50"
                  disabled={entities.length === 1}
                  onClick={() => setEntities((items) => items.filter((item) => item.row_id !== entity.row_id))}
                >
                  <Trash2 className="h-4 w-4" />
                  Удалить
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Input aria-label={`entity_id ${index + 1}`} value={entity.entity_id} onChange={(event) => updateEntity(entity.row_id, { entity_id: event.target.value })} />
                <Select aria-label={`domain ${index + 1}`} value={entity.domain} onChange={(event) => updateEntity(entity.row_id, { domain: event.target.value })}>
                  {ENTITY_DOMAIN_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
                <Input aria-label={`entity name ${index + 1}`} value={entity.name} onChange={(event) => updateEntity(entity.row_id, { name: event.target.value })} />
                <Input aria-label={`initial state ${index + 1}`} value={entity.state ?? ''} onChange={(event) => updateEntity(entity.row_id, { state: event.target.value })} />
                <Input aria-label={`unit ${index + 1}`} placeholder="unit" value={entity.unit_of_measurement ?? ''} onChange={(event) => updateEntity(entity.row_id, { unit_of_measurement: event.target.value || null })} />
                <Input aria-label={`device class ${index + 1}`} placeholder="device_class" value={entity.device_class ?? ''} onChange={(event) => updateEntity(entity.row_id, { device_class: event.target.value || null })} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input aria-label={`state topic ${index + 1}`} value={entity.state_topic} onChange={(event) => updateEntity(entity.row_id, { state_topic: event.target.value })} />
                <Input aria-label={`command topic ${index + 1}`} placeholder="command topic" value={entity.command_topic ?? ''} onChange={(event) => updateEntity(entity.row_id, { command_topic: event.target.value || null })} />
                <Input aria-label={`availability topic ${index + 1}`} placeholder="availability topic" value={entity.availability_topic ?? ''} onChange={(event) => updateEntity(entity.row_id, { availability_topic: event.target.value || null })} />
                <Input aria-label={`brightness state topic ${index + 1}`} placeholder="brightness state topic" value={entity.brightness_state_topic ?? ''} onChange={(event) => updateEntity(entity.row_id, { brightness_state_topic: event.target.value || null })} />
                <Input aria-label={`brightness command topic ${index + 1}`} placeholder="brightness command topic" value={entity.brightness_command_topic ?? ''} onChange={(event) => updateEntity(entity.row_id, { brightness_command_topic: event.target.value || null })} />
              </div>
              <Textarea aria-label={`attributes ${index + 1}`} value={entity.attributes_text} onChange={(event) => updateEntity(entity.row_id, { attributes_text: event.target.value })} />
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <PrimaryButton disabled={create.isPending}>{create.isPending ? 'Создаю…' : 'Создать MQTT устройство'}</PrimaryButton>
        </div>
      </form>
    </div>
  );
}

function DiscoveredDeviceRow({
  device,
  integrationId,
  onImported,
}: {
  device: DiscoveredDevice;
  integrationId: string;
  onImported: () => void;
}) {
  const importOne = useMutation({
    mutationFn: () => integrationsApi.import(integrationId, [device.discovered_id]),
    onSuccess: onImported,
  });

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-line p-3">
      <div>
        <div className="text-sm font-medium">{device.name}</div>
        <div className="text-xs text-muted">
          {device.type} · {device.manufacturer} {device.model} · {device.entities.length} entities
        </div>
      </div>
      {device.already_imported ? (
        <Badge tone="success">Импортировано</Badge>
      ) : (
        <Button disabled={importOne.isPending} onClick={() => importOne.mutate()}>
          <Link2 className="h-4 w-4" />
          {importOne.isPending ? '…' : 'Импорт'}
        </Button>
      )}
    </div>
  );
}
