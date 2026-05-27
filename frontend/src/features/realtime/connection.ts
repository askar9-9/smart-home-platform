import { useEffect, useRef, useState } from 'react';
import { getToken } from '../../api/client';
import { createRealtimeEventSource } from './api';

export type RealtimeStatus = 'connecting' | 'live' | 'polling' | 'offline';

export function useEventSource() {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const onMessageRef = useRef<((data: string) => void) | null>(null);

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
      if (onMessageRef.current) {
        onMessageRef.current('__poll__');
      }
    };

    source.onopen = () => {
      setStatus('live');
      if (pollingId) window.clearInterval(pollingId);
      pollingId = undefined;
    };

    source.onmessage = (message) => {
      if (onMessageRef.current) {
        onMessageRef.current(message.data);
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
  }, []);

  return {
    status,
    onMessage: (cb: (data: string) => void) => {
      onMessageRef.current = cb;
    },
  };
}
