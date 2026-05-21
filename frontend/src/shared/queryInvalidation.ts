import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

export async function invalidateDeviceReadModels(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.devices.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.areas.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.entities.all() }),
  ]);
}

export async function invalidateEntityReadModels(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.entities.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.events.all() }),
  ]);
}

export async function invalidateRealtimeReadModels(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.events.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.devices.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.energy.all() }),
  ]);
}
