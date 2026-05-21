import { FormEvent, useEffect, useState } from 'react';
import type { Area, Device } from '../api/types';
import { Button, Input, PrimaryButton, Select } from './ui';

export interface DeviceFormValues {
  name: string;
  type: string;
  area_id: string | null;
  manufacturer: string | null;
  model: string | null;
  name_by_user?: string | null;
  status?: string;
}

function normalize(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function DeviceForm({
  areas,
  initialValue,
  mode,
  pending = false,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  areas: Area[];
  initialValue?: Partial<Device>;
  mode: 'create' | 'edit';
  pending?: boolean;
  submitLabel: string;
  onSubmit: (values: DeviceFormValues) => Promise<unknown> | void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('light');
  const [areaId, setAreaId] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [nameByUser, setNameByUser] = useState('');
  const [status, setStatus] = useState('online');

  useEffect(() => {
    setName(initialValue?.name ?? '');
    setType(initialValue?.type ?? 'light');
    setAreaId(initialValue?.area_id ?? '');
    setManufacturer(initialValue?.manufacturer ?? '');
    setModel(initialValue?.model ?? '');
    setNameByUser(initialValue?.name_by_user ?? '');
    setStatus(initialValue?.status ?? 'online');
  }, [initialValue]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit({
      name,
      type,
      area_id: areaId || null,
      manufacturer: normalize(manufacturer),
      model: normalize(model),
      ...(mode === 'edit' ? { name_by_user: normalize(nameByUser), status } : {}),
    });
  }

  return (
    <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-3 md:grid-cols-2">
        <Input aria-label="Название устройства" placeholder="Название устройства" value={name} onChange={(event) => setName(event.target.value)} required />
        <Select aria-label="Тип устройства" value={type} onChange={(event) => setType(event.target.value)} disabled={mode === 'edit'}>
          <option value="light">Свет</option>
          <option value="switch">Выключатель</option>
          <option value="sensor">Датчик</option>
          <option value="climate">Климат</option>
          <option value="energy_meter">Счётчик энергии</option>
        </Select>
      </div>
      {mode === 'edit' ? (
        <Input aria-label="Пользовательское имя" placeholder="Пользовательское имя" value={nameByUser} onChange={(event) => setNameByUser(event.target.value)} />
      ) : null}
      <div className="grid gap-3 md:grid-cols-3">
        <Select aria-label="Зона устройства" value={areaId} onChange={(event) => setAreaId(event.target.value)}>
          <option value="">Без зоны</option>
          {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
        </Select>
        <Input aria-label="Производитель" placeholder="Производитель" value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} />
        <Input aria-label="Модель" placeholder="Модель" value={model} onChange={(event) => setModel(event.target.value)} />
      </div>
      {mode === 'edit' ? (
        <Select aria-label="Статус устройства" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="online">В сети</option>
          <option value="offline">Нет связи</option>
        </Select>
      ) : null}
      <div className="flex gap-2">
        <PrimaryButton disabled={pending}>{pending ? 'Сохраняю…' : submitLabel}</PrimaryButton>
        {onCancel ? <Button type="button" onClick={onCancel}>Отмена</Button> : null}
      </div>
    </form>
  );
}
