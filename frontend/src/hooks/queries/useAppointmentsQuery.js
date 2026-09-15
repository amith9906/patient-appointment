import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentAPI } from '../../services/api';
import { queryKeys } from '../../services/queryClient';

export function useAppointmentsQuery(params = {}) {
  return useQuery({
    queryKey: queryKeys.appointments(params),
    queryFn: async () => {
      const res = await appointmentAPI.getAll(params);
      return {
        appointments: res.data || [],
        meta: res.pagination || null,
      };
    },
    staleTime: 1000 * 15, // 15 seconds fresh window for active appointments
  });
}

export function useBookAppointmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => appointmentAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

export function useUpdateAppointmentStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => appointmentAPI.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}
