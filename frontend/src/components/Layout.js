import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { medicationAPI } from '../services/api';
import styles from './Layout.module.css';

const ICON_BY_KEY = {
  Hospital: '🏥',
  Calendar: '📅',
  Rx: '💊',
  Report: '📄',
  Bundle: '🧩',
};

const resolveNavIcon = (icon) => {
  if (!icon) return '•';
  return ICON_BY_KEY[icon] || icon;
};

const NAV_BY_ROLE = {
  super_admin: [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/hospitals', label: 'Hospitals', icon: 'Hospital' },
    { path: '/departments', label: 'Departments', icon: '🏢' },
    { path: '/doctors', label: 'Doctors', icon: '👨‍⚕️' },
    { path: '/patients', label: 'Patients', icon: '🧑‍🤝‍🧑' },
    { path: '/appointments', label: 'Appointments', icon: 'Calendar' },
    { path: '/billing', label: 'Billing', icon: '💰' },
    { path: '/medicine-invoices', label: 'Medicine Invoices', icon: '🧾' },
    { path: '/expenses', label: 'Expenses', icon: '💸' },
    { path: '/medications', label: 'Medications', icon: 'Rx' },
    { path: '/vendors', label: 'Vendors', icon: '🏭' },
    { path: '/stock', label: 'Stock Management', icon: '📦' },
    { path: '/corporates', label: 'Corporate Accounts', icon: '🏢' },
    { path: '/packages', label: 'Package Plans', icon: 'Bundle' },
    { path: '/labs', label: 'Labs', icon: '🔬' },
    { path: '/reports', label: 'Reports', icon: 'Report' },
    { path: '/analytics', label: 'Analytics', icon: '📈' },
    { path: '/users', label: 'User Management', icon: '👥' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ],
  admin: [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/hospitals', label: 'Hospitals', icon: 'Hospital' },
    { path: '/departments', label: 'Departments', icon: '🏢' },
    { path: '/doctors', label: 'Doctors', icon: '👨‍⚕️' },
    { path: '/patients', label: 'Patients', icon: '🧑‍🤝‍🧑' },
    { path: '/appointments', label: 'Appointments', icon: 'Calendar' },
    { path: '/billing', label: 'Billing', icon: '💰' },
    { path: '/medicine-invoices', label: 'Medicine Invoices', icon: '🧾' },
    { path: '/expenses', label: 'Expenses', icon: '💸' },
    { path: '/medications', label: 'Medications', icon: 'Rx' },
    { path: '/vendors', label: 'Vendors', icon: '🏭' },
    { path: '/stock', label: 'Stock Management', icon: '📦' },
    { path: '/corporates', label: 'Corporate Accounts', icon: '🏢' },
    { path: '/packages', label: 'Package Plans', icon: 'Bundle' },
    { path: '/labs', label: 'Labs', icon: '🔬' },
    { path: '/reports', label: 'Reports', icon: 'Report' },
    { path: '/analytics', label: 'Analytics', icon: '📈' },
    { path: '/users', label: 'User Management', icon: '👥' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ],
  receptionist: [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/appointments', label: 'Appointments', icon: 'Calendar' },
    { path: '/billing', label: 'Billing', icon: '💰' },
    { path: '/medicine-invoices', label: 'Medicine Invoices', icon: '🧾' },
    { path: '/patients', label: 'Patients', icon: '🧑‍🤝‍🧑' },
    { path: '/doctors', label: 'Doctors', icon: '👨‍⚕️' },
    { path: '/medications', label: 'Medications', icon: 'Rx' },
    { path: '/corporates', label: 'Corporate Accounts', icon: '🏢' },
    { path: '/packages', label: 'Package Plans', icon: 'Bundle' },
    { path: '/reports', label: 'Reports', icon: 'Report' },
  ],
  doctor: [
    { path: '/doctor-portal', label: 'My Dashboard', icon: '📊' },
    { path: '/doctor-portal/appointments', label: 'My Schedule', icon: 'Calendar' },
    { path: '/doctor-portal/patients', label: 'My Patients', icon: '🧑‍🤝‍🧑' },
    { path: '/labs', label: 'Lab Tests', icon: '🔬' },
    { path: '/medications', label: 'Medications', icon: 'Rx' },
  ],
  patient: [
    { path: '/patient-portal', label: 'My Dashboard', icon: '🏠' },
    { path: '/patient-portal/book', label: 'Book Appointment', icon: 'Calendar' },
    { path: '/patient-portal/appointments', label: 'My Appointments', icon: '🗓️' },
    { path: '/patient-portal/reports', label: 'My Reports', icon: 'Report' },
    { path: '/patient-portal/prescriptions', label: 'Prescriptions', icon: 'Rx' },
  ],
  lab_technician: [
    { path: '/lab-portal', label: 'Test Queue', icon: '🔬' },
    { path: '/lab-portal/upload', label: 'Upload Report', icon: '⬆️' },
    { path: '/reports', label: 'All Reports', icon: 'Report' },
  ],
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = (NAV_BY_ROLE[user.role] || NAV_BY_ROLE.receptionist)
    .filter((item) => item && item.path && item.label);
  const handleLogout = () => { logout(); navigate('/login'); };

  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef(null);

  useEffect(() => {
    if (!['super_admin', 'admin'].includes(user.role)) return;
    medicationAPI.getExpiryAlerts({ days: 30 })
      .then((r) => setExpiryAlerts(r.data || []))
      .catch(() => {});
  }, [user.role]);

  // Close bell dropdown on outside click
  useEffect(() => {
    if (!bellOpen) return;
    const handler = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bellOpen]);

  const isActive = (path) => {
    if (['/','doctor-portal','/patient-portal','/lab-portal'].includes(path)) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className={styles.layout}>
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}>
        <div className={styles.logo}>
          <span className={styles.logoIcon} aria-label="Hospital">{resolveNavIcon('Hospital')}</span>
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
              <span className={styles.navIcon}>{resolveNavIcon(item.icon)}</span>
              {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
            </Link>
          ))}
        </nav>
        <button className={styles.collapseBtn} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? '->' : '←'}
        </button>
      </aside>
      {mobileOpen && <button className={styles.backdrop} onClick={() => setMobileOpen(false)} aria-label="Close menu" />}

      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button className={styles.menuBtn} onClick={() => setMobileOpen((v) => !v)} aria-label="Open menu">List</button>
            <div className={styles.headerTitle}>
              {navItems.find((n) => isActive(n.path))?.label || 'MediSchedule'}
            </div>
          </div>
          <div className={styles.headerRight}>
            {['super_admin', 'admin'].includes(user.role) && (
              <div className={styles.bellWrap} ref={bellRef}>
                <button className={styles.bellBtn} onClick={() => setBellOpen((v) => !v)} title="Expiry Alerts">
                  🔔
                  {expiryAlerts.length > 0 && (
                    <span className={styles.bellBadge}>{expiryAlerts.length > 99 ? '99+' : expiryAlerts.length}</span>
                  )}
                </button>
                {bellOpen && (
                  <div className={styles.bellDropdown}>
                    <div className={styles.bellTitle}>
                      Warning️ Expiry Alerts - {expiryAlerts.length} medicine{expiryAlerts.length !== 1 ? 's' : ''}
                    </div>
                    {expiryAlerts.length === 0 ? (
                      <div style={{ padding: '12px 16px', fontSize: 13, color: '#64748b' }}>No medicines expiring within 30 days</div>
                    ) : (
                      expiryAlerts.slice(0, 6).map((m) => (
                        <div key={m.id} className={styles.bellItem}>
                          <span className={styles.bellItemName}>{m.name}</span>
                          <span style={{
                            color: m.daysRemaining < 0 ? '#dc2626' : m.daysRemaining < 7 ? '#dc2626' : '#d97706',
                            fontSize: 12, fontWeight: 600, flexShrink: 0, marginLeft: 8,
                          }}>
                            {m.daysRemaining < 0 ? 'EXPIRED' : m.daysRemaining === 0 ? 'Today' : `${m.daysRemaining}d left`}
                          </span>
                        </div>
                      ))
                    )}
                    {expiryAlerts.length > 6 && (
                      <div style={{ padding: '6px 16px', fontSize: 12, color: '#94a3b8' }}>
                        +{expiryAlerts.length - 6} more medicines
                      </div>
                    )}
                    <Link to="/medications" className={styles.bellViewAll} onClick={() => setBellOpen(false)}>
                      View All Expiry Alerts {'->'}
                    </Link>
                  </div>
                )}
              </div>
            )}
            <span className={styles.userBadge}>
              <span className={styles.userAvatar}>{user.name.charAt(0).toUpperCase()}</span>
              <span className={styles.userName}>{user.name}</span>
              <span className={styles.userRole}>{user.role.replace('_', ' ')}</span>
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
