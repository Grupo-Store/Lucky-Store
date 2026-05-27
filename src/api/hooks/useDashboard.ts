import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  goals: (filters: GoalFilters) => [...dashboardKeys.all, 'goals', filters] as const,
};

export interface ApiGoal {
  id: string;
  ano: number;
  mes: number;
  id_loja: string; // UUID
  target: number;
  floor: number;
}

export interface GoalFilters {
  ano?: number;
  mes?: number;
  id_loja?: string; // UUID
}

export interface GoalPayload {
  ano: number;
  mes: number;
  id_loja: string; // UUID
  target: number;
  floor?: number;
}

// Maps company display name → loja UUID from env vars
export const LOJA_ID: Record<string, string> = {
  'Lucky Store': import.meta.env.VITE_LUCKY_STORE_ID ?? '',
  'BTech':       import.meta.env.VITE_BTECH_ID ?? '',
  'AJJ':         import.meta.env.VITE_AJJ_ID ?? '',
};

// Reverse map: UUID → display name
export const LOJA_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(LOJA_ID).map(([name, id]) => [id, name])
);

export function useGoals(filters: GoalFilters) {
  return useQuery<ApiGoal[]>({
    queryKey: dashboardKeys.goals(filters),
    queryFn: () =>
      apiClient.get('/dashboard/goals', { params: filters }).then(r => r.data.items ?? r.data),
    staleTime: 5 * 60_000,
  });
}

export function useUpsertGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: GoalPayload) =>
      apiClient.post('/dashboard/goals', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: dashboardKeys.all }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) =>
      apiClient.delete(`/dashboard/goals/${goalId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: dashboardKeys.all }),
  });
}
