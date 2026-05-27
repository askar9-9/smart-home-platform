import { apiClient } from './client';
import type {
  ActionRequest,
  ActionResponse,
  Area,
  Automation,
  Dashboard,
  Device,
  EnergyConsumption,
  EnergyDevice,
  EnergyForecast,
  EnergySummary,
  EventsResponse,
  Home,
  LoginResponse,
  MlAnomaliesResponse,
  PaginatedAutomations,
  Period,
  User,
  Integration,
  DiscoveredDevice,
  ImportResult,
  MqttDeviceCreate,
  SystemStatus
} from './types';
export { devicesApi } from '../features/devices/api';
export { entitiesApi } from '../features/entities/api';

function normalizeAutomationsResponse(payload: Automation[] | PaginatedAutomations): PaginatedAutomations {
  if (Array.isArray(payload)) {
    return {
      total: payload.length,
      limit: payload.length,
      offset: 0,
      automations: payload,
    };
  }
  return {
    ...payload,
    total: typeof payload.total === 'number' ? payload.total : payload.automations.length,
    limit: typeof payload.limit === 'number' ? payload.limit : payload.automations.length,
    offset: typeof payload.offset === 'number' ? payload.offset : 0,
    automations: Array.isArray(payload.automations) ? payload.automations : [],
  };
}

export const authApi = {
  login: (username: string, password: string) =>
    apiClient<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => apiClient<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => apiClient<User>('/auth/me')
};

export const homesApi = {
  list: () => apiClient<Home[]>('/homes')
};

export const dashboardApi = {
  get: () => apiClient<Dashboard>('/dashboard')
};

export const systemApi = {
  status: () => apiClient<SystemStatus>('/system/status')
};

export const areasApi = {
  list: () => apiClient<Area[]>('/areas'),
  create: (area: Pick<Area, 'name' | 'icon' | 'floor_id'>) =>
    apiClient<Area>('/areas', { method: 'POST', body: JSON.stringify(area) }),
  update: (id: string, area: Partial<Area>) =>
    apiClient<Area>(`/areas/${id}`, { method: 'PATCH', body: JSON.stringify(area) }),
  remove: (id: string) => apiClient<void>(`/areas/${id}`, { method: 'DELETE' })
};

export const actionsApi = {
  call: (request: ActionRequest) =>
    apiClient<ActionResponse>('/actions/call', { method: 'POST', body: JSON.stringify(request) })
};

export const automationsApi = {
  list: (params?: { limit?: number; offset?: number }) =>
    apiClient<PaginatedAutomations | Automation[]>('/automations', { params }).then(normalizeAutomationsResponse),
  get: (id: string) => apiClient<Automation>(`/automations/${id}`),
  create: (automation: Omit<Automation, 'id' | 'is_enabled'> & { is_enabled?: boolean }) =>
    apiClient<Automation>('/automations', { method: 'POST', body: JSON.stringify(automation) }),
  update: (id: string, automation: Partial<Automation>) =>
    apiClient<Automation>(`/automations/${id}`, { method: 'PATCH', body: JSON.stringify(automation) }),
  remove: (id: string) => apiClient<void>(`/automations/${id}`, { method: 'DELETE' }),
  run: (id: string) => apiClient<{ ok: boolean; run_id: string; automation_id: string; triggered_at: string }>(`/automations/${id}/run`, { method: 'POST' })
};

export const energyApi = {
  summary: (period: Period) => apiClient<EnergySummary>('/energy/summary', { params: { period } }),
  consumption: (period: Period) =>
    apiClient<EnergyConsumption>('/energy/consumption', {
      params: { period, granularity: period === 'day' ? 'hour' : 'day' }
    }),
  devices: (period: Period) => apiClient<EnergyDevice[]>('/energy/devices', { params: { period } }),
  forecast: () => apiClient<EnergyForecast>('/energy/forecast')
};

export const mlApi = {
  anomalies: (period: Period, limit = 100) =>
    apiClient<MlAnomaliesResponse>('/ml/anomalies', { params: { period, limit } })
};

export const eventsApi = {
  list: (params?: { entity_id?: string; from?: string; to?: string; limit?: number; offset?: number }) =>
    apiClient<EventsResponse>('/events', { params })
};

export const integrationsApi = {
  list: () => apiClient<Integration[]>('/integrations'),
  get: (id: string) => apiClient<Integration>(`/integrations/${id}`),
  create: (data: { name: string; domain: string; config?: Record<string, unknown> }) =>
    apiClient<Integration>('/integrations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Pick<Integration, 'name' | 'config'>>) =>
    apiClient<Integration>(`/integrations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiClient<void>(`/integrations/${id}`, { method: 'DELETE' }),
  discover: (id: string) => apiClient<DiscoveredDevice[]>(`/integrations/${id}/discovery`),
  import: (id: string, discoveredIds?: string[]) =>
    apiClient<ImportResult>(`/integrations/${id}/import`, {
      method: 'POST',
      body: JSON.stringify(discoveredIds ? { discovered_ids: discoveredIds } : {})
    }),
  createMqttDevice: (id: string, data: MqttDeviceCreate) =>
    apiClient<Device>(`/integrations/${id}/mqtt/devices`, { method: 'POST', body: JSON.stringify(data) })
};
