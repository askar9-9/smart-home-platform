import { apiClient } from '../../api/client';
import type { Device, PaginatedDevices } from '../../api/types';
import type { DevicesListParams } from '../../shared/queryKeys';

function normalizeDevicesResponse(payload: Device[] | PaginatedDevices): PaginatedDevices {
  if (Array.isArray(payload)) {
    return {
      total: payload.length,
      limit: payload.length,
      offset: 0,
      devices: payload,
    };
  }

  return {
    ...payload,
    total: typeof payload.total === 'number' ? payload.total : payload.devices.length,
    limit: typeof payload.limit === 'number' ? payload.limit : payload.devices.length,
    offset: typeof payload.offset === 'number' ? payload.offset : 0,
    devices: Array.isArray(payload.devices) ? payload.devices : [],
  };
}

export const devicesApi = {
  list: (params?: DevicesListParams) =>
    apiClient<PaginatedDevices | Device[]>('/devices', { params }).then(normalizeDevicesResponse),
  get: (id: string) => apiClient<Device>(`/devices/${id}`),
  create: (device: Partial<Device>) => apiClient<Device>('/devices', { method: 'POST', body: JSON.stringify(device) }),
  update: (id: string, device: Partial<Device>) =>
    apiClient<Device>(`/devices/${id}`, { method: 'PATCH', body: JSON.stringify(device) }),
  remove: (id: string) => apiClient<void>(`/devices/${id}`, { method: 'DELETE' }),
};
