import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds fresh window
      gcTime: 1000 * 60 * 10, // 10 minutes cache garbage collection time
      retry: 1, // Single retry on transient network error
      refetchOnWindowFocus: false, // Prevent jarring layout shifts while filling clinical forms
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Centralized Query Key Factory for scope management & precise cache invalidation
export const queryKeys = {
  // Master / Reference Data (Longer stale time)
  departments: (hospitalId) => ['departments', hospitalId || 'all'],
  doctors: (filters) => ['doctors', filters || {}],
  labTemplates: ['labTemplates'],
  
  // Transactional / Clinical Data
  patients: (filters) => ['patients', filters || {}],
  patientDetail: (id) => ['patients', 'detail', id],
  appointments: (filters) => ['appointments', filters || {}],
  appointmentDetail: (id) => ['appointments', 'detail', id],
  vitals: (appointmentId) => ['vitals', appointmentId],
  queue: (hospitalId) => ['queue', hospitalId || 'all'],
  ipdAdmissions: (filters) => ['ipdAdmissions', filters || {}],
  ipdDetail: (id) => ['ipdAdmissions', 'detail', id],
  medications: (filters) => ['medications', filters || {}],
  labs: (filters) => ['labs', filters || {}],
  reports: (filters) => ['reports', filters || {}],
  billing: (filters) => ['billing', filters || {}],
};
