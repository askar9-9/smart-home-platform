import type { QueryClient } from '@tanstack/react-query';
import type { Entity, PaginatedEntities, StreamEvent } from '../../api/types';
import { queryKeys } from '../../shared/queryKeys';

export function isPaginatedEntities(value: unknown): value is PaginatedEntities {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'entities' in value &&
      Array.isArray((value as PaginatedEntities).entities)
  );
}

export function isEntity(value: unknown): value is Entity {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'entity_id' in value &&
      typeof (value as Entity).entity_id === 'string'
  );
}

function patchEntityState(entity: Entity, state: string, attributes: Record<string, unknown>): Entity {
  return {
    ...entity,
    state,
    attributes: { ...entity.attributes, ...attributes },
  };
}

function patchStreamState(entity: Entity, event: StreamEvent): Entity {
  if (entity.entity_id !== event.entity_id) return entity;
  return {
    ...entity,
    state: event.new_state ?? entity.state,
    attributes: { ...entity.attributes, ...(event.attributes ?? {}) },
    last_updated: event.timestamp ?? entity.last_updated,
    last_changed: event.timestamp ?? entity.last_changed,
  };
}

function syncEntityCaches(queryClient: QueryClient, updateEntity: (entity: Entity) => Entity) {
  queryClient.setQueriesData({ queryKey: queryKeys.entities.all() }, (cached) => {
    if (isPaginatedEntities(cached)) {
      return {
        ...cached,
        entities: cached.entities.map((entity) => updateEntity(entity)),
      };
    }
    if (isEntity(cached)) return updateEntity(cached);
    return cached;
  });
}

export function applyOptimisticEntityAction(
  collection: PaginatedEntities,
  entityId: string,
  state: string,
  attributes: Record<string, unknown> = {}
): PaginatedEntities {
  return {
    ...collection,
    entities: collection.entities.map((entity) =>
      entity.entity_id === entityId ? patchEntityState(entity, state, attributes) : entity
    ),
  };
}

export function applyStreamEventToCollection(collection: PaginatedEntities, event: StreamEvent): PaginatedEntities {
  return {
    ...collection,
    entities: collection.entities.map((entity) => patchStreamState(entity, event)),
  };
}

export function applyOptimisticEntityActionToCache(
  queryClient: QueryClient,
  entityId: string,
  state: string,
  attributes: Record<string, unknown> = {}
) {
  syncEntityCaches(queryClient, (entity) =>
    entity.entity_id === entityId ? patchEntityState(entity, state, attributes) : entity
  );
}

export function applyStreamEventToCache(queryClient: QueryClient, event: StreamEvent) {
  if (event.type !== 'state_changed' || !event.entity_id) return;
  syncEntityCaches(queryClient, (entity) => patchStreamState(entity, event));
}
