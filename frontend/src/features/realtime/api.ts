import { API_BASE_URL } from '../../api/client';

export function createRealtimeEventSource(token: string) {
  const streamUrl = `${API_BASE_URL}/events/stream?token=${encodeURIComponent(token)}`;
  return new EventSource(streamUrl);
}
