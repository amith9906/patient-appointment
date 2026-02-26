import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { nurseAPI, shiftAPI, notificationsAPI } from '../../services/api';
import Badge from '../../components/Badge';
import { toast } from 'react-toastify';
import styles from '../Page.module.css';

export default function NurseDashboard() {
  const navigate = useNavigate();
  const [nurse, setNurse] = useState(null);
  const [shiftInfo, setShiftInfo] = useState(null);
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  const TODAY_STR = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [nRes, sRes] = await Promise.all([
        nurseAPI.getMe(),
        shiftAPI.getAssignments({ date: TODAY_STR })
      ]);
      
      const nurseData = nRes.data;
      setNurse(nurseData);
      
      // Find current shift assignment for this nurse
      const myAssignment = sRes.data?.find(a => a.nurseId === nurseData.id);
      setShiftInfo(myAssignment);

      // In a real scenario, we'd also fetch patients assigned specifically to this nurse/shift
      // For now, we'll assume a method exists or use a mock filter
      // setAssignedPatients(pRes.data);
    } catch (err) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (value) => (value ? new Date(value).toLocaleString() : '');
  const loadNotifications = async () => {
    setNotificationsLoading(true);
    try {
      const res = await notificationsAPI.list();
      setNotifications(res.data || []);
    } catch (err) {
      toast.error('Failed to load notifications');
    } finally {
      setNotificationsLoading(false);
    }
  };

  const markNotificationRead = async (id) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications((prev) => prev.map((note) => (note.id === id ? { ...note, isRead: true } : note)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (note) => {
    if (!note.isRead) {
      await markNotificationRead(note.id);
    }
    if (note.link) {
      window.open(note.link, '_blank');
    }
  };

  if (loading) return <div className="p-10 text-center">Loading Nurse Portal...</div>;

  const goToPatientHub = (focus) => () => navigate('/nurse-portal/patients', { state: focus ? { focus } : undefined });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Welcome, Nurse {nurse?.name}</h1>
          <p className={styles.subtitle}>{nurse?.specialization || 'Clinical Nursing Staff'}</p>
        </div>
        <button className="btn-secondary" onClick={loadDashboard}>Refresh</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500">
            <div className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                <span>Current Shift</span>
                <Badge type="active">{TODAY_STR}</Badge>
            </div>
            {shiftInfo ? (
                <div className="mt-2">
                    <div className="text-xl font-bold text-slate-800">{shiftInfo.shift?.name}</div>
                    <div className="text-sm text-slate-500">{shiftInfo.shift?.startTime} - {shiftInfo.shift?.endTime}</div>
                    <div className="mt-2 inline-block px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-bold uppercase">
                        Area: {shiftInfo.workArea}
                    </div>
                </div>
            ) : (
                <div className="mt-2 text-slate-400 italic text-sm">No shift assigned for today</div>
            )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-emerald-500">
            <div className="text-xs font-bold text-slate-500 uppercase">Assigned Patients</div>
            <div className="text-3xl font-bold mt-1">0</div>
            <div className="text-xs text-slate-400 mt-1 italic">Active IPD assignments</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-amber-500">
            <div className="text-xs font-bold text-slate-500 uppercase">Clinical Tasks</div>
            <div className="text-3xl font-bold mt-1">Pending</div>
            <div className="text-xs text-slate-400 mt-1 italic">Vitals & Medications</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">📋</span>
                  Quick Actions
              </h2>
              <div className="grid grid-cols-2 gap-4">
                  <button className="p-4 border-2 border-slate-50 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-all text-left group"
                          onClick={goToPatientHub()}>
                      <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">👥</div>
                      <div className="font-bold text-slate-700">My Patients</div>
                      <div className="text-xs text-slate-500">Record vitals & notes</div>
                  </button>
                  <button className="p-4 border-2 border-slate-50 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-all text-left group"
                          onClick={() => navigate('/medications')}>
                      <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">💊</div>
                      <div className="font-bold text-slate-700">Medications</div>
                      <div className="text-xs text-slate-500">Administration log</div>
                  </button>
                  <button className="p-4 border-2 border-slate-50 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-all text-left group"
                          onClick={() => navigate('/nurse-portal/leaves')}>
                      <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📅</div>
                      <div className="font-bold text-slate-700">My Leaves</div>
                      <div className="text-xs text-slate-500">Apply & Check Status</div>
                  </button>
                  <button className="p-4 border-2 border-slate-50 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-all text-left group"
                          onClick={goToPatientHub('performance')}>
                      <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📊</div>
                      <div className="font-bold text-slate-700">Performance</div>
                      <div className="text-xs text-slate-500">My clinical activity</div>
                  </button>
              </div>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">📢</span>
                  Duty Notices
              </h2>
              <div className="space-y-3">
                  {notificationsLoading ? (
                      <div className="text-sm text-slate-500">Loading notifications...</div>
                  ) : notifications.length === 0 ? (
                      <div className="text-sm text-slate-500">No notifications yet.</div>
                  ) : (
                      notifications.map((note) => {
                          const baseClass = 'w-full text-left p-4 rounded-xl border transition-colors duration-150 text-left';
                          const styleClass = note.isRead ? 'border-slate-200 bg-slate-50' : 'border-blue-200 bg-white shadow-sm';
                          return (
                              <button
                                  key={note.id}
                                  type="button"
                                  className={`${baseClass} ${styleClass}`}
                                  onClick={() => handleNotificationClick(note)}
                              >
                                  <div className="font-bold text-sm text-slate-800">{note.title}</div>
                                  <div className="text-xs text-slate-600 mt-1">{note.message}</div>
                                  <div className="text-xs text-slate-400 mt-2 text-right">{formatTimestamp(note.createdAt)}</div>
                              </button>
                          );
                      })
                  )}
              </div>
          </div>
      </div>
    </div>
  );
}
