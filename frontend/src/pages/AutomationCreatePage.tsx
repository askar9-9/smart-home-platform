import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { automationsApi } from '../api';
import { AutomationForm } from '../components/AutomationForm';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';
import { queryKeys } from '../shared/queryKeys';

export function AutomationCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const create = useMutation({
    mutationFn: automationsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      toast('Сценарий создан', 'success');
      navigate('/automations');
    }
  });

  return (
    <>
      <PageHeader title="Новый сценарий" subtitle="Автоматически выполняется при изменении состояния объекта" />
      <AutomationForm submitLabel="Создать сценарий" pending={create.isPending} onSubmit={(values) => create.mutateAsync(values)} />
    </>
  );
}
