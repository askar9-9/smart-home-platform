import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { devicesApi } from './api';
import { queryKeys, type DevicesListParams } from '../../shared/queryKeys';
import { invalidateDeviceReadModels } from '../../shared/queryInvalidation';

export function useDevicesList(params?: DevicesListParams) {
  return useQuery({
    queryKey: queryKeys.devices.list(params),
    queryFn: () => devicesApi.list(params),
  });
}

export function useDeviceDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.devices.detail(id),
    queryFn: () => devicesApi.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: devicesApi.create,
    onSuccess: async () => {
      await invalidateDeviceReadModels(queryClient);
    },
  });
}

export function useUpdateDevice(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof devicesApi.update>[1]) => devicesApi.update(id, payload),
    onSuccess: async () => {
      await invalidateDeviceReadModels(queryClient);
      await queryClient.invalidateQueries({ queryKey: queryKeys.devices.detail(id) });
    },
  });
}

export function useDeleteDevice(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => devicesApi.remove(id),
    onSuccess: async () => {
      await invalidateDeviceReadModels(queryClient);
    },
  });
}
