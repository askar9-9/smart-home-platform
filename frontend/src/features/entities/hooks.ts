import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Entity } from '../../api/types';
import { entitiesApi } from './api';
import { queryKeys, type EntitiesListParams, type EntityHistoryParams } from '../../shared/queryKeys';
import { invalidateEntityReadModels } from '../../shared/queryInvalidation';
import { applyOptimisticEntityActionToCache } from './cache';

export function useEntitiesList(params?: EntitiesListParams) {
  return useQuery({
    queryKey: queryKeys.entities.list(params),
    queryFn: () => entitiesApi.list(params),
  });
}

export function useEntityDetail(entityId: string) {
  return useQuery({
    queryKey: queryKeys.entities.detail(entityId),
    queryFn: () => entitiesApi.get(entityId),
    enabled: Boolean(entityId),
  });
}

export function useEntityHistory(entityId: string, params?: EntityHistoryParams) {
  return useQuery({
    queryKey: queryKeys.entities.history(entityId, params),
    queryFn: () => entitiesApi.history(entityId, params),
    enabled: Boolean(entityId),
  });
}

function inferOptimisticState(domain: string, action: string, data: Record<string, unknown>, currentState: string): string {
  if (domain === 'light' || domain === 'switch') {
    if (action === 'turn_on') return 'on';
    if (action === 'turn_off') return 'off';
    if (action === 'toggle') return currentState === 'on' ? 'off' : 'on';
  }
  if (domain === 'climate') {
    const mode = data.hvac_mode as string | undefined;
    if (mode) return mode;
  }
  return currentState;
}

function getCachedEntity(queryClient: ReturnType<typeof useQueryClient>, entityId: string): Entity | undefined {
  const detail = queryClient.getQueryData<Entity>(queryKeys.entities.detail(entityId));
  if (detail) return detail;

  const list = queryClient.getQueryData<{ entities: Entity[] }>(queryKeys.entities.list());
  return list?.entities.find((entity) => entity.entity_id === entityId);
}

export function useEntityAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: entitiesApi.callAction,
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.entities.all() });
      const entity = getCachedEntity(queryClient, request.target.entity_id);
      if (!entity) return;

      const state = inferOptimisticState(request.domain, request.action, request.data ?? {}, entity.state);
      applyOptimisticEntityActionToCache(queryClient, request.target.entity_id, state, request.data ?? {});
    },
    onSettled: async () => {
      await invalidateEntityReadModels(queryClient);
    },
  });
}
