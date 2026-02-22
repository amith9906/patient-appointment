import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { medicationAPI, searchAPI } from '../services/api';
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
    { path: '/follow-ups', label: 'Follow-ups', icon: '🔔' },
    { path: '/queue', label: 'Token Queue', icon: '🎫' },
    { path: '/ipd', label: 'IPD', icon: '🏨' },
    { path: '/ot', label: 'OT', icon: '🩺' },
    { path: '/billing', label: 'Billing', icon: '💰' },
    { path: '/medicine-invoices', label: 'Medicine Invoices', icon: '🧾' },
    { path: '/expenses', label: 'Expenses', icon: '💸' },
    { path: '/treatment-plans', label: 'Treatment Plans', icon: '📋' },
    { path: '/medications', label: 'Medications', icon: 'Rx' },
    { path: '/vendors', label: 'Vendors', icon: '🏭' },
    { path: '/stock', label: 'Stock Management', icon: '📦' },
    { path: '/corporates', label: 'Corporate Accounts', icon: '🏢' },
    { path: '/packages', label: 'Package Plans', icon: 'Bundle' },
    { path: '/labs', label: 'Labs', icon: '🔬' },
    { path: '/lab-report-templates', label: 'Lab Templates', icon: '🧪' },
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
    { path: '/follow-ups', label: 'Follow-ups', icon: '🔔' },
    { path: '/queue', label: 'Token Queue', icon: '🎫' },
    { path: '/ipd', label: 'IPD', icon: '🏨' },
    { path: '/ot', label: 'OT', icon: '🩺' },
    { path: '/billing', label: 'Billing', icon: '💰' },
    { path: '/medicine-invoices', label: 'Medicine Invoices', icon: '🧾' },
    { path: '/expenses', label: 'Expenses', icon: '💸' },
    { path: '/treatment-plans', label: 'Treatment Plans', icon: '📋' },
    { path: '/medications', label: 'Medications', icon: 'Rx' },
    { path: '/vendors', label: 'Vendors', icon: '🏭' },
    { path: '/stock', label: 'Stock Management', icon: '📦' },
    { path: '/corporates', label: 'Corporate Accounts', icon: '🏢' },
    { path: '/packages', label: 'Package Plans', icon: 'Bundle' },
    { path: '/labs', label: 'Labs', icon: '🔬' },
    { path: '/lab-report-templates', label: 'Lab Templates', icon: '🧪' },
    { path: '/reports', label: 'Reports', icon: 'Report' },
    { path: '/analytics', label: 'Analytics', icon: '📈' },
    { path: '/users', label: 'User Management', icon: '👥' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ],
  receptionist: [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/appointments', label: 'Appointments', icon: 'Calendar' },
    { path: '/queue', label: 'Token Queue', icon: '🎫' },
    { path: '/ipd', label: 'IPD', icon: '🏨' },
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
    { path: '/follow-ups', label: 'Follow-ups', icon: '🔔' },
    { path: '/doctor-portal/patients', label: 'My Patients', icon: '🧑‍🤝‍🧑' },
    { path: '/labs', label: 'Lab Tests', icon: '🔬' },
    { path: '/medications', label: 'Medications', icon: 'Rx' },
    { path: '/treatment-plans', label: 'Treatment Plans', icon: '📋' },
    { path: '/ipd', label: 'IPD', icon: '🏨' },
    { path: '/ot', label: 'OT', icon: '🩺' },
  ],
  patient: [
    { path: '/patient-portal', label: 'My Dashboard', icon: '🏠' },
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

  // Global search state
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef(null);
  const searchTimer = useRef(null);

  const doSearch = useCallback((q) => {
    clearTimeout(searchTimer.current);
    if (!q || q.length < 2) { setSearchResults(null); setSearchOpen(false); return; }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await searchAPI.global(q);
        setSearchResults(res.data);
        setSearchOpen(true);
      } catch {
        setSearchResults(null);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, []);

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQ(q);
    doSearch(q);
  };

  const clearSearch = () => { setSearchQ(''); setSearchResults(null); setSearchOpen(false); };

  // Close search dropdown on outside click
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

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
            {/* Global Search */}
            {['super_admin', 'admin', 'receptionist', 'doctor'].includes(user.role) && (
              <div ref={searchRef} style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: 8, padding: '4px 10px', gap: 6, minWidth: 220 }}>
                  <span style={{ fontSize: 14, color: '#94a3b8' }}>🔍</span>
                  <input
                    value={searchQ}
                    onChange={handleSearchChange}
                    onFocus={() => { if (searchResults) setSearchOpen(true); }}
                    placeholder="Search patients, doctors..."
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#334155', width: '100%' }}
                  />
                  {searchLoading && <span style={{ fontSize: 11, color: '#94a3b8' }}>...</span>}
                  {searchQ && !searchLoading && (
                    <button onClick={clearSearch} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, padding: 0 }}>✕</button>
                  )}
                </div>
                {searchOpen && searchResults && (
                  <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, minWidth: 320, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 9999, maxHeight: 480, overflowY: 'auto' }}>
                    {/* Patients */}
                    {searchResults.patients?.length > 0 && (
                      <div>
                        <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>Patients</div>
                        {searchResults.patients.map((p) => (
                          <Link key={p.id} to={`/patients/${p.id}`} onClick={clearSearch}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', textDecoration: 'none', color: '#1e293b', fontSize: 13 }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={(e) => e.currentTarget.style.background = ''}
                          >
                            <span style={{ fontSize: 16 }}>🧑‍🤝‍🧑</span>
                            <div>
                              <div style={{ fontWeight: 600 }}>{p.name}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.patientId} · {p.phone} · {p.gender}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                    {/* Doctors */}
                    {searchResults.doctors?.length > 0 && (
                      <div>
                        <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9', borderTop: searchResults.patients?.length > 0 ? '1px solid #f1f5f9' : 'none' }}>Doctors</div>
                        {searchResults.doctors.map((d) => (
                          <Link key={d.id} to="/doctors" onClick={clearSearch}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', textDecoration: 'none', color: '#1e293b', fontSize: 13 }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={(e) => e.currentTarget.style.background = ''}
                          >
                            <span style={{ fontSize: 16 }}>👨‍⚕️</span>
                            <div>
                              <div style={{ fontWeight: 600 }}>{d.name}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>{d.specialization}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                    {/* Appointments */}
                    {searchResults.appointments?.length > 0 && (
                      <div>
                        <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9', borderTop: '1px solid #f1f5f9' }}>Appointments</div>
                        {searchResults.appointments.map((a) => (
                          <Link key={a.id} to="/appointments" onClick={clearSearch}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', textDecoration: 'none', color: '#1e293b', fontSize: 13 }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={(e) => e.currentTarget.style.background = ''}
                          >
                            <span style={{ fontSize: 16 }}>📅</span>
                            <div>
                              <div style={{ fontWeight: 600 }}>{a.patientName}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>{a.date} {a.time && `· ${a.time}`} · {a.status}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                    {/* IPD Admissions */}
                    {searchResults.admissions?.length > 0 && (
                      <div>
                        <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9', borderTop: '1px solid #f1f5f9' }}>IPD Admissions</div>
                        {searchResults.admissions.map((a) => (
                          <Link key={a.id} to={`/ipd/${a.id}`} onClick={clearSearch}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', textDecoration: 'none', color: '#1e293b', fontSize: 13 }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={(e) => e.currentTarget.style.background = ''}
                          >
                            <span style={{ fontSize: 16 }}>🏨</span>
                            <div>
                              <div style={{ fontWeight: 600 }}>{a.patientName}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>Admitted: {a.date} · {a.status}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                    {/* No results */}
                    {!searchResults.patients?.length && !searchResults.doctors?.length && !searchResults.appointments?.length && !searchResults.admissions?.length && (
                      <div style={{ padding: '16px 12px', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>No results for "{searchQ}"</div>
                    )}
                  </div>
                )}
              </div>
            )}
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
