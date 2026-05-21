import { useQuery } from '@tanstack/react-query';
import { authApi } from '../api';
import { useAuth } from '../auth/AuthProvider';
import { queryKeys } from '../shared/queryKeys';

export function useMe() {
  const { token, setUser } = useAuth();
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: async () => {
      const user = await authApi.me();
      setUser(user);
      return user;
    },
    enabled: Boolean(token),
    retry: false
  });
}
