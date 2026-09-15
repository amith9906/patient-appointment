import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentAPI } from '../../services/api';
import { queryKeys } from '../../services/queryClient';

export function useQueueQuery(params = {}) {
  return useQuery({
    queryKey: queryKeys.queue(params),
    queryFn: async () => {
      const res = await appointmentAPI.getQueue(params);
      return res.data || [];
    },
    staleTime: 5000, // Fresh window of 5 seconds between active queue polls
    refetchInterval: 10000, // TanStack Query built-in 10s polling (auto-pauses when tab is hidden)
    refetchOnWindowFocus: true,
  });
}

export function useUpdateQueueStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, payload }) => {
      if (action === 'check-in') return appointmentAPI.checkIn(id);
      if (action === 'cancel') return appointmentAPI.cancel(id);
      return appointmentAPI.update(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}
