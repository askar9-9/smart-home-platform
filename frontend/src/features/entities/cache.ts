import type { QueryClient } from '@tanstack/react-query';
import type { ActionRequest, Entity, PaginatedEntities, StreamEvent } from '../../api/types';
import { queryKeys } from '../../shared/queryKeys';

function numberAttr(attributes: Record<string, unknown>, key: string, fallback: number) {
  const value = attributes[key];
  return typeof value === 'number' ? value : fallback;
}

function patchEntityState(entity: Entity, request: ActionRequest): Entity {
  if (entity.entity_id !== request.target.entity_id) return entity;

  if (entity.domain === 'light') {
    const brightness =
      typeof request.data?.brightness === 'number'
        ? request.data.brightness
        : numberAttr(entity.attributes, 'brightness', entity.state === 'on' ? 100 : 0);
    const state = request.action === 'turn_off' || brightness === 0 ? 'off' : request.action === 'turn_on' ? 'on' : entity.state;
    return {
      ...entity,
      state,
      attributes: {
        ...entity.attributes,
        ...(request.data ?? {}),
      },
    };
  }

  if (entity.domain === 'switch') {
    return {
      ...entity,
      state: request.action === 'turn_off' ? 'off' : request.action === 'turn_on' ? 'on' : entity.state,
      attributes: {
        ...entity.attributes,
        ...(request.data ?? {}),
      },
    };
  }

  if (entity.domain === 'climate') {
    const hvacMode = typeof request.data?.hvac_mode === 'string' ? request.data.hvac_mode : undefined;
    return {
      ...entity,
      state: hvacMode ?? entity.state,
      attributes: {
        ...entity.attributes,
        ...(request.data ?? {}),
      },
    };
  }

  return {
    ...entity,
    attributes: {
      ...entity.attributes,
      ...(request.data ?? {}),
    },
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

export function applyOptimisticEntityAction(collection: PaginatedEntities, request: ActionRequest): PaginatedEntities {
  return {
    ...collection,
    entities: collection.entities.map((entity) => patchEntityState(entity, request)),
  };
}

export function applyStreamEventToCollection(collection: PaginatedEntities, event: StreamEvent): PaginatedEntities {
  return {
    ...collection,
    entities: collection.entities.map((entity) => patchStreamState(entity, event)),
  };
}

export function syncEntityCaches(queryClient: QueryClient, updateEntity: (entity: Entity) => Entity) {
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

export function applyOptimisticEntityActionToCache(queryClient: QueryClient, request: ActionRequest) {
  syncEntityCaches(queryClient, (entity) => patchEntityState(entity, request));
}

export function applyStreamEventToCache(queryClient: QueryClient, event: StreamEvent) {
  if (event.type !== 'state_changed' || !event.entity_id) return;
  syncEntityCaches(queryClient, (entity) => patchStreamState(entity, event));
}
