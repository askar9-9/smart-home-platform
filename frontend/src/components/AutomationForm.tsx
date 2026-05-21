import { FormEvent, useEffect, useState } from 'react';
import type { Automation } from '../api/types';
import { useEntitiesList } from '../features/entities/hooks';
import { useToast } from './Toast';
import { Card, Input, PrimaryButton, Select, Textarea } from './ui';

export interface AutomationFormValues {
  name: string;
  description: string;
  is_enabled: boolean;
  mode: string;
  trigger: { type: string; entity_id: string; to?: string };
  condition: { entity_id: string; operator: string; value: string | number } | null;
  action: Automation['action'];
}

function toJsonText(value: Record<string, unknown> | undefined) {
  return value && Object.keys(value).length ? JSON.stringify(value, null, 2) : '';
}

function defaultValues(initialValue?: Partial<Automation>): AutomationFormValues {
  return {
    name: initialValue?.name ?? '',
    description: initialValue?.description ?? '',
    is_enabled: initialValue?.is_enabled ?? true,
    mode: initialValue?.mode ?? 'single',
    trigger: {
      type: initialValue?.trigger?.type ?? 'state_changed',
      entity_id: initialValue?.trigger?.entity_id ?? '',
      to: initialValue?.trigger?.to ?? 'on',
    },
    condition: initialValue?.condition
      ? {
          entity_id: initialValue.condition.entity_id,
          operator: initialValue.condition.operator,
          value: initialValue.condition.value,
        }
      : null,
    action: {
      domain: initialValue?.action?.domain ?? 'light',
      action: initialValue?.action?.action ?? 'turn_on',
      target: { entity_id: initialValue?.action?.target?.entity_id ?? '' },
      data: initialValue?.action?.data,
    },
  };
}

export function AutomationForm({
  initialValue,
  submitLabel,
  pending = false,
  onSubmit,
}: {
  initialValue?: Partial<Automation>;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (values: AutomationFormValues) => Promise<unknown> | void;
}) {
  const { toast } = useToast();
  const entities = useEntitiesList();
  const entityItems = entities.data?.entities ?? [];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [mode, setMode] = useState('single');
  const [triggerEntity, setTriggerEntity] = useState('');
  const [toState, setToState] = useState('on');
  const [conditionEntity, setConditionEntity] = useState('');
  const [operator, setOperator] = useState('lt');
  const [conditionValue, setConditionValue] = useState('');
  const [domain, setDomain] = useState('light');
  const [action, setAction] = useState('turn_on');
  const [targetEntity, setTargetEntity] = useState('');
  const [actionData, setActionData] = useState('');

  useEffect(() => {
    const values = defaultValues(initialValue);
    setName(values.name);
    setDescription(values.description);
    setIsEnabled(values.is_enabled);
    setMode(values.mode);
    setTriggerEntity(values.trigger.entity_id);
    setToState(values.trigger.to ?? '');
    setConditionEntity(values.condition?.entity_id ?? '');
    setOperator(values.condition?.operator ?? 'lt');
    setConditionValue(values.condition ? String(values.condition.value) : '');
    setDomain(values.action.domain);
    setAction(values.action.action);
    setTargetEntity(values.action.target.entity_id);
    setActionData(toJsonText(values.action.data));
  }, [initialValue]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    let parsedActionData: Record<string, unknown> | undefined;
    if (actionData.trim()) {
      try {
        parsedActionData = JSON.parse(actionData) as Record<string, unknown>;
      } catch {
        toast('Данные действия должны быть валидным JSON', 'error');
        return;
      }
    }
    const normalizedConditionValue =
      conditionValue.trim() !== '' && !Number.isNaN(Number(conditionValue)) ? Number(conditionValue) : conditionValue;

    await onSubmit({
      name,
      description,
      is_enabled: isEnabled,
      mode,
      trigger: { type: 'state_changed', entity_id: triggerEntity, to: toState || undefined },
      condition: conditionEntity
        ? { entity_id: conditionEntity, operator, value: normalizedConditionValue }
        : null,
      action: {
        domain,
        action,
        target: { entity_id: targetEntity },
        data: parsedActionData,
      },
    });
  }

  return (
    <Card>
      <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <Input aria-label="Название" placeholder="Название" value={name} onChange={(event) => setName(event.target.value)} required />
        <Textarea aria-label="Описание" placeholder="Описание сценария" value={description} onChange={(event) => setDescription(event.target.value)} />
        <div className="grid gap-3 md:grid-cols-2">
          <Select aria-label="Статус автоматизации" value={isEnabled ? 'enabled' : 'disabled'} onChange={(event) => setIsEnabled(event.target.value === 'enabled')}>
            <option value="enabled">Включена</option>
            <option value="disabled">Отключена</option>
          </Select>
          <Select aria-label="Режим" value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="single">Single</option>
            <option value="restart">Restart</option>
            <option value="queued">Queued</option>
            <option value="parallel">Parallel</option>
          </Select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Select aria-label="Объект-триггер" value={triggerEntity} onChange={(event) => setTriggerEntity(event.target.value)} required>
            <option value="">Выберите объект-триггер</option>
            {entityItems.map((entity) => <option key={entity.entity_id} value={entity.entity_id}>{entity.entity_id}</option>)}
          </Select>
          <Input aria-label="Целевое состояние триггера" placeholder="состояние" value={toState} onChange={(event) => setToState(event.target.value)} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Select aria-label="Объект условия" value={conditionEntity} onChange={(event) => setConditionEntity(event.target.value)}>
            <option value="">Без условия</option>
            {entityItems.map((entity) => <option key={entity.entity_id} value={entity.entity_id}>{entity.entity_id}</option>)}
          </Select>
          <Select aria-label="Оператор" value={operator} onChange={(event) => setOperator(event.target.value)}>
            <option value="lt">{'< меньше'}</option>
            <option value="lte">{'≤ меньше или равно'}</option>
            <option value="eq">{'= равно'}</option>
            <option value="gte">{'≥ больше или равно'}</option>
            <option value="gt">{'> больше'}</option>
          </Select>
          <Input aria-label="Значение условия" placeholder="значение" value={conditionValue} onChange={(event) => setConditionValue(event.target.value)} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Select aria-label="Домен действия" value={domain} onChange={(event) => setDomain(event.target.value)}>
            <option value="light">Свет</option>
            <option value="switch">Выключатель</option>
            <option value="climate">Климат</option>
          </Select>
          <Select aria-label="Действие" value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="turn_on">Включить</option>
            <option value="turn_off">Выключить</option>
            <option value="toggle">Переключить</option>
            <option value="set_temperature">Установить температуру</option>
            <option value="set_mode">Установить режим</option>
          </Select>
          <Select aria-label="Целевой объект" value={targetEntity} onChange={(event) => setTargetEntity(event.target.value)} required>
            <option value="">Выберите целевой объект</option>
            {entityItems.map((entity) => <option key={entity.entity_id} value={entity.entity_id}>{entity.entity_id}</option>)}
          </Select>
        </div>
        <Textarea
          aria-label="Данные действия JSON"
          placeholder='{"brightness": 80}'
          value={actionData}
          onChange={(event) => setActionData(event.target.value)}
        />
        <PrimaryButton disabled={pending}>{pending ? 'Сохраняю…' : submitLabel}</PrimaryButton>
      </form>
    </Card>
  );
}
