import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Entity, PaginatedEntities } from '../../src/api/types';
import {
  applyOptimisticEntityAction,
  applyStreamEventToCollection,
  applyOptimisticEntityActionToCache,
  applyStreamEventToCache,
  isPaginatedEntities,
  isEntity,
} from '../../src/features/entities/cache';

function makeEntity(id: string, state = 'off', attrs = {}): Entity {
  return {
    entity_id: id,
    domain: 'light',
    state,
    attributes: attrs,
  };
}

function makeCollection(entities: Entity[]): PaginatedEntities {
  return { total: entities.length, limit: 50, offset: 0, entities };
}

describe('entity cache helpers', () => {
  describe('type guards', () => {
    it('isPaginatedEntities returns true for valid paginated data', () => {
      expect(isPaginatedEntities(makeCollection([]))).toBe(true);
    });

    it('isPaginatedEntities returns false for non-paginated data', () => {
      expect(isPaginatedEntities({ entities: 'not-array' })).toBe(false);
      expect(isPaginatedEntities(null)).toBe(false);
      expect(isPaginatedEntities(undefined)).toBe(false);
    });

    it('isEntity returns true for valid entity', () => {
      expect(isEntity(makeEntity('light.kitchen'))).toBe(true);
    });

    it('isEntity returns false for non-entity data', () => {
      expect(isEntity({ entity_id: 123 })).toBe(false);
      expect(isEntity({})).toBe(false);
    });
  });

  describe('applyOptimisticEntityAction', () => {
    it('updates matching entity state', () => {
      const collection = makeCollection([
        makeEntity('light.kitchen', 'off'),
        makeEntity('light.bedroom', 'on'),
      ]);

      const result = applyOptimisticEntityAction(collection, 'light.kitchen', 'on', { brightness: 80 });

      expect(result.entities[0].state).toBe('on');
      expect(result.entities[0].attributes.brightness).toBe(80);
      expect(result.entities[1].state).toBe('on');
      expect(result.entities[1].attributes.brightness).toBeUndefined();
    });

    it('does not modify non-matching entities', () => {
      const collection = makeCollection([makeEntity('light.kitchen', 'off')]);
      const result = applyOptimisticEntityAction(collection, 'light.bedroom', 'on');
      expect(result.entities[0].state).toBe('off');
    });

    it('preserves existing attributes when merging', () => {
      const collection = makeCollection([makeEntity('light.kitchen', 'off', { brightness: 50, color: 'warm' })]);
      const result = applyOptimisticEntityAction(collection, 'light.kitchen', 'on', { brightness: 100 });
      expect(result.entities[0].attributes.color).toBe('warm');
      expect(result.entities[0].attributes.brightness).toBe(100);
    });
  });

  describe('applyStreamEventToCollection', () => {
    it('updates matching entity from stream event', () => {
      const collection = makeCollection([makeEntity('switch.hallway', 'off')]);
      const event = {
        type: 'state_changed' as const,
        entity_id: 'switch.hallway',
        new_state: 'on',
        timestamp: '2026-05-22T12:00:00Z',
      };

      const result = applyStreamEventToCollection(collection, event);

      expect(result.entities[0].state).toBe('on');
      expect(result.entities[0].last_updated).toBe('2026-05-22T12:00:00Z');
      expect(result.entities[0].last_changed).toBe('2026-05-22T12:00:00Z');
    });

    it('ignores non-matching entities', () => {
      const collection = makeCollection([makeEntity('switch.hallway', 'off')]);
      const event = {
        type: 'state_changed' as const,
        entity_id: 'switch.kitchen',
        new_state: 'on',
      };

      const result = applyStreamEventToCollection(collection, event);
      expect(result.entities[0].state).toBe('off');
    });

    it('falls back to current state when new_state is undefined', () => {
      const collection = makeCollection([makeEntity('light.kitchen', 'on')]);
      const event = {
        type: 'state_changed' as const,
        entity_id: 'light.kitchen',
      };

      const result = applyStreamEventToCollection(collection, event);
      expect(result.entities[0].state).toBe('on');
    });
  });

  describe('applyOptimisticEntityActionToCache', () => {
    it('updates query cache for paginated entities', () => {
      const mockQueryClient = {
        setQueriesData: vi.fn((_: object, updater: (data: unknown) => unknown) => {
          const result = updater(makeCollection([makeEntity('light.kitchen', 'off')]));
          expect((result as PaginatedEntities).entities[0].state).toBe('on');
        }),
        getQueryData: vi.fn(),
        invalidateQueries: vi.fn(),
        cancelQueries: vi.fn(),
      };

      applyOptimisticEntityActionToCache(mockQueryClient as any, 'light.kitchen', 'on');
      expect(mockQueryClient.setQueriesData).toHaveBeenCalled();
    });
  });

  describe('applyStreamEventToCache', () => {
    it('updates cache on state_changed event', () => {
      const mockQueryClient = {
        setQueriesData: vi.fn((_: object, updater: (data: unknown) => unknown) => {
          const result = updater(makeCollection([makeEntity('light.kitchen', 'off')]));
          expect((result as PaginatedEntities).entities[0].state).toBe('on');
        }),
        getQueryData: vi.fn(),
        invalidateQueries: vi.fn(),
        cancelQueries: vi.fn(),
      };

      applyStreamEventToCache(mockQueryClient as any, {
        type: 'state_changed',
        entity_id: 'light.kitchen',
        new_state: 'on',
      });
      expect(mockQueryClient.setQueriesData).toHaveBeenCalled();
    });

    it('ignores non-state_changed events', () => {
      const mockQueryClient = {
        setQueriesData: vi.fn(),
        getQueryData: vi.fn(),
        invalidateQueries: vi.fn(),
        cancelQueries: vi.fn(),
      };

      applyStreamEventToCache(mockQueryClient as any, {
        type: 'automation_triggered',
      });
      expect(mockQueryClient.setQueriesData).not.toHaveBeenCalled();
    });

    it('ignores events without entity_id', () => {
      const mockQueryClient = {
        setQueriesData: vi.fn(),
        getQueryData: vi.fn(),
        invalidateQueries: vi.fn(),
        cancelQueries: vi.fn(),
      };

      applyStreamEventToCache(mockQueryClient as any, {
        type: 'state_changed',
      });
      expect(mockQueryClient.setQueriesData).not.toHaveBeenCalled();
    });
  });
});
