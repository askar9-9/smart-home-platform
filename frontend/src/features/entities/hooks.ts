import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export function useEntityAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: entitiesApi.callAction,
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.entities.all() });
      applyOptimisticEntityActionToCache(queryClient, request);
    },
    onSettled: async () => {
      await invalidateEntityReadModels(queryClient);
    },
  });
}
