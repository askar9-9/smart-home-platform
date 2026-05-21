import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { areasApi } from '../api';
import { Button, Card, EmptyState, Input, PrimaryButton } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';
import { queryKeys } from '../shared/queryKeys';

export function AreasPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const areas = useQuery({ queryKey: queryKeys.areas.all(), queryFn: areasApi.list });
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('mdi:home');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: areasApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.areas.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      setFormOpen(false);
      setName('');
      toast('Зона создана', 'success');
    }
  });

  const update = useMutation({
    mutationFn: ({ id, name, icon }: { id: string; name: string; icon?: string | null }) =>
      areasApi.update(id, { name, icon }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.areas.all() });
      setEditingId(null);
      toast('Зона обновлена', 'success');
    }
  });

  const remove = useMutation({
    mutationFn: areasApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.areas.all() });
      setDeleteConfirmId(null);
      setEditingId(null);
      toast('Зона удалена', 'success');
    }
  });

  function openEdit(id: string, currentName: string, currentIcon: string) {
    setEditingId(id);
    setEditName(currentName);
    setEditIcon(currentIcon);
    setDeleteConfirmId(null);
  }

  function closeEdit() {
    setEditingId(null);
    setDeleteConfirmId(null);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate({ name, icon, floor_id: null });
  }

  return (
    <>
      <PageHeader
        title="Зоны"
        subtitle="Комнаты и помещения"
        actions={
          <Button onClick={() => setFormOpen((v) => !v)}>
            <Plus className="h-4 w-4" />Создать
          </Button>
        }
      />

      {formOpen ? (
        <Card className="mb-4">
          <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={submit}>
            <Input
              aria-label="Название зоны"
              placeholder="Например: Гостиная"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              aria-label="Иконка (mdi:...)"
              placeholder="mdi:sofa (необязательно)"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
            />
            <PrimaryButton disabled={create.isPending}>
              <Save className="h-4 w-4" />{create.isPending ? 'Сохраняю…' : 'Сохранить'}
            </PrimaryButton>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {areas.data?.map((area) => (
          <Card key={area.id}>
            <div className="flex items-start justify-between gap-3">
              <Link to={`/areas/${area.id}`} className="block min-w-0">
                <div className="text-base font-semibold">{area.name}</div>
                <div className="mt-1 text-xs text-muted">
                  {area.icon ?? 'mdi:home'} · {area.device_count ?? 0} устр. · {area.entity_count ?? 0} объект.
                </div>
              </Link>
              <Button
                className="shrink-0"
                aria-label={editingId === area.id ? `Закрыть редактирование ${area.name}` : `Редактировать ${area.name}`}
                onClick={() =>
                  editingId === area.id ? closeEdit() : openEdit(area.id, area.name, area.icon ?? '')
                }
              >
                {editingId === area.id ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              </Button>
            </div>

            {editingId === area.id ? (
              <div className="mt-4 space-y-2">
                {deleteConfirmId === area.id ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3">
                    <p className="mb-3 text-sm font-medium text-danger">
                      Удалить зону «{area.name}»?
                    </p>
                    <p className="mb-3 text-xs text-muted">Устройства в этой зоне не удалятся.</p>
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={() => setDeleteConfirmId(null)}>Отмена</Button>
                      <Button
                        className="flex-1 border-danger text-danger hover:bg-red-50"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(area.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {remove.isPending ? 'Удаляю…' : 'Удалить зону'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Input aria-label={`Название ${area.name}`} value={editName} onChange={(e) => setEditName(e.target.value)} />
                      <Input aria-label={`Иконка ${area.name}`} value={editIcon} onChange={(e) => setEditIcon(e.target.value)} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Button className="text-danger hover:bg-red-50" aria-label={`Удалить ${area.name}`} onClick={() => setDeleteConfirmId(area.id)}>
                        <Trash2 className="h-4 w-4" />Удалить
                      </Button>
                      <div className="flex gap-2">
                        <Button onClick={closeEdit}>Отмена</Button>
                        <PrimaryButton disabled={update.isPending || !editName.trim()} onClick={() => update.mutate({ id: area.id, name: editName.trim(), icon: editIcon || null })}>
                          <Save className="h-4 w-4" />{update.isPending ? 'Сохраняю…' : 'Сохранить'}
                        </PrimaryButton>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      {!areas.data?.length ? <EmptyState title="Зон пока нет" action={<span className="text-xs text-muted">Нажмите «Создать», чтобы добавить первую зону</span>} /> : null}
    </>
  );
}
