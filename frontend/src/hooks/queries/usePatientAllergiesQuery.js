import { useQuery } from '@tanstack/react-query';
import { patientAPI } from '../../services/api';

export function usePatientAllergiesQuery(patientId) {
  return useQuery({
    queryKey: ['patients', 'allergies', patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const res = await patientAPI.getById(patientId);
      return {
        allergies: res.data?.allergies || res.data?.medicalHistory?.allergies || [],
        chronicConditions: res.data?.chronicConditions || [],
      };
    },
    enabled: !!patientId,
    staleTime: 0, // 0s staleTime: Allergies are safety-critical and must NEVER be stale
    refetchOnMount: true, // Always re-fetch from database on component mount
  });
}
