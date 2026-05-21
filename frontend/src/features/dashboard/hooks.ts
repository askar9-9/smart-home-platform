import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../api';
import { queryKeys } from '../../shared/queryKeys';

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard.all(),
    queryFn: dashboardApi.get,
  });
}
