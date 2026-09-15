import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vitalsAPI } from '../../services/api';
import { queryKeys } from '../../services/queryClient';

export function useVitalsQuery(appointmentId) {
  return useQuery({
    queryKey: queryKeys.vitals(appointmentId),
    queryFn: async () => {
      if (!appointmentId) return null;
      const res = await vitalsAPI.get(appointmentId);
      return res.data || null;
    },
    enabled: !!appointmentId,
    staleTime: 1000 * 10, // 10s fresh window matching polling interval to deduplicate re-render queries
    refetchInterval: 10000, // Live monitoring: Auto-poll vitals every 10s while view is open
    refetchOnWindowFocus: false, // Prevent redundant refetching when switching browser tabs
  });
}

export function useSaveVitalsMutation(appointmentId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => vitalsAPI.save(appointmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vitals', appointmentId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}
