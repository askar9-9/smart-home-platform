import { useEffect, useState } from 'react';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, energyApi, eventsApi } from '../../api';
import { getToken } from '../../api/client';
import type { Period, StreamEvent } from '../../api/types';
import { queryKeys } from '../../shared/queryKeys';
import { invalidateRealtimeReadModels } from '../../shared/queryInvalidation';
import { entitiesApi } from '../entities/api';
import { applyStreamEventToCache } from '../entities/cache';
import { createRealtimeEventSource } from './api';

export type RealtimeStatus = 'connecting' | 'live' | 'polling' | 'offline';

export function applyStreamEvent(queryClient: QueryClient, event: StreamEvent) {
  if (event.type === 'state_changed' && event.entity_id) {
    applyStreamEventToCache(queryClient, event);
    void invalidateRealtimeReadModels(queryClient);
  }

  if (event.type === 'automation_triggered') {
    void queryClient.invalidateQueries({ queryKey: queryKeys.automations.all() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.events.all() });
  }
}

export function useRealtimeSync(period: Period = 'day') {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setStatus('offline');
      return undefined;
    }

    const source = createRealtimeEventSource(token);
    let pollingId: number | undefined;

    const poll = async () => {
      setStatus('polling');
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
    };

    source.onopen = () => {
      setStatus('live');
      if (pollingId) window.clearInterval(pollingId);
      pollingId = undefined;
    };

    source.onmessage = (message) => {
      try {
        applyStreamEvent(queryClient, JSON.parse(message.data) as StreamEvent);
      } catch {
        void queryClient.invalidateQueries();
      }
    };

    source.onerror = () => {
      setStatus('polling');
      if (!pollingId) {
        void poll();
        pollingId = window.setInterval(poll, 5000);
      }
    };

    return () => {
      source.close();
      if (pollingId) window.clearInterval(pollingId);
    };
  }, [period, queryClient]);

  return status;
}
