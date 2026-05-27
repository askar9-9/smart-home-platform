import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as client from '../../src/api/client';
import * as api from '../../src/features/realtime/api';
import { useEventSource } from '../../src/features/realtime/connection';

vi.mock('../../src/api/client', () => ({
  getToken: vi.fn(),
}));

vi.mock('../../src/features/realtime/api', () => ({
  createRealtimeEventSource: vi.fn(),
}));

const mockEventSource = {
  url: 'http://localhost/events/stream?token=test-token',
  withCredentials: false,
  readyState: 0,
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2,
  onopen: null as EventSource['onopen'],
  onmessage: null as EventSource['onmessage'],
  onerror: null as EventSource['onerror'],
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  close: vi.fn(),
} as EventSource;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(client, 'getToken').mockReturnValue('test-token');
  vi.spyOn(api, 'createRealtimeEventSource').mockReturnValue(mockEventSource);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useEventSource', () => {
  it('starts in connecting state', () => {
    const { result } = renderHook(() => useEventSource());
    expect(result.current.status).toBe('connecting');
  });

  it('transitions to live on open', () => {
    const { result } = renderHook(() => useEventSource());
    act(() => {
      mockEventSource.onopen?.(new Event('open'));
    });
    expect(result.current.status).toBe('live');
  });

  it('transitions to polling on error', () => {
    const { result } = renderHook(() => useEventSource());
    act(() => {
      mockEventSource.onerror?.(new Event('error'));
    });
    expect(result.current.status).toBe('polling');
  });

  it('transitions to offline when no token', () => {
    vi.spyOn(client, 'getToken').mockReturnValue(null);
    const { result } = renderHook(() => useEventSource());
    expect(result.current.status).toBe('offline');
  });

  it('calls onMessage callback with data', () => {
    const { result } = renderHook(() => useEventSource());
    const callback = vi.fn();
    act(() => {
      result.current.onMessage(callback);
    });
    act(() => {
      mockEventSource.onmessage?.(new MessageEvent('message', { data: '{"type":"state_changed"}' }));
    });
    expect(callback).toHaveBeenCalledWith('{"type":"state_changed"}');
  });

  it('closes EventSource on unmount', () => {
    const { unmount } = renderHook(() => useEventSource());
    unmount();
    expect(mockEventSource.close).toHaveBeenCalled();
  });
});
