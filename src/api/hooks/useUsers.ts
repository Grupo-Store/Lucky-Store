import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { UserResponse } from '../../types/api';

interface UsersListResponse {
  items: UserResponse[];
  total: number;
  page: number;
  pages: number;
}

export function useUsers() {
  return useQuery<UsersListResponse>({
    queryKey: ['users'],
    queryFn: () => apiClient.get('/users').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useUserName(id: string): string {
  const { data } = useUsers();
  const user = data?.items.find((u) => u.id === id);
  return user?.name ?? id.slice(0, 8) + '…';
}
