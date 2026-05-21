import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEntitiesList } from '../features/entities/hooks';
import { Badge, Card, Select } from '../components/ui';
import { EntityControl } from '../components/EntityControl';
import { PageHeader } from '../components/PageHeader';
import { formatDateTime } from '../utils/format';

export function EntitiesPage() {
  const [domain, setDomain] = useState('');
  const entities = useEntitiesList(domain ? { domain } : undefined);
  const items = entities.data?.entities ?? [];

  return (
    <>
      <PageHeader
        title="Объекты"
        subtitle="Текущие состояния и управление"
        actions={
          <Select aria-label="Тип" value={domain} onChange={(event) => setDomain(event.target.value)}>
            <option value="">Все типы</option>
            {[
              { value: 'light', label: 'Освещение' },
              { value: 'switch', label: 'Выключатели' },
              { value: 'sensor', label: 'Датчики' },
              { value: 'binary_sensor', label: 'Бинарные датчики' },
              { value: 'climate', label: 'Климат' },
              { value: 'energy_meter', label: 'Счётчик энергии' },
            ].map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((entity) => (
          <div key={entity.entity_id} className="space-y-2">
            <EntityControl entity={entity} />
            <Card className="p-3">
              <div className="flex items-center justify-between gap-3 text-xs text-muted">
                <Link className="truncate text-primary" to={`/entities/${encodeURIComponent(entity.entity_id)}`}>
                  История состояний
                </Link>
                <Badge>{formatDateTime(entity.last_updated)}</Badge>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </>
  );
}
