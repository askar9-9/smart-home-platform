import { Minus, Plus, Power } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Entity } from '../api/types';
import { useEntityAction } from '../features/entities/hooks';
import { Badge, Button, Card } from './ui';

function numberAttr(attributes: Record<string, unknown>, key: string, fallback: number) {
  const value = attributes[key];
  return typeof value === 'number' ? value : fallback;
}

function modeAttr(entity: Entity) {
  const value = entity.attributes.hvac_mode ?? entity.attributes.mode ?? entity.state;
  return typeof value === 'string' ? value : 'off';
}

const STATE_LABELS: Record<string, string> = {
  on: 'Включено',
  off: 'Выключено',
  unavailable: 'Недоступно',
  unknown: 'Неизвестно',
};

function stateLabel(state: string): string {
  return STATE_LABELS[state] ?? state;
}

export function EntityControl({ entity, compact = false }: { entity: Entity; compact?: boolean }) {
  const mutation = useEntityAction();

  const disabled = mutation.isPending || entity.state === 'unavailable';
  const name = entity.name || String(entity.attributes.friendly_name ?? entity.entity_id);

  const call = (action: string, data?: Record<string, unknown>) =>
    mutation.mutate({ domain: entity.domain, action, target: { entity_id: entity.entity_id }, data });

  if (entity.domain === 'light') {
    const brightness = numberAttr(entity.attributes, 'brightness', entity.state === 'on' ? 100 : 0);
    return (
      <ControlFrame entity={entity} compact={compact} title={name}>
        <div className="flex items-center justify-between gap-3">
          <Badge tone={entity.state === 'on' ? 'success' : 'neutral'}>{stateLabel(entity.state)}</Badge>
          <Button aria-label={`Переключить ${name}`} disabled={disabled} onClick={() => call(entity.state === 'on' ? 'turn_off' : 'turn_on')}>
            <Power className="h-4 w-4" />
          </Button>
        </div>
        <label className="mt-3 block text-xs text-muted">
          Яркость: {brightness}%
          <div className="flex items-center py-3">
          <input
            aria-label={`Яркость ${name}`}
            className="w-full accent-primary"
            type="range"
            min="0"
            max="100"
            value={brightness}
            disabled={disabled}
            onChange={(event) => {
              const value = Number(event.target.value);
              call(value === 0 ? 'turn_off' : 'turn_on', value === 0 ? undefined : { brightness: value });
            }}
          />
          </div>
        </label>
      </ControlFrame>
    );
  }

  if (entity.domain === 'switch') {
    return (
      <ControlFrame entity={entity} compact={compact} title={name}>
        <div className="flex items-center justify-between">
          <Badge tone={entity.state === 'on' ? 'success' : 'neutral'}>{stateLabel(entity.state)}</Badge>
          <Button aria-label={`Переключить ${name}`} disabled={disabled} onClick={() => call(entity.state === 'on' ? 'turn_off' : 'turn_on')}>
            <Power className="h-4 w-4" />
          </Button>
        </div>
      </ControlFrame>
    );
  }

  if (entity.domain === 'climate') {
    const current = numberAttr(entity.attributes, 'current_temperature', Number(entity.state) || 0);
    const target = numberAttr(entity.attributes, 'temperature', numberAttr(entity.attributes, 'target_temperature', 22));
    const mode = modeAttr(entity);
    return (
      <ControlFrame entity={entity} compact={compact} title={name}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Текущая</span>
          <strong>{current} °C</strong>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Button aria-label={`Уменьшить цель ${name}`} disabled={disabled} onClick={() => call('set_temperature', { temperature: target - 1 })}>
            <Minus className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <div className="text-xs text-muted">Целевая</div>
            <div className="text-xl font-semibold">{target} °C</div>
          </div>
          <Button aria-label={`Увеличить цель ${name}`} disabled={disabled} onClick={() => call('set_temperature', { temperature: target + 1 })}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-4 rounded-md border border-line p-1">
          {(['heat', 'cool', 'auto', 'off'] as const).map((option) => {
            const labels: Record<string, string> = { heat: 'Обогрев', cool: 'Охлаждение', auto: 'Авто', off: 'Выкл' };
            return (
            <button
              key={option}
              disabled={disabled}
              className={`rounded px-2 py-1 text-xs ${mode === option ? 'bg-primary text-white' : 'text-muted hover:bg-panel'}`}
              onClick={() => call('set_mode', { hvac_mode: option })}
            >
              {labels[option]}
            </button>
            );
          })}
        </div>
      </ControlFrame>
    );
  }

  const value = `${entity.state}${entity.unit_of_measurement ? ` ${entity.unit_of_measurement}` : ''}`;
  return (
    <ControlFrame entity={entity} compact={compact} title={name}>
      <div className="flex items-end justify-between gap-3">
        <div className="text-2xl font-semibold">{value}</div>
        <Badge>{entity.domain === 'energy_meter' ? 'Только чтение' : entity.device_class ?? 'Датчик'}</Badge>
      </div>
      {entity.domain === 'energy_meter' ? (
        <div className="mt-2 text-xs text-muted">
          За сегодня: {String(entity.attributes.today_kwh ?? entity.attributes.energy_today_kwh ?? '0')} кВт·ч
        </div>
      ) : null}
    </ControlFrame>
  );
}

function ControlFrame({ children, entity, title, compact }: { children: ReactNode; entity: Entity; title: string; compact: boolean }) {
  return (
    <Card className={compact ? 'p-3' : ''}>
      <div className="mb-3 min-w-0">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="truncate text-xs text-muted">{entity.entity_id}</div>
      </div>
      {children}
    </Card>
  );
}
