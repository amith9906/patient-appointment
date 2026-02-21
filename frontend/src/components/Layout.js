import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Layout.module.css';

const NAV_BY_ROLE = {
  super_admin: [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/hospitals', label: 'Hospitals', icon: '🏥' },
    { path: '/departments', label: 'Departments', icon: '🏢' },
    { path: '/doctors', label: 'Doctors', icon: '👨‍⚕️' },
    { path: '/patients', label: 'Patients', icon: '🧑‍🤝‍🧑' },
    { path: '/appointments', label: 'Appointments', icon: '📅' },
    { path: '/billing', label: 'Billing', icon: '💰' },
    { path: '/medications', label: 'Medications', icon: '💊' },
    { path: '/vendors', label: 'Vendors', icon: '🏭' },
    { path: '/stock', label: 'Stock Management', icon: '📦' },
    { path: '/labs', label: 'Labs', icon: '🔬' },
    { path: '/reports', label: 'Reports', icon: '📋' },
    { path: '/analytics', label: 'Analytics', icon: '📈' },
    { path: '/users', label: 'User Management', icon: '👥' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ],
  admin: [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/hospitals', label: 'Hospitals', icon: '🏥' },
    { path: '/departments', label: 'Departments', icon: '🏢' },
    { path: '/doctors', label: 'Doctors', icon: '👨‍⚕️' },
    { path: '/patients', label: 'Patients', icon: '🧑‍🤝‍🧑' },
    { path: '/appointments', label: 'Appointments', icon: '📅' },
    { path: '/billing', label: 'Billing', icon: '💰' },
    { path: '/medications', label: 'Medications', icon: '💊' },
    { path: '/vendors', label: 'Vendors', icon: '🏭' },
    { path: '/stock', label: 'Stock Management', icon: '📦' },
    { path: '/labs', label: 'Labs', icon: '🔬' },
    { path: '/reports', label: 'Reports', icon: '📋' },
    { path: '/analytics', label: 'Analytics', icon: '📈' },
    { path: '/users', label: 'User Management', icon: '👥' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ],
  receptionist: [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/appointments', label: 'Appointments', icon: '📅' },
    { path: '/billing', label: 'Billing', icon: '💰' },
    { path: '/patients', label: 'Patients', icon: '🧑‍🤝‍🧑' },
    { path: '/doctors', label: 'Doctors', icon: '👨‍⚕️' },
    { path: '/medications', label: 'Medications', icon: '💊' },
    { path: '/reports', label: 'Reports', icon: '📋' },
  ],
  doctor: [
    { path: '/doctor-portal', label: 'My Dashboard', icon: '📊' },
    { path: '/doctor-portal/appointments', label: 'My Schedule', icon: '📅' },
    { path: '/doctor-portal/patients', label: 'My Patients', icon: '🧑‍🤝‍🧑' },
    { path: '/labs', label: 'Lab Tests', icon: '🔬' },
    { path: '/medications', label: 'Medications', icon: '💊' },
  ],
  patient: [
    { path: '/patient-portal', label: 'My Dashboard', icon: '🏠' },
    { path: '/patient-portal/book', label: 'Book Appointment', icon: '📅' },
    { path: '/patient-portal/appointments', label: 'My Appointments', icon: '🗓️' },
    { path: '/patient-portal/reports', label: 'My Reports', icon: '📋' },
    { path: '/patient-portal/prescriptions', label: 'Prescriptions', icon: '💊' },
  ],
  lab_technician: [
    { path: '/lab-portal', label: 'Test Queue', icon: '🔬' },
    { path: '/lab-portal/upload', label: 'Upload Report', icon: '⬆️' },
    { path: '/reports', label: 'All Reports', icon: '📋' },
  ],
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = NAV_BY_ROLE[user?.role] || NAV_BY_ROLE.receptionist;
  const handleLogout = () => { logout(); navigate('/login'); };

  const isActive = (path) => {
    if (['/','doctor-portal','/patient-portal','/lab-portal'].includes(path)) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className={styles.layout}>
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🏥</span>
          {!collapsed && <span className={styles.logoText}>MediSchedule</span>}
        </div>
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`${styles.navItem} ${isActive(item.path) ? styles.active : ''}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
            </Link>
          ))}
        </nav>
        <button className={styles.collapseBtn} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? '→' : '←'}
        </button>
      </aside>
      {mobileOpen && <button className={styles.backdrop} onClick={() => setMobileOpen(false)} aria-label="Close menu" />}

      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button className={styles.menuBtn} onClick={() => setMobileOpen((v) => !v)} aria-label="Open menu">☰</button>
            <div className={styles.headerTitle}>
              {navItems.find(n => isActive(n.path))?.label || 'MediSchedule'}
            </div>
          </div>
          <div className={styles.headerRight}>
            <span className={styles.userBadge}>
              <span className={styles.userAvatar}>{user?.name?.charAt(0).toUpperCase()}</span>
              <span className={styles.userName}>{user?.name}</span>
              <span className={styles.userRole}>{user?.role?.replace('_', ' ')}</span>
            </span>
            <button className={styles.logoutBtn} onClick={() => navigate('/change-password')}>Change Password</button>
            <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
