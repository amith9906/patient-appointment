import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

// Existing pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Hospitals from './pages/Hospitals';
import Departments from './pages/Departments';
import Doctors from './pages/Doctors';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Appointments from './pages/Appointments';
import Medications from './pages/Medications';
import Labs from './pages/Labs';
import LabReportTemplates from './pages/LabReportTemplates';
import Reports from './pages/Reports';

// New pages
import UserManagement from './pages/UserManagement';
import Analytics from './pages/Analytics';
import Billing from './pages/Billing';
import MedicineInvoices from './pages/MedicineInvoices';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';
import Vendors from './pages/Vendors';
import StockManagement from './pages/StockManagement';
import CorporateAccounts from './pages/CorporateAccounts';
import PackagePlans from './pages/PackagePlans';
import QueueDisplay from './pages/QueueDisplay';
import TreatmentPlans from './pages/TreatmentPlans';
import IPD from './pages/IPD';
import IPDDetail from './pages/IPDDetail';
import FollowUps from './pages/FollowUps';
import OT from './pages/OT';

// Portals
import PatientDashboard from './pages/portal/PatientDashboard';
import MyAppointments from './pages/portal/MyAppointments';
import MyReports from './pages/portal/MyReports';
import MyPrescriptions from './pages/portal/MyPrescriptions';
import DoctorDashboard from './pages/portal/DoctorDashboard';
import DoctorAppointments from './pages/portal/DoctorAppointments';
import AppointmentDetail from './pages/portal/AppointmentDetail';
import DoctorPatients from './pages/portal/DoctorPatients';
import LabDashboard from './pages/portal/LabDashboard';
import LabUpload from './pages/portal/LabUpload';

const ROLE_HOME = {
  super_admin: '/',
  admin: '/',
  receptionist: '/',
  doctor: '/doctor-portal',
  patient: '/patient-portal',
  lab_technician: '/lab-portal',
};

function Loader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-2" aria-label="Hospital">🏥</div>
        <div className="text-xl font-semibold text-slate-800 mb-1">MediSchedule</div>
        <div className="text-slate-500 text-base">Loading MediSchedule...</div>
      </div>
    </div>
  );
}

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role] || '/'} replace />;
  return <Layout>{children}</Layout>;
}

function RoleRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME[user.role] || '/'} replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  const homeRedirect = user ? <Navigate to={ROLE_HOME[user.role] || '/'} replace /> : null;

  return (
    <Routes>
      {/* Auth */}
      <Route path="/login" element={user ? homeRedirect : <Login />} />
      <Route path="/register" element={user ? homeRedirect : <Register />} />
      <Route path="/forgot-password" element={user ? homeRedirect : <ForgotPassword />} />

      {/* Role redirect from root */}
      <Route path="/home" element={<RoleRedirect />} />

      {/* Admin / Receptionist routes */}
      <Route path="/" element={<PrivateRoute roles={['super_admin','admin','receptionist']}><Dashboard /></PrivateRoute>} />
      <Route path="/hospitals" element={<PrivateRoute roles={['super_admin','admin','receptionist']}><Hospitals /></PrivateRoute>} />
      <Route path="/departments" element={<PrivateRoute roles={['super_admin','admin','receptionist']}><Departments /></PrivateRoute>} />
      <Route path="/doctors" element={<PrivateRoute roles={['super_admin','admin','receptionist','doctor']}><Doctors /></PrivateRoute>} />
      <Route path="/patients" element={<PrivateRoute roles={['super_admin','admin','receptionist','doctor']}><Patients /></PrivateRoute>} />
      <Route path="/patients/:id" element={<PrivateRoute roles={['super_admin','admin','receptionist','doctor']}><PatientDetail /></PrivateRoute>} />
      <Route path="/appointments" element={<PrivateRoute roles={['super_admin','admin','receptionist']}><Appointments /></PrivateRoute>} />
      <Route path="/queue" element={<PrivateRoute roles={['super_admin','admin','receptionist']}><QueueDisplay /></PrivateRoute>} />
      <Route path="/appointments/:id" element={<PrivateRoute roles={['super_admin','admin','receptionist','doctor']}><AppointmentDetail /></PrivateRoute>} />
      <Route path="/medications" element={<PrivateRoute roles={['super_admin','admin','receptionist','doctor','lab_technician']}><Medications /></PrivateRoute>} />
      <Route path="/labs" element={<PrivateRoute roles={['super_admin','admin','receptionist','doctor','lab_technician']}><Labs /></PrivateRoute>} />
      <Route path="/lab-report-templates" element={<PrivateRoute roles={['super_admin','admin']}><LabReportTemplates /></PrivateRoute>} />
      <Route path="/reports" element={<PrivateRoute roles={['super_admin','admin','receptionist','doctor','lab_technician']}><Reports /></PrivateRoute>} />
      <Route path="/users" element={<PrivateRoute roles={['super_admin','admin']}><UserManagement /></PrivateRoute>} />
      <Route path="/analytics" element={<PrivateRoute roles={['super_admin','admin']}><Analytics /></PrivateRoute>} />
      <Route path="/billing" element={<PrivateRoute roles={['super_admin','admin','receptionist']}><Billing /></PrivateRoute>} />
      <Route path="/medicine-invoices" element={<PrivateRoute roles={['super_admin','admin','receptionist']}><MedicineInvoices /></PrivateRoute>} />
      <Route path="/expenses" element={<PrivateRoute roles={['super_admin','admin']}><Expenses /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute roles={['super_admin','admin']}><Settings /></PrivateRoute>} />
      <Route path="/change-password" element={<PrivateRoute roles={['super_admin','admin','receptionist','doctor','patient','lab_technician']}><ChangePassword /></PrivateRoute>} />
      <Route path="/vendors" element={<PrivateRoute roles={['super_admin','admin','receptionist']}><Vendors /></PrivateRoute>} />
      <Route path="/stock" element={<PrivateRoute roles={['super_admin','admin','receptionist']}><StockManagement /></PrivateRoute>} />
      <Route path="/corporates" element={<PrivateRoute roles={['super_admin','admin','receptionist']}><CorporateAccounts /></PrivateRoute>} />
      <Route path="/packages" element={<PrivateRoute roles={['super_admin','admin','receptionist']}><PackagePlans /></PrivateRoute>} />
      <Route path="/treatment-plans" element={<PrivateRoute roles={['super_admin','admin','receptionist','doctor']}><TreatmentPlans /></PrivateRoute>} />
      <Route path="/ipd" element={<PrivateRoute roles={['super_admin','admin','receptionist','doctor']}><IPD /></PrivateRoute>} />
      <Route path="/ipd/:id" element={<PrivateRoute roles={['super_admin','admin','receptionist','doctor']}><IPDDetail /></PrivateRoute>} />
      <Route path="/follow-ups" element={<PrivateRoute roles={['super_admin','admin','receptionist','doctor']}><FollowUps /></PrivateRoute>} />
      <Route path="/ot" element={<PrivateRoute roles={['super_admin','admin','receptionist','doctor']}><OT /></PrivateRoute>} />

      {/* Patient Portal */}
      <Route path="/patient-portal" element={<PrivateRoute roles={['patient']}><PatientDashboard /></PrivateRoute>} />
      <Route path="/patient-portal/appointments" element={<PrivateRoute roles={['patient']}><MyAppointments /></PrivateRoute>} />
      <Route path="/patient-portal/reports" element={<PrivateRoute roles={['patient']}><MyReports /></PrivateRoute>} />
      <Route path="/patient-portal/prescriptions" element={<PrivateRoute roles={['patient']}><MyPrescriptions /></PrivateRoute>} />

      {/* Doctor Portal */}
      <Route path="/doctor-portal" element={<PrivateRoute roles={['doctor']}><DoctorDashboard /></PrivateRoute>} />
      <Route path="/doctor-portal/appointments" element={<PrivateRoute roles={['doctor']}><DoctorAppointments /></PrivateRoute>} />
      <Route path="/doctor-portal/appointments/:id" element={<PrivateRoute roles={['doctor']}><AppointmentDetail /></PrivateRoute>} />
      <Route path="/doctor-portal/patients" element={<PrivateRoute roles={['doctor']}><DoctorPatients /></PrivateRoute>} />

      {/* Lab Tech Portal */}
      <Route path="/lab-portal" element={<PrivateRoute roles={['lab_technician']}><LabDashboard /></PrivateRoute>} />
      <Route path="/lab-portal/upload" element={<PrivateRoute roles={['lab_technician']}><LabUpload /></PrivateRoute>} />

      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover />
      </BrowserRouter>
    </AuthProvider>
  );
}
