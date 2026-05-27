import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useEntityAction } from '../../src/features/entities/hooks';
import { entitiesApi } from '../../src/features/entities/api';
import { queryKeys } from '../../src/shared/queryKeys';
import * as cache from '../../src/features/entities/cache';

vi.mock('../../src/features/entities/api', () => ({
  entitiesApi: {
    callAction: vi.fn(),
  },
}));

vi.mock('../../src/shared/queryInvalidation', () => ({
  invalidateEntityReadModels: vi.fn(),
}));

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useEntityAction', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it('applies optimistic update on turn_on', async () => {
    vi.spyOn(cache, 'applyOptimisticEntityActionToCache');
    queryClient.setQueryData(queryKeys.entities.list(), {
      total: 1, limit: 50, offset: 0,
      entities: [{ entity_id: 'light.kitchen', domain: 'light', state: 'off', attributes: {} }],
    });

    vi.mocked(entitiesApi.callAction).mockResolvedValue({
      ok: true, entity_id: 'light.kitchen', new_state: 'on', attributes: {},
    });

    const { result } = renderHook(() => useEntityAction(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({
        domain: 'light',
        action: 'turn_on',
        target: { entity_id: 'light.kitchen' },
        data: {},
      });
    });

    expect(cache.applyOptimisticEntityActionToCache).toHaveBeenCalledWith(
      queryClient, 'light.kitchen', 'on', {}
    );
  });

  it('applies optimistic update on turn_off', async () => {
    vi.spyOn(cache, 'applyOptimisticEntityActionToCache');
    queryClient.setQueryData(queryKeys.entities.list(), {
      total: 1, limit: 50, offset: 0,
      entities: [{ entity_id: 'switch.hallway', domain: 'switch', state: 'on', attributes: {} }],
    });

    vi.mocked(entitiesApi.callAction).mockResolvedValue({
      ok: true, entity_id: 'switch.hallway', new_state: 'off', attributes: {},
    });

    const { result } = renderHook(() => useEntityAction(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({
        domain: 'switch',
        action: 'turn_off',
        target: { entity_id: 'switch.hallway' },
        data: {},
      });
    });

    expect(cache.applyOptimisticEntityActionToCache).toHaveBeenCalledWith(
      queryClient, 'switch.hallway', 'off', {}
    );
  });

  it('applies optimistic toggle', async () => {
    vi.spyOn(cache, 'applyOptimisticEntityActionToCache');
    queryClient.setQueryData(queryKeys.entities.list(), {
      total: 1, limit: 50, offset: 0,
      entities: [{ entity_id: 'light.kitchen', domain: 'light', state: 'on', attributes: {} }],
    });

    vi.mocked(entitiesApi.callAction).mockResolvedValue({
      ok: true, entity_id: 'light.kitchen', new_state: 'off', attributes: {},
    });

    const { result } = renderHook(() => useEntityAction(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({
        domain: 'light',
        action: 'toggle',
        target: { entity_id: 'light.kitchen' },
        data: {},
      });
    });

    expect(cache.applyOptimisticEntityActionToCache).toHaveBeenCalledWith(
      queryClient, 'light.kitchen', 'off', {}
    );
  });

  it('applies climate mode change', async () => {
    vi.spyOn(cache, 'applyOptimisticEntityActionToCache');
    queryClient.setQueryData(queryKeys.entities.list(), {
      total: 1, limit: 50, offset: 0,
      entities: [{ entity_id: 'climate.office', domain: 'climate', state: 'off', attributes: {} }],
    });

    vi.mocked(entitiesApi.callAction).mockResolvedValue({
      ok: true, entity_id: 'climate.office', new_state: 'heat', attributes: {},
    });

    const { result } = renderHook(() => useEntityAction(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({
        domain: 'climate',
        action: 'set_mode',
        target: { entity_id: 'climate.office' },
        data: { hvac_mode: 'heat' },
      });
    });

    expect(cache.applyOptimisticEntityActionToCache).toHaveBeenCalledWith(
      queryClient, 'climate.office', 'heat', { hvac_mode: 'heat' }
    );
  });

  it('uses detail cache when list cache is missing', async () => {
    vi.spyOn(cache, 'applyOptimisticEntityActionToCache');
    queryClient.setQueryData(queryKeys.entities.detail('light.kitchen'), {
      entity_id: 'light.kitchen',
      domain: 'light',
      state: 'off',
      attributes: {},
    });

    vi.mocked(entitiesApi.callAction).mockResolvedValue({
      ok: true, entity_id: 'light.kitchen', new_state: 'on', attributes: {},
    });

    const { result } = renderHook(() => useEntityAction(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({
        domain: 'light',
        action: 'turn_on',
        target: { entity_id: 'light.kitchen' },
        data: {},
      });
    });

    expect(cache.applyOptimisticEntityActionToCache).toHaveBeenCalledWith(
      queryClient, 'light.kitchen', 'on', {}
    );
  });

  it('skips optimistic update when entity is absent from cache', async () => {
    vi.spyOn(cache, 'applyOptimisticEntityActionToCache');

    vi.mocked(entitiesApi.callAction).mockResolvedValue({
      ok: true, entity_id: 'light.kitchen', new_state: 'on', attributes: {},
    });

    const { result } = renderHook(() => useEntityAction(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({
        domain: 'light',
        action: 'turn_on',
        target: { entity_id: 'light.kitchen' },
        data: {},
      });
    });

    expect(cache.applyOptimisticEntityActionToCache).not.toHaveBeenCalled();
  });
});
