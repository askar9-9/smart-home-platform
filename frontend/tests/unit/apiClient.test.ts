import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mlApi } from '../../src/api';
import { apiClient, AUTH_EXPIRED_EVENT } from '../../src/api/client';

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('normalizes json errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'not_found', message: 'Entity not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    })));

    await expect(apiClient('/missing')).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
      message: 'Entity not found'
    });
  });

  it('adds bearer token when present', async () => {
    localStorage.setItem('smart-home-token', 'jwt');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }));
    vi.stubGlobal('fetch', fetchMock);

    await apiClient('/ok');
    const init = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0][1];
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer jwt');
  });

  it('clears token and emits auth expiration on 401', async () => {
    localStorage.setItem('smart-home-token', 'expired-jwt');
    const eventHandler = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, eventHandler);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: 'unauthorized',
      message: 'Not authenticated'
    }), {
      status: 401,
      headers: { 'content-type': 'application/json' }
    })));

    await expect(apiClient('/auth/me')).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized',
      message: 'Not authenticated'
    });
    expect(localStorage.getItem('smart-home-token')).toBeNull();
    expect(eventHandler).toHaveBeenCalledTimes(1);

    window.removeEventListener(AUTH_EXPIRED_EVENT, eventHandler);
  });

  it('calls ml anomalies with period and typed response', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      model: {
        name: 'IsolationForest',
        dataset: 'UCI Individual Household Electric Power Consumption',
        trained_at: '2026-05-21T00:00:00+00:00',
        confidence: 'ml'
      },
      summary: { total: 1, anomalies: 0, period: 'day' },
      anomalies: [],
      timeline: [{ timestamp: '2026-05-21T00:00:00+00:00', power_w: 650, energy_kwh: 0.65, anomaly_score: -0.02, anomaly: false }]
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await mlApi.anomalies('day');
    const url = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0][0];

    expect(url).toContain('/ml/anomalies?period=day&limit=100');
    expect(response.model.name).toBe('IsolationForest');
    expect(response.timeline[0].anomaly).toBe(false);
  });
});
