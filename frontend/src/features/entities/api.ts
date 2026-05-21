import { apiClient } from '../../api/client';
import type { ActionRequest, ActionResponse, Entity, EntityHistory, PaginatedEntities } from '../../api/types';
import type { EntitiesListParams, EntityHistoryParams } from '../../shared/queryKeys';

function normalizeEntitiesResponse(payload: Entity[] | PaginatedEntities): PaginatedEntities {
  if (Array.isArray(payload)) {
    return {
      total: payload.length,
      limit: payload.length,
      offset: 0,
      entities: payload,
    };
  }

  return {
    ...payload,
    total: typeof payload.total === 'number' ? payload.total : payload.entities.length,
    limit: typeof payload.limit === 'number' ? payload.limit : payload.entities.length,
    offset: typeof payload.offset === 'number' ? payload.offset : 0,
    entities: Array.isArray(payload.entities) ? payload.entities : [],
  };
}

export const entitiesApi = {
  list: (params?: EntitiesListParams) =>
    apiClient<PaginatedEntities | Entity[]>('/entities', { params }).then(normalizeEntitiesResponse),
  get: (entityId: string) => apiClient<Entity>(`/entities/${entityId}`),
  updateState: (entityId: string, payload: { state: string; attributes?: Record<string, unknown> }) =>
    apiClient<Entity>(`/entities/${entityId}/state`, { method: 'PATCH', body: JSON.stringify(payload) }),
  history: (entityId: string, params?: EntityHistoryParams) =>
    apiClient<EntityHistory[]>(`/entities/${entityId}/history`, { params }),
  callAction: (request: ActionRequest) =>
    apiClient<ActionResponse>('/actions/call', { method: 'POST', body: JSON.stringify(request) }),
};
