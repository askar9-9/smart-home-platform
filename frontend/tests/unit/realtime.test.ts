import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { applyStreamEvent } from '../../src/hooks/useRealtime';
import type { Entity, PaginatedEntities } from '../../src/api/types';
import { queryKeys } from '../../src/shared/queryKeys';

describe('applyStreamEvent', () => {
  it('updates entity cache on state_changed', () => {
    const queryClient = new QueryClient();
    const entity: Entity = {
      entity_id: 'light.hallway',
      domain: 'light',
      name: 'Hallway',
      state: 'off',
      attributes: { brightness: 10 }
    };
    queryClient.setQueryData(queryKeys.entities.list(), { total: 1, limit: 50, offset: 0, entities: [entity] });

    applyStreamEvent(queryClient, {
      type: 'state_changed',
      entity_id: 'light.hallway',
      new_state: 'on',
      attributes: { brightness: 80 },
      timestamp: '2026-05-20T18:35:00Z'
    });

    const cached = queryClient.getQueryData<PaginatedEntities>(queryKeys.entities.list());
    expect(cached?.entities[0]).toMatchObject({
      state: 'on',
      attributes: { brightness: 80 },
      last_updated: '2026-05-20T18:35:00Z'
    });
  });
});
