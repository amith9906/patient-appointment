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
  (res) => {
    if (
      res.data &&
      Object.prototype.hasOwnProperty.call(res.data, 'data') &&
      Object.prototype.hasOwnProperty.call(res.data, 'meta')
    ) {
      res.pagination = res.data.meta;
      res.data = res.data.data;
    }
    return res;
  },
  (err) => {
    if (err.response.status === 401) {
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
  getAvailability: (id, params) => api.get(`/doctors/${id}/availability`, { params }),
  saveAvailability: (id, payload) => api.post(`/doctors/${id}/availability`, payload),
  getAvailabilitySummary: (params) => api.get('/doctors/availability/summary', { params }),
  getAvailableOnDate: (date) => api.get('/doctors/available-on', { params: { date } }),
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
  getReferralAnalytics: (params) => api.get('/patients/analytics/referrals', { params }),
  create: (data) => api.post('/patients', data),
  update: (id, data) => api.put(`/patients/${id}`, data),
  delete: (id) => api.delete(`/patients/${id}`),
  // Patient portal (logged-in patient)
  getMe: () => api.get('/patients/me'),
  getMyAppointments: (params) => api.get('/patients/me/appointments', { params }),
  getMyReports: () => api.get('/patients/me/reports'),
  bookAppointment: (data) => api.post('/patients/me/book', data),
  cancelMyAppointment: (id, reason) => api.patch(`/patients/me/appointments/${id}/cancel`, { reason }),
  rescheduleMyAppointment: (id, data) => api.patch(`/patients/me/appointments/${id}/reschedule`, data),
};

// Appointments
export const appointmentAPI = {
  getAll: (params) => api.get('/appointments', { params }),
  getOne: (id) => api.get(`/appointments/${id}`),
  getToday: () => api.get('/appointments/today'),
  getQueue: (params) => api.get('/appointments/queue', { params }),
  getDashboard: () => api.get('/appointments/dashboard'),
  getAnalytics: (params) => api.get('/appointments/analytics', { params }),
  getPatientAnalytics: (params) => api.get('/appointments/patient-analytics', { params }),
  getRevenueOverview: (params) => api.get('/appointments/revenue-overview', { params }),
  create: (data) => api.post('/appointments', data),
  update: (id, data) => api.put(`/appointments/${id}`, data),
  updateClaim: (id, data) => api.patch(`/appointments/${id}/claim`, data),
  cancel: (id, reason) => api.put(`/appointments/${id}/cancel`, { reason }),
  getBillItems: (id) => api.get(`/appointments/${id}/bill-items`),
  saveBillItems: (id, items) => api.put(`/appointments/${id}/bill-items`, { items }),
  markPaid: (id) => api.patch(`/appointments/${id}/mark-paid`),
  checkIn: (id, data) => api.patch(`/appointments/${id}/check-in`, data || {}),
};

// Medications
export const medicationAPI = {
  getAll: (params) => api.get('/medications', { params }),
  getOne: (id) => api.get(`/medications/${id}`),
  getAdvancedAnalytics: (params) => api.get('/medications/advanced-analytics', { params }),
  getBatches: (id, params) => api.get(`/medications/${id}/batches`, { params }),
  getStockLedger: (id, params) => api.get(`/medications/${id}/ledger`, { params }),
  create: (data) => api.post('/medications', data),
  update: (id, data) => api.put(`/medications/${id}`, data),
  updateStock: (id, data) => api.patch(`/medications/${id}/stock`, data),
  delete: (id) => api.delete(`/medications/${id}`),
  getExpiryAlerts: (params) => api.get('/medications/expiry-alerts', { params }),
};

// Medicine Invoices
export const medicineInvoiceAPI = {
  getAll: (params) => api.get('/medicine-invoices', { params }),
  getOne: (id) => api.get(`/medicine-invoices/${id}`),
  create: (data) => api.post('/medicine-invoices', data),
  markPaid: (id, isPaid) => api.patch(`/medicine-invoices/${id}/mark-paid`, { isPaid }),
  getAnalytics: (params) => api.get('/medicine-invoices/analytics', { params }),
  getGSTReport: (params) => api.get('/medicine-invoices/gst-report', { params }),
  getGSTR1: (params) => api.get('/medicine-invoices/gstr1', { params }),
  getGSTR3B: (params) => api.get('/medicine-invoices/gstr3b', { params }),
  getMargGstExport: (params) => api.get('/medicine-invoices/gst-marg-export', { params, responseType: 'blob' }),
  getReturns: (id) => api.get(`/medicine-invoices/${id}/returns`),
  createReturn: (id, data) => api.post(`/medicine-invoices/${id}/returns`, data),
};

// Vendors
export const vendorAPI = {
  getAll: (params) => api.get('/vendors', { params }),
  create: (data) => api.post('/vendors', data),
  update: (id, data) => api.put(`/vendors/${id}`, data),
  delete: (id) => api.delete(`/vendors/${id}`),
};

// Stock Purchases
export const stockPurchaseAPI = {
  getAll: (params) => api.get('/stock-purchases', { params }),
  create: (data) => api.post('/stock-purchases', data),
  getReturns: (id) => api.get(`/stock-purchases/${id}/returns`),
  createReturn: (id, data) => api.post(`/stock-purchases/${id}/return`, data),
};

// Corporate accounts and ledger
export const corporateAPI = {
  getAll: (params) => api.get('/corporates', { params }),
  create: (data) => api.post('/corporates', data),
  update: (id, data) => api.put(`/corporates/${id}`, data),
  remove: (id) => api.delete(`/corporates/${id}`),
  getLedger: (id, params) => api.get(`/corporates/${id}/ledger`, { params }),
  postInvoice: (id, data) => api.post(`/corporates/${id}/invoices`, data),
  postPayment: (id, data) => api.post(`/corporates/${id}/payments`, data),
};

// Package plans and patient package bundles
export const packageAPI = {
  getPlans: (params) => api.get('/packages/plans', { params }),
  createPlan: (data) => api.post('/packages/plans', data),
  updatePlan: (id, data) => api.put(`/packages/plans/${id}`, data),
  getAnalytics: (params) => api.get('/packages/analytics', { params }),
  getUsageLog: (params) => api.get('/packages/usage-log', { params }),
  getRecommendation: (params) => api.get('/packages/recommendation', { params }),
  assignToPatient: (data) => api.post('/packages/assignments', data),
  getPatientAssignments: (patientId, params) => api.get(`/packages/patients/${patientId}/assignments`, { params }),
  consumeVisit: (id, data) => api.patch(`/packages/assignments/${id}/consume`, data),
  updateAssignmentStatus: (id, data) => api.patch(`/packages/assignments/${id}/status`, data),
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

// Lab Report Templates
export const labReportTemplateAPI = {
  getAll: (params) => api.get('/lab-report-templates', { params }),
  getOne: (id) => api.get(`/lab-report-templates/${id}`),
  create: (data) => api.post('/lab-report-templates', data),
  update: (id, data) => api.put(`/lab-report-templates/${id}`, data),
  delete: (id) => api.delete(`/lab-report-templates/${id}`),
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
  medicineInvoice: (invoiceId) => api.get(`/pdf/medicine-invoice/${invoiceId}`, { responseType: 'blob' }),
  medicineReturn: (returnId) => api.get(`/pdf/medicine-return/${returnId}`, { responseType: 'blob' }),
  purchaseReturn: (returnId) => api.get(`/pdf/purchase-return/${returnId}`, { responseType: 'blob' }),
  dischargeSummary: (appointmentId, params) => api.get(`/pdf/discharge/${appointmentId}`, { responseType: 'blob', params }),
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

// Expenses
export const expenseAPI = {
  getAll: (params) => api.get('/expenses', { params }),
  getAnalytics: (params) => api.get('/expenses/analytics', { params }),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
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

// OT Management
export const otAPI = {
  getStats: (params) => api.get('/ot/stats', { params }),
  getAll: (params) => api.get('/ot', { params }),
  getOne: (id) => api.get(`/ot/${id}`),
  create: (data) => api.post('/ot', data),
  update: (id, data) => api.put(`/ot/${id}`, data),
  cancel: (id) => api.patch(`/ot/${id}/cancel`),
};

// IPD Management
export const ipdAPI = {
  getStats: (params) => api.get('/ipd/stats', { params }),
  getRooms: (params) => api.get('/ipd/rooms', { params }),
  createRoom: (data) => api.post('/ipd/rooms', data),
  updateRoom: (id, data) => api.put(`/ipd/rooms/${id}`, data),
  deleteRoom: (id) => api.delete(`/ipd/rooms/${id}`),
  getAdmissions: (params) => api.get('/ipd', { params }),
  getAdmission: (id) => api.get(`/ipd/${id}`),
  admit: (data) => api.post('/ipd', data),
  update: (id, data) => api.put(`/ipd/${id}`, data),
  discharge: (id, data) => api.patch(`/ipd/${id}/discharge`, data),
  addNote: (id, data) => api.post(`/ipd/${id}/notes`, data),
  // Billing
  getBill: (id) => api.get(`/ipd/${id}/bill`),
  addBillItem: (id, data) => api.post(`/ipd/${id}/bill/items`, data),
  updateBillItem: (id, itemId, data) => api.put(`/ipd/${id}/bill/items/${itemId}`, data),
  deleteBillItem: (id, itemId) => api.delete(`/ipd/${id}/bill/items/${itemId}`),
  addPayment: (id, data) => api.post(`/ipd/${id}/bill/payments`, data),
  deletePayment: (id, paymentId) => api.delete(`/ipd/${id}/bill/payments/${paymentId}`),
  updateDiscount: (id, data) => api.patch(`/ipd/${id}/bill/discount`, data),
};

// Treatment Plans
export const treatmentPlanAPI = {
  getAll: (params) => api.get('/treatment-plans', { params }),
  getOne: (id) => api.get(`/treatment-plans/${id}`),
  create: (data) => api.post('/treatment-plans', data),
  update: (id, data) => api.put(`/treatment-plans/${id}`, data),
  delete: (id) => api.delete(`/treatment-plans/${id}`),
};

// Doctor Leaves
export const doctorLeaveAPI = {
  getAll: (params) => api.get('/doctor-leaves', { params }),
  checkLeave: (doctorId, date) => api.get('/doctor-leaves/check', { params: { doctorId, date } }),
  create: (data) => api.post('/doctor-leaves', data),
  delete: (id) => api.delete(`/doctor-leaves/${id}`),
};

// Global Search
export const searchAPI = {
  global: (q) => api.get('/search', { params: { q } }),
};

export default api;
