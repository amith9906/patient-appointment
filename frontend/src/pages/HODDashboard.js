import React, { useState, useEffect } from 'react';
import { doctorAPI, shiftAPI } from '../services/api';
import Table from '../components/Table';
import Badge from '../components/Badge';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

export default function HODDashboard() {
  const [stats, setStats] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [nursesOnDuty, setNursesOnDuty] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, dRes, nRes] = await Promise.all([
        doctorAPI.getDeptStats(),
        doctorAPI.getDeptDoctors(),
        shiftAPI.getAssignments({ date: new Date().toISOString().split('T')[0] })
      ]);
      setStats(sRes.data);
      setDoctors(dRes.data);
      // Filter nurses by department if relevant, or just show all in the hospital
      setNursesOnDuty(nRes.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load department data. You may not be a HOD.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading department oversight...</div>;
  if (!stats) return (
    <div className="p-10 text-center">
      <h2 className="text-xl font-bold text-slate-400">Restricted Access</h2>
      <p className="text-slate-500">Only Heads of Department can view this dashboard.</p>
    </div>
  );

  const doctorColumns = [
    { header: 'Doctor Name', accessor: 'name' },
    { header: 'Specialization', accessor: 'specialization' },
    { 
      header: 'Performance (Appointments)', 
      render: (d) => {
        const dStats = stats.doctorPerformance?.find(s => s.doctorId === d.id);
        return dStats ? dStats.appointmentCount : 0;
      }
    },
    { 
      header: 'Department Admissions', 
      render: (d) => {
        const dStats = stats.doctorPerformance?.find(s => s.doctorId === d.id);
        return dStats ? dStats.admissionCount : 0;
      }
    },
    { header: 'Status', render: (d) => <Badge color={d.isActive ? 'success' : 'danger'}>{d.isActive ? 'Active' : 'Inactive'}</Badge> },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Department Oversight</h1>
          <p className={styles.pageSubtitle}>Head of Department Dashboard</p>
        </div>
        <button className={styles.btnSecondary} onClick={load}>Refresh Data</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-primary">
          <div className="text-xs font-bold text-slate-500 uppercase">Total Completed Appointments</div>
          <div className="text-3xl font-bold mt-1">{stats.summary.totalAppointments}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-success">
          <div className="text-xs font-bold text-slate-500 uppercase">Active Department Admissions</div>
          <div className="text-3xl font-bold mt-1">{stats.summary.totalActiveAdmissions}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-purple-500">
          <div className="text-xs font-bold text-slate-500 uppercase">Department Doctors</div>
          <div className="text-3xl font-bold mt-1">{doctors.length}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-warning">
          <div className="text-xs font-bold text-slate-500 uppercase">Staff-to-Patient Ratio</div>
          <div className="text-3xl font-bold mt-1">1:{(stats.summary.totalActiveAdmissions / (doctors.length || 1)).toFixed(1)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <h2 className="text-lg font-bold mb-4">Doctor Performance Matrix</h2>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <Table columns={doctorColumns} data={doctors} />
            </div>
        </div>
        <div>
            <h2 className="text-lg font-bold mb-4">Quick Stats</h2>
            <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-slate-600">Avg Appts/Doctor</span>
                    <span className="font-bold">{(stats.summary.totalAppointments / (doctors.length || 1)).toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-slate-600">IPD Load</span>
                    <Badge color={stats.summary.totalActiveAdmissions > 10 ? 'danger' : 'success'}>
                        {stats.summary.totalActiveAdmissions > 10 ? 'High' : 'Normal'}
                    </Badge>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-slate-600">Clinical Audit Total</span>
                    <span className="font-bold">{(stats.audit?.vitalsCount || 0) + (stats.audit?.medicationAdminCount || 0)}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-slate-600">Compliance Index</span>
                    <span className={`font-bold ${stats.audit?.complianceScore > 5 ? 'text-success' : 'text-warning'}`}>
                        {stats.audit?.complianceScore || 0}
                    </span>
                </div>
                <div className="mt-4 p-4 bg-slate-50 rounded-lg text-sm text-slate-600 italic">
                    Note: Audit index is calculated based on vitals and medication logs per admission.
                </div>
            </div>

            <h2 className="text-lg font-bold mt-8 mb-4">Nursing Workforce (On-Duty)</h2>
            <div className="bg-white p-6 rounded-xl shadow-sm space-y-3">
                {nursesOnDuty.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-sm">No nursing staff on duty today</div>
                ) : (
                    nursesOnDuty.slice(0, 10).map(a => (
                        <div key={a.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                                    {a.nurse?.name?.charAt(0)}
                                </div>
                                <div>
                                    <div className="text-sm font-semibold">{a.nurse?.name}</div>
                                    <div className="text-xs text-slate-500">{a.shift?.name}</div>
                                </div>
                            </div>
                            <Badge color="info">{a.workArea}</Badge>
                        </div>
                    ))
                )}
                {nursesOnDuty.length > 10 && (
                    <div className="text-center text-xs text-slate-400 pt-2 border-t">Show more available in Shift Management</div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
