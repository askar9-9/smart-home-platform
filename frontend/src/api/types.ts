export type Domain = 'light' | 'switch' | 'sensor' | 'binary_sensor' | 'climate' | 'energy_meter' | string;
export type Period = 'day' | 'week' | 'month';

export interface ApiErrorBody {
  error?: string;
  message?: string;
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface User {
  id: string;
  name: string;
  username: string;
  is_admin: boolean;
  created_at?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Home {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  time_zone?: string;
  currency?: string;
  created_at?: string;
}

export interface Area {
  id: string;
  home_id?: string;
  name: string;
  icon?: string | null;
  floor_id?: string | null;
  temperature_entity_id?: string | null;
  humidity_entity_id?: string | null;
  device_count?: number;
  entity_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardArea {
  id: string;
  name: string;
  icon?: string | null;
  temperature?: string | null;
  humidity?: string | null;
  devices_online: number;
  devices_total: number;
}

export interface Dashboard {
  home: Pick<Home, 'id' | 'name'>;
  areas: DashboardArea[];
  summary: {
    devices_total: number;
    devices_online: number;
    automations_active: number;
    energy_today_kwh: number;
    current_power_w: number;
  };
  recent_events: EventRecord[];
}

export interface Entity {
  entity_id: string;
  domain: Domain;
  name?: string;
  device_id?: string | null;
  area_id?: string | null;
  state: string;
  attributes: Record<string, unknown>;
  unit_of_measurement?: string | null;
  device_class?: string | null;
  last_changed?: string;
  last_updated?: string;
}

export interface EntityHistory {
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated?: string;
}

export interface Device {
  id: string;
  name: string;
  name_by_user?: string | null;
  type: string;
  manufacturer?: string | null;
  model?: string | null;
  area_id?: string | null;
  area_name?: string | null;
  status: 'online' | 'offline' | string;
  entity_count?: number;
  entities?: Entity[];
  created_at?: string;
  updated_at?: string;
}

export interface ActionRequest {
  domain: string;
  action: string;
  target: { entity_id: string };
  data?: Record<string, unknown>;
}

export interface ActionResponse {
  ok: boolean;
  entity_id: string;
  new_state: string;
  attributes: Record<string, unknown>;
}

export interface Automation {
  id: string;
  name: string;
  description?: string;
  is_enabled: boolean;
  mode?: string;
  trigger: { type: string; entity_id: string; to?: string };
  condition?: { entity_id: string; operator: string; value: string | number } | null;
  action: ActionRequest;
  last_triggered?: string | null;
  created_at?: string;
}

export interface EnergySummary {
  period: Period;
  total_kwh: number;
  total_cost: number;
  currency: string;
  current_power_w: number;
  peak_power_w: number;
  device_count: number;
  date_from: string;
  date_to: string;
}

export interface ConsumptionPoint {
  timestamp: string;
  kwh: number;
  power_w: number;
}

export interface EnergyConsumption {
  period: Period;
  granularity: string;
  data: ConsumptionPoint[];
}

export interface EnergyDevice {
  entity_id: string;
  device_name: string;
  kwh: number;
  current_power_w: number;
  percentage: number;
  anomaly: boolean;
  anomaly_reason?: string;
}

export interface EnergyForecast {
  period_hours: number;
  forecast: Array<{ hour: number; predicted_kwh: number; predicted_power_w: number }>;
  total_predicted_kwh: number;
  confidence: string;
}

export type MlAnomalySeverity = 'low' | 'medium' | 'high';

export interface MlAnomaly {
  id: string;
  entity_id: string;
  device_name: string;
  recorded_at: string;
  power_w: number;
  energy_kwh: number;
  anomaly_score: number;
  severity: MlAnomalySeverity;
  reason: string;
}

export interface MlAnomalyTimelinePoint {
  timestamp: string;
  power_w: number;
  energy_kwh: number;
  anomaly_score: number;
  anomaly: boolean;
}

export interface MlAnomaliesResponse {
  model: {
    name: string;
    dataset: string;
    trained_at: string;
    confidence: 'ml';
  };
  summary: {
    total: number;
    anomalies: number;
    period: Period;
  };
  anomalies: MlAnomaly[];
  timeline: MlAnomalyTimelinePoint[];
}

export interface EventRecord {
  id: string;
  entity_id: string;
  event_type: string;
  old_state?: string | null;
  new_state?: string | null;
  source: string;
  user_id?: string | null;
  automation_id?: string | null;
  created_at: string;
}

export interface EventsResponse {
  total: number;
  limit: number;
  offset: number;
  events: EventRecord[];
}

export interface StreamEvent {
  type: 'state_changed' | 'automation_triggered' | string;
  entity_id?: string;
  new_state?: string;
  attributes?: Record<string, unknown>;
  timestamp?: string;
  automation_id?: string;
}

export interface Integration {
  id: string;
  name: string;
  domain: string;
  config: Record<string, unknown>;
  device_count: number;
  created_at: string;
}

export interface DiscoveredDevice {
  discovered_id: string;
  suggested_entity_id: string;
  name: string;
  type: string;
  manufacturer: string;
  model: string;
  entities: Array<{
    entity_id: string;
    domain: string;
    name: string;
    state: string;
    attributes: Record<string, unknown>;
  }>;
  already_imported: boolean;
}

export interface ImportResult {
  integration_id: string;
  imported: number;
  skipped: Array<{ discovered_id: string; reason: string }>;
  devices: Device[];
}

export interface PaginatedDevices {
  total: number;
  limit: number;
  offset: number;
  devices: Device[];
}

export interface PaginatedEntities {
  total: number;
  limit: number;
  offset: number;
  entities: Entity[];
}

export interface PaginatedAutomations {
  total: number;
  limit: number;
  offset: number;
  automations: Automation[];
}
