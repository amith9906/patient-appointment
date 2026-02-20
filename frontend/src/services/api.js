import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const api = axios.create({ baseURL: API_BASE_URL });

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  sendForgotPasswordOtp: (data) => api.post('/auth/forgot-password/send-otp', data),
  resetPasswordWithOtp: (data) => api.post('/auth/forgot-password/reset', data),
  changePassword: (data) => api.post('/auth/change-password', data),
};

// Hospitals
export const hospitalAPI = {
  getAll: () => api.get('/hospitals'),
  getOne: (id) => api.get(`/hospitals/${id}`),
  getStats: (id) => api.get(`/hospitals/${id}/stats`),
  create: (data) => api.post('/hospitals', data),
  update: (id, data) => api.put(`/hospitals/${id}`, data),
  delete: (id) => api.delete(`/hospitals/${id}`),
};

// Departments
export const departmentAPI = {
  getAll: (params) => api.get('/departments', { params }),
  create: (data) => api.post('/departments', data),
  update: (id, data) => api.put(`/departments/${id}`, data),
  delete: (id) => api.delete(`/departments/${id}`),
};

// Doctors
export const doctorAPI = {
  getAll: (params) => api.get('/doctors', { params }),
  getOne: (id) => api.get(`/doctors/${id}`),
  getSlots: (id, date) => api.get(`/doctors/${id}/slots`, { params: { date } }),
  create: (data) => api.post('/doctors', data),
  update: (id, data) => api.put(`/doctors/${id}`, data),
  delete: (id) => api.delete(`/doctors/${id}`),
  // Doctor portal (logged-in doctor)
  getMe: () => api.get('/doctors/me'),
  getMyAppointments: (params) => api.get('/doctors/me/appointments', { params }),
  getMyPatients: () => api.get('/doctors/me/patients'),
};

// Patients
export const patientAPI = {
  getAll: (params) => api.get('/patients', { params }),
  getOne: (id) => api.get(`/patients/${id}`),
  getHistory: (id) => api.get(`/patients/${id}/history`),
  create: (data) => api.post('/patients', data),
  update: (id, data) => api.put(`/patients/${id}`, data),
  delete: (id) => api.delete(`/patients/${id}`),
  // Patient portal (logged-in patient)
  getMe: () => api.get('/patients/me'),
  getMyAppointments: (params) => api.get('/patients/me/appointments', { params }),
  getMyReports: () => api.get('/patients/me/reports'),
  bookAppointment: (data) => api.post('/patients/me/book', data),
};

// Appointments
export const appointmentAPI = {
  getAll: (params) => api.get('/appointments', { params }),
  getOne: (id) => api.get(`/appointments/${id}`),
  getToday: () => api.get('/appointments/today'),
  getDashboard: () => api.get('/appointments/dashboard'),
  getAnalytics: (params) => api.get('/appointments/analytics', { params }),
  create: (data) => api.post('/appointments', data),
  update: (id, data) => api.put(`/appointments/${id}`, data),
  cancel: (id, reason) => api.put(`/appointments/${id}/cancel`, { reason }),
};

// Medications
export const medicationAPI = {
  getAll: (params) => api.get('/medications', { params }),
  getOne: (id) => api.get(`/medications/${id}`),
  create: (data) => api.post('/medications', data),
  update: (id, data) => api.put(`/medications/${id}`, data),
  updateStock: (id, data) => api.patch(`/medications/${id}/stock`, data),
  delete: (id) => api.delete(`/medications/${id}`),
};

// Labs
export const labAPI = {
  getAll: () => api.get('/labs'),
  create: (data) => api.post('/labs', data),
  update: (id, data) => api.put(`/labs/${id}`, data),
  delete: (id) => api.delete(`/labs/${id}`),
  getAllTests: (params) => api.get('/labs/tests', { params }),
  getOneTest: (id) => api.get(`/labs/tests/${id}`),
  createTest: (data) => api.post('/labs/tests', data),
  updateTest: (id, data) => api.put(`/labs/tests/${id}`, data),
  deleteTest: (id) => api.delete(`/labs/tests/${id}`),
};

// Users (admin)
export const userAPI = {
  getAll: (params) => api.get('/users', { params }),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  toggle: (id) => api.patch(`/users/${id}/toggle`),
  getStats: () => api.get('/users/stats'),
};

// Prescriptions
export const prescriptionAPI = {
  getByAppointment: (appointmentId) => api.get(`/prescriptions/appointment/${appointmentId}`),
  getMine: () => api.get('/prescriptions/my'),
  create: (data) => api.post('/prescriptions', data),
  update: (id, data) => api.put(`/prescriptions/${id}`, data),
  delete: (id) => api.delete(`/prescriptions/${id}`),
};

// Hospital Settings (per-hospital, persisted in DB)
export const hospitalSettingsAPI = {
  get: (hospitalId) => api.get(`/hospitals/${hospitalId}/settings`),
  update: (hospitalId, data) => api.put(`/hospitals/${hospitalId}/settings`, data),
};

// PDF generation (server-side, returns blob)
export const pdfAPI = {
  prescription: (appointmentId) => api.get(`/pdf/prescription/${appointmentId}`, { responseType: 'blob' }),
  bill: (appointmentId) => api.get(`/pdf/bill/${appointmentId}`, { responseType: 'blob' }),
  receipt: (appointmentId) => api.get(`/pdf/receipt/${appointmentId}`, { responseType: 'blob' }),
  labReport: (labTestId) => api.get(`/pdf/lab-report/${labTestId}`, { responseType: 'blob' }),
};

// Vitals
export const vitalsAPI = {
  get: (appointmentId) => api.get(`/appointments/${appointmentId}/vitals`),
  save: (appointmentId, data) => api.put(`/appointments/${appointmentId}/vitals`, data),
};

// Bulk upload / template download
export const bulkAPI = {
  downloadMedicationTemplate: () =>
    api.get('/bulk/template/medications', { responseType: 'blob' }),
  downloadPatientTemplate: () =>
    api.get('/bulk/template/patients', { responseType: 'blob' }),
  uploadMedications: (formData) =>
    api.post('/bulk/upload/medications', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  uploadPatients: (formData) =>
    api.post('/bulk/upload/patients', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// Reports
export const reportAPI = {
  getByPatient: (patientId, params) => api.get(`/reports/patient/${patientId}`, { params }),
  getOne: (id) => api.get(`/reports/${id}`),
  upload: (patientId, formData) =>
    api.post(`/reports/patient/${patientId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  download: (id) =>
    api.get(`/reports/${id}/download`, { responseType: 'blob' }),
  delete: (id) => api.delete(`/reports/${id}`),
};

export default api;
