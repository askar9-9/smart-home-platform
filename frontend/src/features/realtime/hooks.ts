import { useEffect, useRef } from 'react';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, energyApi, eventsApi } from '../../api';
import type { Period, StreamEvent } from '../../api/types';
import { queryKeys } from '../../shared/queryKeys';
import { invalidateRealtimeReadModels } from '../../shared/queryInvalidation';
import { entitiesApi } from '../entities/api';
import { applyStreamEventToCache } from '../entities/cache';
import { useEventSource, type RealtimeStatus } from './connection';

function applyStreamEvent(queryClient: QueryClient, event: StreamEvent) {
  if (event.type === 'state_changed' && event.entity_id) {
    applyStreamEventToCache(queryClient, event);
    void invalidateRealtimeReadModels(queryClient);
  }

  if (event.type === 'automation_triggered') {
    void queryClient.invalidateQueries({ queryKey: queryKeys.automations.all() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.events.all() });
  }
}

async function pollReadModels(queryClient: QueryClient, period: Period) {
  const [entitiesResult, dashboard, summary, events] = await Promise.allSettled([
    entitiesApi.list(),
    dashboardApi.get(),
    energyApi.summary(period),
    eventsApi.list({ limit: 10, offset: 0 }),
  ]);
  if (entitiesResult.status === 'fulfilled') {
    queryClient.setQueryData(queryKeys.entities.list(), entitiesResult.value);
  }
  if (dashboard.status === 'fulfilled') {
    queryClient.setQueryData(queryKeys.dashboard.all(), dashboard.value);
  }
  if (summary.status === 'fulfilled') {
    queryClient.setQueryData(queryKeys.energy.summary(period), summary.value);
  }
  if (events.status === 'fulfilled') {
    queryClient.setQueryData(queryKeys.events.list({ limit: 10, offset: 0 }), events.value);
  }
}

export function useRealtimeSync(period: Period = 'day'): RealtimeStatus {
  const queryClient = useQueryClient();
  const { status, onMessage } = useEventSource();
  const periodRef = useRef(period);
  periodRef.current = period;

  useEffect(() => {
    onMessage((data: string) => {
      if (data === '__poll__') {
        void pollReadModels(queryClient, periodRef.current);
        return;
      }
      try {
        applyStreamEvent(queryClient, JSON.parse(data) as StreamEvent);
      } catch {
        void queryClient.invalidateQueries();
      }
    });
  }, [queryClient, onMessage]);

  return status;
}

export { applyStreamEvent };
export type { RealtimeStatus } from './connection';
