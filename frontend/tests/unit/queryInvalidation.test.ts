import type { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { invalidateDeviceReadModels, invalidateEntityReadModels, invalidateRealtimeReadModels } from '../../src/shared/queryInvalidation';

describe('query invalidation bundles', () => {
  it('invalidates grouped read models', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = { invalidateQueries } as Pick<QueryClient, 'invalidateQueries'> as QueryClient;

    await invalidateDeviceReadModels(queryClient);
    await invalidateEntityReadModels(queryClient);
    await invalidateRealtimeReadModels(queryClient);

    expect(invalidateQueries).toHaveBeenCalledTimes(11);
  });
});
