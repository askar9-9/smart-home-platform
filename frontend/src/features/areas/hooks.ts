import { useQuery } from '@tanstack/react-query';
import { areasApi } from '../../api';
import { queryKeys } from '../../shared/queryKeys';

export function useAreasList() {
  return useQuery({
    queryKey: queryKeys.areas.all(),
    queryFn: areasApi.list,
  });
}
