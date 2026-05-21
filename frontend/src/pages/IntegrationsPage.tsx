import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Link2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { integrationsApi } from '../api';
import type { DiscoveredDevice, Integration } from '../api/types';
import { Badge, Button, Card, EmptyState, Input, PrimaryButton, Select, Textarea } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';
import { invalidateDeviceReadModels } from '../shared/queryInvalidation';
import { queryKeys } from '../shared/queryKeys';
import { formatDateTime } from '../utils/format';

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
  const [domain, setDomain] = useState('demo');
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
          <option value="demo">Demo</option>
          <option value="mqtt">MQTT</option>
        </Select>
        <div className="flex gap-2">
          <PrimaryButton type="submit" disabled={create.isPending}>{create.isPending ? 'Создаю…' : 'Создать'}</PrimaryButton>
          <Button type="button" onClick={onCancel}>Отмена</Button>
        </div>
      </form>
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
