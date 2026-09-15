import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorAPI } from '../../services/api';
import { queryKeys } from '../../services/queryClient';

export function useDoctorsQuery(params = {}) {
  return useQuery({
    queryKey: queryKeys.doctors(params),
    queryFn: async () => {
      const res = await doctorAPI.getAll(params);
      return res.data || [];
    },
    staleTime: 1000 * 60 * 5, // Master doctor list remains fresh for 5 minutes
  });
}

export function useCreateDoctorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => doctorAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
    },
  });
}

export function useUpdateDoctorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => doctorAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
    },
  });
}
