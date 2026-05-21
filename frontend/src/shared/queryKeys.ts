import type { Period } from '../api/types';

type QueryParamValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryParamValue>;

export interface DevicesListParams extends QueryParams {
  area_id?: string;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface EntitiesListParams extends QueryParams {
  domain?: string;
  area_id?: string;
  device_id?: string;
  limit?: number;
  offset?: number;
}

export interface EntityHistoryParams extends QueryParams {
  from?: string;
  to?: string;
}

export interface EventsListParams extends QueryParams {
  entity_id?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface AutomationsListParams extends QueryParams {
  limit?: number;
  offset?: number;
}

function hasParams(value?: Record<string, unknown>) {
  return Boolean(value && Object.keys(value).length > 0);
}

export const queryKeys = {
  auth: {
    me: () => ['me'] as const,
  },
  dashboard: {
    all: () => ['dashboard'] as const,
  },
  areas: {
    all: () => ['areas'] as const,
  },
  devices: {
    all: () => ['devices'] as const,
    list: (params?: DevicesListParams) => (hasParams(params) ? (['devices', params] as const) : (['devices'] as const)),
    detail: (id: string) => ['devices', id] as const,
  },
  entities: {
    all: () => ['entities'] as const,
    list: (params?: EntitiesListParams) => (hasParams(params) ? (['entities', params] as const) : (['entities'] as const)),
    detail: (entityId: string) => ['entities', entityId] as const,
    history: (entityId: string, params?: EntityHistoryParams) =>
      hasParams(params) ? (['entity-history', entityId, params] as const) : (['entity-history', entityId] as const),
  },
  automations: {
    all: () => ['automations'] as const,
    list: (params?: AutomationsListParams) =>
      hasParams(params) ? (['automations', params] as const) : (['automations'] as const),
    detail: (id: string) => ['automations', id] as const,
  },
  energy: {
    all: () => ['energy'] as const,
    summary: (period: Period) => ['energy', 'summary', period] as const,
    consumption: (period: Period) => ['energy', 'consumption', period] as const,
    devices: (period: Period) => ['energy', 'devices', period] as const,
    forecast: () => ['energy', 'forecast'] as const,
  },
  events: {
    all: () => ['events'] as const,
    list: (params: EventsListParams) => ['events', params] as const,
  },
  integrations: {
    all: () => ['integrations'] as const,
    detail: (id: string) => ['integrations', id] as const,
    discovery: (id: string) => ['integrations', id, 'discovery'] as const,
  },
  ml: {
    anomalies: (period: Period, limit: number) => ['ml', 'anomalies', period, limit] as const,
  },
};
