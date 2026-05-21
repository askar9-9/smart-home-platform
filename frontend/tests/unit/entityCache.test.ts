import { describe, expect, it } from 'vitest';
import type { ActionRequest, PaginatedEntities, StreamEvent } from '../../src/api/types';
import { applyOptimisticEntityAction, applyStreamEventToCollection } from '../../src/features/entities/cache';

describe('entity cache helpers', () => {
  it('applies optimistic light action to paginated cache', () => {
    const cached: PaginatedEntities = {
      total: 1,
      limit: 50,
      offset: 0,
      entities: [
        {
          entity_id: 'light.kitchen',
          domain: 'light',
          state: 'off',
          attributes: { brightness: 10 },
        },
      ],
    };
    const request: ActionRequest = {
      domain: 'light',
      action: 'turn_on',
      target: { entity_id: 'light.kitchen' },
      data: { brightness: 70 },
    };

    expect(applyOptimisticEntityAction(cached, request).entities[0]).toMatchObject({
      state: 'on',
      attributes: { brightness: 70 },
    });
  });

  it('applies stream update to paginated cache', () => {
    const cached: PaginatedEntities = {
      total: 1,
      limit: 50,
      offset: 0,
      entities: [
        {
          entity_id: 'switch.hallway',
          domain: 'switch',
          state: 'off',
          attributes: {},
        },
      ],
    };
    const event: StreamEvent = {
      type: 'state_changed',
      entity_id: 'switch.hallway',
      new_state: 'on',
      timestamp: '2026-05-22T12:00:00Z',
    };

    expect(applyStreamEventToCollection(cached, event).entities[0]).toMatchObject({
      state: 'on',
      last_updated: '2026-05-22T12:00:00Z',
    });
  });
});
