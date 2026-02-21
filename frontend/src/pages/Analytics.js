import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { appointmentAPI, expenseAPI, patientAPI } from '../services/api';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#64748b'];

const ICON_BY_KEY = {
  Bills: '🧾',
  Revenue: '📈',
  Done: '✅',
  Pending: '⏳',
  Health: '🩺',
  Hospital: '🏥',
  Calendar: '📅',
  Report: '📄',
  Bundle: '🧩',
  Rs: '₹',
};

const resolveIcon = (icon) => ICON_BY_KEY[icon] || icon || '•';

const currency = (val) => `Rs ${Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function Analytics() {
  const [data, setData] = useState(null);
  const [expData, setExpData] = useState(null);
  const [refData, setRefData] = useState(null);
  const [ptData, setPtData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [appliedRange, setAppliedRange] = useState({ from: '', to: '' });
  const [tab, setTab] = useState('billing');
  const [referralSource, setReferralSource] = useState('');
  const [appliedReferralSource, setAppliedReferralSource] = useState('');

  const loadAnalytics = (range = appliedRange, source = appliedReferralSource) => {
    setLoading(true);
    const commonParams = {};
    if (range.from) commonParams.from = range.from;
    if (range.to) commonParams.to = range.to;
    const referralParams = { ...commonParams };
    if (source) referralParams.referralSource = source;

    Promise.all([
      appointmentAPI.getAnalytics(commonParams),
      expenseAPI.getAnalytics(commonParams).catch(() => ({ data: null })),
      patientAPI.getReferralAnalytics(referralParams).catch(() => ({ data: null })),
      appointmentAPI.getPatientAnalytics(commonParams).catch(() => ({ data: null })),
    ])
      .then(([apptRes, expRes, refRes, ptRes]) => {
        setData(apptRes.data);
        setExpData(expRes.data);
        setRefData(refRes.data);
        setPtData(ptRes.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAnalytics({ from: '', to: '' }, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doctorPie = useMemo(() => {
    if (!data?.doctorWise?.length) return [];
    return data.doctorWise.slice(0, 8).map((d) => ({ name: d.doctorName, value: Number(d.amount || 0) }));
  }, [data]);

  if (loading) {
    return <div className="flex justify-center p-20"><div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;
  }

  const summary = data.summary || {
    totalBills: 0,
    totalAmount: 0,
    totalConsultationAmount: 0,
    totalTreatmentAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
  };
  const overallRevenue = data.overallRevenue || {
    totalAmount: summary.totalAmount,
    totalConsultationAmount: summary.totalConsultationAmount,
    totalTreatmentAmount: summary.totalTreatmentAmount,
    paidAmount: summary.paidAmount,
    pendingAmount: summary.pendingAmount,
    collectionRate: 0,
  };
  const dayWise = data.dayWise || [];
  const weekWise = data.weekWise || [];
  const monthWise = data.monthWise || [];
  const referralRows = refData?.bySource || [];
  const referralDoctorRows = refData?.byDoctorSource || [];
  const referralDoctorMonthlyRows = refData?.byDoctorSourceMonthly || [];
  const availableReferralSources = referralRows.map((r) => r.referralSource).filter(Boolean);
  const doctorWise = data.doctorWise || [];
  const categoryWise = data.categoryWise || [];
  const referralSummary = referralRows.reduce((acc, r) => ({
    totalPatients: acc.totalPatients + Number(r.totalPatients || 0),
    appointments: acc.appointments + Number(r.appointments || 0),
    completed: acc.completed + Number(r.completed || 0),
    cancelled: acc.cancelled + Number(r.cancelled || 0),
    noShow: acc.noShow + Number(r.noShow || 0),
    revenue: acc.revenue + Number(r.revenue || 0),
  }), { totalPatients: 0, appointments: 0, completed: 0, cancelled: 0, noShow: 0, revenue: 0 });
  const referralConversionPct = referralSummary.appointments > 0
    ? (referralSummary.completed / referralSummary.appointments) * 100
    : 0;
  const latestDay = dayWise[dayWise.length - 1] || { label: 'N/A', amount: 0, paidAmount: 0, pendingAmount: 0 };
  const latestWeek = weekWise[weekWise.length - 1] || { label: 'N/A', amount: 0, paidAmount: 0, pendingAmount: 0 };
  const latestMonth = monthWise[monthWise.length - 1] || { label: 'N/A', amount: 0, paidAmount: 0, pendingAmount: 0 };

  const onApplyFilter = () => {
    const nextRange = { from, to };
    setAppliedRange(nextRange);
    setAppliedReferralSource(referralSource);
    loadAnalytics(nextRange, referralSource);
  };

  const onResetFilter = () => {
    const nextRange = { from: '', to: '' };
    setFrom('');
    setTo('');
    setReferralSource('');
    setAppliedReferralSource('');
    setAppliedRange(nextRange);
    loadAnalytics(nextRange, '');
  };

  const downloadCsv = (filename, header, rows) => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportRevenueCsv = () => {
    downloadCsv(
      `billing-revenue-${appliedRange.from || 'start'}-to-${appliedRange.to || 'end'}.csv`,
      ['Period', 'Label', 'Bills', 'Amount', 'Consultation', 'Treatment', 'Collected', 'Pending'],
      [
        ...dayWise.map((r) => ['Day', r.label, r.bills, r.amount, r.consultationAmount, r.treatmentAmount, r.paidAmount, r.pendingAmount]),
        ...weekWise.map((r) => ['Week', r.label, r.bills, r.amount, r.consultationAmount, r.treatmentAmount, r.paidAmount, r.pendingAmount]),
        ...monthWise.map((r) => ['Month', r.label, r.bills, r.amount, r.consultationAmount, r.treatmentAmount, r.paidAmount, r.pendingAmount]),
      ]
    );
  };

  const exportReferralCsv = () => {
    downloadCsv(
      `referral-analytics-${appliedRange.from || 'start'}-to-${appliedRange.to || 'end'}.csv`,
      ['Source', 'Patients', 'Appointments', 'Completed', 'Cancelled', 'No Show', 'Conversion %', 'Revenue'],
      referralRows.map((r) => [
        r.referralSource,
        r.totalPatients,
        r.appointments,
        r.completed,
        r.cancelled,
        r.noShow,
        Number(r.appointmentToCompletePct || 0).toFixed(1),
        r.revenue,
      ])
    );
  };

  const StatCard = ({ label, value, icon, sub, color }) => (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-3" style={{ background: `${color}20`, color }}>{resolveIcon(icon)}</div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-800">Analytics</h2>

      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[['billing', 'Billing & Revenue'], ['patients', 'Patient Insights']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: '1px solid',
              borderColor: tab === key ? '#2563eb' : '#e2e8f0',
              background: tab === key ? '#2563eb' : 'white',
              color: tab === key ? 'white' : '#374151',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >{label}</button>
        ))}
      </div>

      {/* ── Shared date filter ─── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 px-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 px-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <button
            type="button"
            onClick={onApplyFilter}
            className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={onResetFilter}
            className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reset
          </button>
          <select
            value={referralSource}
            onChange={(e) => setReferralSource(e.target.value)}
            className="h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
            style={{ minWidth: 200 }}
          >
            <option value="">All Referral Sources</option>
            {availableReferralSources.map((src) => (
              <option key={src} value={src}>{src}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={exportRevenueCsv}
            className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Export Revenue CSV
          </button>
          <button
            type="button"
            onClick={exportReferralCsv}
            className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Export Referral CSV
          </button>
        </div>
        {(appliedRange.from || appliedRange.to) && (
          <div className="text-xs text-gray-500 mt-2">
            Showing range: {appliedRange.from || 'Beginning'} to {appliedRange.to || 'Today'}
          </div>
        )}
        {appliedReferralSource && (
          <div className="text-xs text-gray-500 mt-1">
            Referral source filter: {appliedReferralSource}
          </div>
        )}
      </div>

      {tab === 'billing' && (<>

      {/* ── Profit Overview ─────────────────────────────────────────────────── */}
      {expData && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Profit Overview</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <div className="text-xs text-blue-500 font-medium uppercase tracking-wide mb-1">Total Revenue</div>
              <div className="text-2xl font-bold text-blue-700">{currency(summary.totalAmount)}</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <div className="text-xs text-red-500 font-medium uppercase tracking-wide mb-1">Total Expenses</div>
              <div className="text-2xl font-bold text-red-600">{currency(expData.totalExpenses)}</div>
            </div>
            <div className={`rounded-xl p-4 text-center ${(summary.totalAmount - expData.totalExpenses) >= 0 ? 'bg-green-50' : 'bg-orange-50'}`}>
              <div className={`text-xs font-medium uppercase tracking-wide mb-1 ${(summary.totalAmount - expData.totalExpenses) >= 0 ? 'text-green-500' : 'text-orange-500'}`}>Net Profit</div>
              <div className={`text-2xl font-bold ${(summary.totalAmount - expData.totalExpenses) >= 0 ? 'text-green-700' : 'text-orange-600'}`}>
                {currency(summary.totalAmount - expData.totalExpenses)}
              </div>
            </div>
          </div>

          {/* Revenue vs Expenses by Month */}
          {(monthWise.length > 0 || expData.monthWise.length > 0) && (() => {
            const allMonths = Array.from(new Set([
              ...monthWise.map(m => m.month || m.label),
              ...(expData.monthWise || []).map(m => m.month),
            ])).sort();
            const revByMonth = Object.fromEntries(monthWise.map(m => [m.month || m.label, Number(m.amount || 0)]));
            const expByMonth = Object.fromEntries((expData.monthWise || []).map(m => [m.month, Number(m.total || 0)]));
            const chartData = allMonths.map(m => ({
              label: expData.monthWise.find(x => x.month === m).label || monthWise.find(x => (x.month || x.label) === m).label || m,
              revenue: revByMonth[m] || 0,
              expenses: expByMonth[m] || 0,
            }));
            return (
              <div>
                <div className="text-xs text-gray-400 uppercase font-medium mb-2 mt-2">Revenue vs Expenses by Month</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `Rs ${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(val) => currency(val)} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#2563eb" radius={[3,3,0,0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#dc2626" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Overall Bills" value={summary.totalBills} icon="Bills" color="#2563eb" />
        <StatCard label="Overall Amount" value={currency(summary.totalAmount)} icon="Revenue" color="#16a34a" />
        <StatCard label="Collected" value={currency(summary.paidAmount)} icon="Done" color="#0891b2" />
        <StatCard label="Pending" value={currency(summary.pendingAmount)} icon="Pending" color="#d97706" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard label="Consultation Revenue" value={currency(summary.totalConsultationAmount)} icon="Health" color="#0f766e" />
        <StatCard label="Treatment Revenue" value={currency(summary.totalTreatmentAmount)} icon="Hospital" color="#b45309" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-700 mb-4">Overall Revenue Details</h3>
        <div className="overflow-x-auto mb-5">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Total Revenue</th>
                <th className="py-2 pr-4">Consultation</th>
                <th className="py-2 pr-4">Treatment</th>
                <th className="py-2 pr-4">Collected</th>
                <th className="py-2 pr-4">Pending</th>
                <th className="py-2">Collection Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 pr-4">{currency(overallRevenue.totalAmount)}</td>
                <td className="py-2 pr-4">{currency(overallRevenue.totalConsultationAmount)}</td>
                <td className="py-2 pr-4">{currency(overallRevenue.totalTreatmentAmount)}</td>
                <td className="py-2 pr-4 text-emerald-700">{currency(overallRevenue.paidAmount)}</td>
                <td className="py-2 pr-4 text-amber-700">{currency(overallRevenue.pendingAmount)}</td>
                <td className="py-2">{Number(overallRevenue.collectionRate || 0).toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="font-semibold text-gray-700 mb-4">Revenue by Period</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Period</th>
                <th className="py-2 pr-4">Label</th>
                <th className="py-2 pr-4">Total Revenue</th>
                <th className="py-2 pr-4">Collected</th>
                <th className="py-2">Pending</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 pr-4 font-medium text-gray-700">Day</td>
                <td className="py-2 pr-4">{latestDay.label}</td>
                <td className="py-2 pr-4">{currency(latestDay.amount)}</td>
                <td className="py-2 pr-4 text-emerald-700">{currency(latestDay.paidAmount)}</td>
                <td className="py-2 text-amber-700">{currency(latestDay.pendingAmount)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4 font-medium text-gray-700">Week</td>
                <td className="py-2 pr-4">{latestWeek.label}</td>
                <td className="py-2 pr-4">{currency(latestWeek.amount)}</td>
                <td className="py-2 pr-4 text-emerald-700">{currency(latestWeek.paidAmount)}</td>
                <td className="py-2 text-amber-700">{currency(latestWeek.pendingAmount)}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-gray-700">Month</td>
                <td className="py-2 pr-4">{latestMonth.label}</td>
                <td className="py-2 pr-4">{currency(latestMonth.amount)}</td>
                <td className="py-2 pr-4 text-emerald-700">{currency(latestMonth.paidAmount)}</td>
                <td className="py-2 text-amber-700">{currency(latestMonth.pendingAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Day-wise (Last 14 Days)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dayWise}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="bills" stroke="#2563eb" strokeWidth={2} name="Bills" />
              <Line yAxisId="right" type="monotone" dataKey="amount" stroke="#16a34a" strokeWidth={2} name="Amount" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Weekly (Last 12 Weeks)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={weekWise}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="bills" fill="#9333ea" name="Bills" radius={[4, 4, 0, 0]} />
              <Bar dataKey="amount" fill="#0891b2" name="Amount" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-700 mb-4">Treatment vs Consultation Revenue (Day-wise)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dayWise}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => currency(value)} />
            <Legend />
            <Bar dataKey="consultationAmount" fill="#0f766e" name="Consultation" radius={[4, 4, 0, 0]} />
            <Bar dataKey="treatmentAmount" fill="#b45309" name="Treatment" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Monthly (Last 12 Months)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthWise}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="amount" stroke="#dc2626" strokeWidth={2} name="Amount" />
              <Line type="monotone" dataKey="bills" stroke="#2563eb" strokeWidth={2} name="Bills" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Revenue by Category</h3>
          {categoryWise.length === 0 ? (
            <div className="text-sm text-gray-500">No itemized bill data available.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={categoryWise.map(c => ({ name: c.category.replace(/_/g, ' '), value: c.total }))}
                  cx="50%" cy="50%" outerRadius={90} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false} style={{ fontSize: 10 }}>
                  {categoryWise.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => currency(value)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Revenue Share by Doctor</h3>
          {doctorPie.length === 0 ? (
            <div className="text-sm text-gray-500">No doctor billing data available.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={doctorPie}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  style={{ fontSize: 10 }}
                >
                  {doctorPie.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => currency(value)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-700 mb-4">Referral Conversion Analytics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label="Referral Patients" value={referralSummary.totalPatients} icon="Patients" color="#2563eb" />
          <StatCard label="Referral Appointments" value={referralSummary.appointments} icon="Appointments" color="#0891b2" />
          <StatCard label="Completed Referrals" value={referralSummary.completed} icon="Done" color="#16a34a" />
          <StatCard
            label="Referral Conversion"
            value={`${Number(referralConversionPct || 0).toFixed(1)}%`}
            icon="Rate"
            color="#d97706"
            sub={`Revenue: ${currency(referralSummary.revenue)}`}
          />
        </div>
        {refData ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              {[
                ['Sources', refData.summary?.totalSources || 0],
                ['Patients', refData.summary?.totalPatients || 0],
                ['Appointments', refData.summary?.totalAppointments || 0],
                ['Completed', refData.summary?.completedAppointments || 0],
                ['Revenue', currency(refData.summary?.totalRevenue || 0)],
              ].map(([label, value]) => (
                <div key={label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-lg font-bold text-slate-800">{value}</div>
                  <div className="text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4">Source</th>
                    <th className="py-2 pr-4">Patients</th>
                    <th className="py-2 pr-4">Appointments</th>
                    <th className="py-2 pr-4">Completed</th>
                    <th className="py-2 pr-4">Cancelled</th>
                    <th className="py-2 pr-4">No Show</th>
                    <th className="py-2 pr-4">Conv %</th>
                    <th className="py-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {referralRows.map((r) => (
                    <tr key={r.referralSource} className="border-b">
                      <td className="py-2 pr-4 font-medium">{r.referralSource}</td>
                      <td className="py-2 pr-4">{r.totalPatients}</td>
                      <td className="py-2 pr-4">{r.appointments}</td>
                      <td className="py-2 pr-4 text-emerald-700">{r.completed}</td>
                      <td className="py-2 pr-4 text-amber-700">{r.cancelled}</td>
                      <td className="py-2 pr-4 text-rose-700">{r.noShow}</td>
                      <td className="py-2 pr-4">{Number(r.appointmentToCompletePct || 0).toFixed(1)}%</td>
                      <td className="py-2">{currency(r.revenue || 0)}</td>
                    </tr>
                  ))}
                  {referralRows.length === 0 && (
                    <tr><td colSpan={8} className="py-3 text-gray-500">No referral data found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-500">Referral analytics unavailable.</div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-700 mb-4">Referral Drill-down by Doctor</h3>
        {!refData ? (
          <div className="text-sm text-gray-500">Referral drill-down unavailable.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Doctor</th>
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-4">Appointments</th>
                  <th className="py-2 pr-4">Completed</th>
                  <th className="py-2 pr-4">Cancelled</th>
                  <th className="py-2 pr-4">No Show</th>
                  <th className="py-2 pr-4">Conversion %</th>
                  <th className="py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {referralDoctorRows.slice(0, 50).map((r, idx) => (
                  <tr key={`${r.doctorId}-${r.referralSource}-${idx}`} className="border-b">
                    <td className="py-2 pr-4 font-medium">{r.doctorName}</td>
                    <td className="py-2 pr-4">{r.referralSource}</td>
                    <td className="py-2 pr-4">{r.appointments}</td>
                    <td className="py-2 pr-4 text-emerald-700">{r.completed}</td>
                    <td className="py-2 pr-4 text-amber-700">{r.cancelled}</td>
                    <td className="py-2 pr-4 text-rose-700">{r.noShow}</td>
                    <td className="py-2 pr-4">{Number(r.conversionPct || 0).toFixed(1)}%</td>
                    <td className="py-2">{currency(r.revenue || 0)}</td>
                  </tr>
                ))}
                {referralDoctorRows.length === 0 && (
                  <tr><td colSpan={8} className="py-3 text-gray-500">No referral doctor drill-down data found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-700 mb-4">Monthly Referral Trend by Doctor + Source</h3>
        {!refData ? (
          <div className="text-sm text-gray-500">Monthly referral trend unavailable.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Month</th>
                  <th className="py-2 pr-4">Doctor</th>
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-4">Appointments</th>
                  <th className="py-2 pr-4">Completed</th>
                  <th className="py-2 pr-4">Conversion %</th>
                  <th className="py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {referralDoctorMonthlyRows.slice(0, 120).map((r, idx) => (
                  <tr key={`${r.month}-${r.doctorId}-${r.referralSource}-${idx}`} className="border-b">
                    <td className="py-2 pr-4">{r.month || '-'}</td>
                    <td className="py-2 pr-4 font-medium">{r.doctorName}</td>
                    <td className="py-2 pr-4">{r.referralSource}</td>
                    <td className="py-2 pr-4">{r.appointments}</td>
                    <td className="py-2 pr-4 text-emerald-700">{r.completed}</td>
                    <td className="py-2 pr-4">{Number(r.conversionPct || 0).toFixed(1)}%</td>
                    <td className="py-2">{currency(r.revenue || 0)}</td>
                  </tr>
                ))}
                {referralDoctorMonthlyRows.length === 0 && (
                  <tr><td colSpan={7} className="py-3 text-gray-500">No monthly referral drill-down data found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-700 mb-4">Doctor-wise Revenue</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Doctor</th>
                <th className="py-2 pr-4">Bills</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Consultation</th>
                <th className="py-2 pr-4">Treatment</th>
                <th className="py-2 pr-4">Collected</th>
                <th className="py-2 pr-4">Pending</th>
                <th className="py-2 pr-4">Contribution</th>
                <th className="py-2">Collection Rate</th>
              </tr>
            </thead>
            <tbody>
              {doctorWise.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-4 text-gray-500">No billing records found.</td>
                </tr>
              ) : (
                doctorWise.map((item) => (
                  <tr key={item.doctorId} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium text-gray-700">{item.doctorName}</td>
                    <td className="py-2 pr-4">{item.bills}</td>
                    <td className="py-2 pr-4">{currency(item.amount)}</td>
                    <td className="py-2 pr-4">{currency(item.consultationAmount)}</td>
                    <td className="py-2 pr-4">{currency(item.treatmentAmount)}</td>
                    <td className="py-2 pr-4 text-emerald-700">{currency(item.paidAmount)}</td>
                    <td className="py-2 pr-4 text-amber-700">{currency(item.pendingAmount)}</td>
                    <td className="py-2 pr-4">{Number(item.contributionPct || 0).toFixed(2)}%</td>
                    <td className="py-2">{Number(item.collectionRate || 0).toFixed(2)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      </>)}

      {/* ── Patient Insights tab ────────────────────────────────────────────── */}
      {tab === 'patients' && (
        <PatientInsights ptData={ptData} />
      )}

    </div>
  );
}

function PatientInsights({ ptData }) {
  if (!ptData) return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading patient insights…</div>;

  const s = ptData.summary || {};
  const newVsMonth  = ptData.newVsReturningByMonth  || [];
  const newVsWeek   = ptData.newVsReturningByWeek   || [];
  const byDept      = ptData.byDepartment           || [];
  const byDeptMonth = ptData.byDeptMonth            || [];
  const topDiag     = ptData.topDiagnoses           || [];
  const byTypeMonth = ptData.byTypeMonth            || [];
  const byHospital  = ptData.byHospital             || [];
  const top5Depts   = ptData.top5Depts              || [];

  const DEPT_COLORS  = ['#2563eb','#16a34a','#d97706','#9333ea','#dc2626'];
  const TYPE_COLORS  = { consultation:'#2563eb', follow_up:'#16a34a', emergency:'#dc2626', routine_checkup:'#0891b2', lab_test:'#9333ea' };

  // Build stacked dept-by-month data
  const allMonths = [...new Set(newVsMonth.map(m => m.month))].sort();
  const deptMonthRows = allMonths.map(m => {
    const row = { month: m };
    top5Depts.forEach(dept => {
      const entry = byDeptMonth.find(d => d.department === dept);
      row[dept] = entry?.data.find(x => x.month === m)?.count || 0;
    });
    return row;
  });

  // Build stacked type-by-month data
  const allTypes = [...new Set(byTypeMonth.map(t => t.type))];
  const typeMonthRows = allMonths.map(m => {
    const row = { month: m };
    allTypes.forEach(type => {
      const entry = byTypeMonth.find(t => t.type === type && t.month === m);
      row[type] = entry?.count || 0;
    });
    return row;
  });

  const cardStyle = (bg, color) => ({
    background: bg, borderRadius: 12, padding: '16px 20px', textAlign: 'center',
    border: `1px solid ${color}40`,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Appointments', value: s.totalAppointments || 0, bg: '#eff6ff', color: '#2563eb' },
          { label: 'Unique Patients',    value: s.totalUniquePatients || 0, bg: '#f0fdf4', color: '#16a34a' },
          { label: 'New Patients',       value: s.newPatients || 0,         bg: '#fef3c7', color: '#d97706' },
          { label: 'Returning Patients', value: s.returningPatients || 0,   bg: '#fdf4ff', color: '#9333ea' },
          { label: 'Retention Rate',     value: `${s.retentionRate || 0}%`, bg: '#fff1f2', color: '#dc2626' },
        ].map(({ label, value, bg, color }) => (
          <div key={label} style={cardStyle(bg, color)}>
            <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* New vs Returning by Month */}
      {newVsMonth.length > 0 && (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 14, color: '#374151' }}>New vs Returning Patients — Monthly</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={newVsMonth} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="new"       name="New"       fill="#2563eb" radius={[4,4,0,0]} stackId="a" />
              <Bar dataKey="returning" name="Returning"  fill="#9333ea" radius={[4,4,0,0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* New vs Returning by Week */}
      {newVsWeek.length > 0 && (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 14, color: '#374151' }}>New vs Returning Patients — Weekly</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={newVsWeek} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="new"       name="New"      fill="#0891b2" radius={[4,4,0,0]} stackId="a" />
              <Bar dataKey="returning" name="Returning" fill="#16a34a" radius={[4,4,0,0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Department-wise totals */}
        {byDept.length > 0 && (
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 14, color: '#374151' }}>Appointments by Department</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byDept} layout="vertical" margin={{ top: 0, right: 16, left: 80, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="department" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="count" name="Appointments" fill="#2563eb" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top 15 Diagnoses */}
        {topDiag.length > 0 && (
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 14, color: '#374151' }}>Top Diagnoses / Conditions</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topDiag} layout="vertical" margin={{ top: 0, right: 16, left: 110, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="diagnosis" type="category" tick={{ fontSize: 10 }} width={110} />
                <Tooltip />
                <Bar dataKey="count" name="Cases" fill="#dc2626" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top 5 Departments by Month — stacked */}
      {deptMonthRows.length > 0 && top5Depts.length > 0 && (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 14, color: '#374151' }}>Top 5 Departments — Monthly Trend</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={deptMonthRows} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              {top5Depts.map((dept, i) => (
                <Bar key={dept} dataKey={dept} stackId="d" fill={DEPT_COLORS[i % DEPT_COLORS.length]} radius={i === top5Depts.length - 1 ? [4,4,0,0] : [0,0,0,0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Appointment Type by Month */}
      {typeMonthRows.length > 0 && allTypes.length > 0 && (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 14, color: '#374151' }}>Appointment Types — Monthly</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={typeMonthRows} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              {allTypes.map((type, i) => (
                <Bar key={type} dataKey={type} name={type.replace(/_/g, ' ')} stackId="t"
                  fill={TYPE_COLORS[type] || DEPT_COLORS[i % DEPT_COLORS.length]}
                  radius={i === allTypes.length - 1 ? [4,4,0,0] : [0,0,0,0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Hospital comparison (super_admin) */}
      {byHospital.length > 1 && (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 14, color: '#374151' }}>Appointments by Hospital</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byHospital} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Appointments" fill="#0891b2" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top diagnoses table */}
      {topDiag.length > 0 && (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 14, color: '#374151' }}>Diagnosis Detail — Monthly Breakdown</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Diagnosis</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>Total Cases</th>
                  {allMonths.map(m => (
                    <th key={m} style={{ padding: '8px 8px', textAlign: 'right', color: '#6b7280', fontWeight: 600, fontSize: 11 }}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topDiag.map((d, i) => (
                  <tr key={d.diagnosis} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '7px 12px', fontWeight: 500, textTransform: 'capitalize' }}>{d.diagnosis}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{d.count}</td>
                    {allMonths.map(m => (
                      <td key={m} style={{ padding: '7px 8px', textAlign: 'right', fontSize: 12, color: '#374151' }}>
                        {d.byMonth?.find(x => x.month === m)?.count || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

