import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { appointmentAPI } from '../services/api';
import Badge from '../components/Badge';
import styles from './Dashboard.module.css';

function StatCard({ label, value, icon, color, to }) {
  return (
    <Link to={to} className={styles.statCard} style={{ borderTopColor: color }}>
      <div className={styles.statIcon} style={{ background: color + '20', color }}>{icon}</div>
      <div className={styles.statInfo}>
        <div className={styles.statValue}>{value ?? '—'}</div>
        <div className={styles.statLabel}>{label}</div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [todayAppts, setTodayAppts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([appointmentAPI.getDashboard(), appointmentAPI.getToday()])
      .then(([s, t]) => { setStats(s.data); setTodayAppts(t.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.loading}><div className={styles.spinner} /></div>;

  return (
    <div>
      <h2 className={styles.greeting}>Good {getGreeting()}, welcome back! 👋</h2>
      <p className={styles.date}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <div className={styles.statsGrid}>
        <StatCard label="Total Patients" value={stats?.totalPatients} icon="🧑‍🤝‍🧑" color="#2563eb" to="/patients" />
        <StatCard label="Total Doctors" value={stats?.totalDoctors} icon="👨‍⚕️" color="#16a34a" to="/doctors" />
        <StatCard label="Hospitals" value={stats?.totalHospitals} icon="🏥" color="#9333ea" to="/hospitals" />
        <StatCard label="Today's Appts" value={stats?.todayAppts} icon="📅" color="#d97706" to="/appointments" />
        <StatCard label="Pending" value={stats?.pendingAppts} icon="⏳" color="#dc2626" to="/appointments?status=scheduled" />
        <StatCard label="Completed Today" value={stats?.completedToday} icon="✅" color="#0891b2" to="/appointments" />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Today's Appointments</h3>
          <Link to="/appointments" className={styles.viewAll}>View all →</Link>
        </div>
        {todayAppts.length === 0 ? (
          <div className={styles.empty}>No appointments scheduled for today.</div>
        ) : (
          <div className={styles.apptList}>
            {todayAppts.slice(0, 8).map((a) => (
              <div key={a.id} className={styles.apptCard}>
                <div className={styles.apptTime}>{formatTime(a.appointmentTime)}</div>
                <div className={styles.apptInfo}>
                  <div className={styles.apptPatient}>{a.patient?.name}</div>
                  <div className={styles.apptDoctor}>Dr. {a.doctor?.name} · {a.doctor?.specialization}</div>
                </div>
                <Badge text={a.status} type={a.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}
