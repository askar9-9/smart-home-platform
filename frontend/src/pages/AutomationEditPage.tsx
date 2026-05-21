import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { automationsApi } from '../api';
import { AutomationForm } from '../components/AutomationForm';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';
import { queryKeys } from '../shared/queryKeys';

export function AutomationEditPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const automation = useQuery({
    queryKey: queryKeys.automations.detail(id),
    queryFn: () => automationsApi.get(id),
    enabled: Boolean(id),
  });

  const update = useMutation({
    mutationFn: (payload: Parameters<typeof automationsApi.update>[1]) => automationsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      toast('Сценарий обновлён', 'success');
      navigate('/automations');
    },
  });

  return (
    <>
      <PageHeader title="Редактирование сценария" subtitle="Обновите параметры автоматизации" />
      {automation.data ? (
        <AutomationForm
          initialValue={automation.data}
          submitLabel="Сохранить изменения"
          pending={update.isPending}
          onSubmit={(values) => update.mutateAsync(values)}
        />
      ) : null}
    </>
  );
}
