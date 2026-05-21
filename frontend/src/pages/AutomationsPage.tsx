import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Play, Plus, Power, Trash2 } from 'lucide-react';
import { automationsApi } from '../api';
import type { Automation } from '../api/types';
import { Badge, Button, Card } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { formatDateTime } from '../utils/format';
import { useToast } from '../components/Toast';
import { queryKeys } from '../shared/queryKeys';

export function AutomationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const automations = useQuery({ queryKey: queryKeys.automations.list(), queryFn: () => automationsApi.list() });
  const items = automations.data?.automations ?? [];
  const toggle = useMutation({
    mutationFn: ({ id, is_enabled }: { id: string; is_enabled: boolean }) => automationsApi.update(id, { is_enabled }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      toast(variables.is_enabled ? 'Автоматизация включена' : 'Автоматизация отключена', 'success');
    }
  });
  const run = useMutation({
    mutationFn: automationsApi.run,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all() });
      toast('Автоматизация запущена', 'success');
    }
  });
  const remove = useMutation({
    mutationFn: automationsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all() });
      toast('Автоматизация удалена', 'success');
    }
  });

  return (
    <>
      <PageHeader title="Автоматизации" subtitle="Сценарии автоматизации" actions={<Link to="/automations/new"><Button><Plus className="h-4 w-4" />Создать</Button></Link>} />
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((automation: Automation) => (
          <Card key={automation.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{automation.name}</div>
                <div className="mt-1 text-xs text-muted">{automation.trigger.entity_id} → {automation.trigger.to ?? 'любое'} · {automation.action.domain}.{automation.action.action}</div>
              </div>
              <Badge tone={automation.is_enabled ? 'success' : 'neutral'}>{automation.is_enabled ? 'Активна' : 'Отключена'}</Badge>
            </div>
            <div className="mt-4 text-xs text-muted">Последний запуск: {formatDateTime(automation.last_triggered) ?? 'Ещё не запускалась'}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/automations/${automation.id}/edit`}>
                <Button><Pencil className="h-4 w-4" />Редактировать</Button>
              </Link>
              <Button onClick={() => toggle.mutate({ id: automation.id, is_enabled: !automation.is_enabled })}><Power className="h-4 w-4" />Переключить</Button>
              <Button onClick={() => run.mutate(automation.id)}><Play className="h-4 w-4" />Запустить</Button>
              <Button
                className="ml-auto border-red-200 bg-red-50 text-danger hover:bg-red-100"
                onClick={() => {
                  if (window.confirm(`Удалить автоматизацию «${automation.name}»?`)) remove.mutate(automation.id);
                }}
              >
                <Trash2 className="h-4 w-4" />Удалить
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
