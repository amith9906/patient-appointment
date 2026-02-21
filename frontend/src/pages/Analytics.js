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
import { appointmentAPI } from '../services/api';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#64748b'];

const currency = (val) => `₹${Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [appliedRange, setAppliedRange] = useState({ from: '', to: '' });

  const loadAnalytics = (range = appliedRange) => {
    setLoading(true);
    const params = {};
    if (range.from) params.from = range.from;
    if (range.to) params.to = range.to;

    appointmentAPI.getAnalytics(params)
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAnalytics({ from: '', to: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doctorPie = useMemo(() => {
    if (!data?.doctorWise?.length) return [];
    return data.doctorWise.slice(0, 8).map((d) => ({ name: d.doctorName, value: Number(d.amount || 0) }));
  }, [data]);

  if (loading) {
    return <div className="flex justify-center p-20"><div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;
  }

  const summary = data?.summary || {
    totalBills: 0,
    totalAmount: 0,
    totalConsultationAmount: 0,
    totalTreatmentAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
  };
  const overallRevenue = data?.overallRevenue || {
    totalAmount: summary.totalAmount,
    totalConsultationAmount: summary.totalConsultationAmount,
    totalTreatmentAmount: summary.totalTreatmentAmount,
    paidAmount: summary.paidAmount,
    pendingAmount: summary.pendingAmount,
    collectionRate: 0,
  };
  const dayWise = data?.dayWise || [];
  const weekWise = data?.weekWise || [];
  const monthWise = data?.monthWise || [];
  const doctorWise = data?.doctorWise || [];
  const categoryWise = data?.categoryWise || [];
  const latestDay = dayWise[dayWise.length - 1] || { label: 'N/A', amount: 0, paidAmount: 0, pendingAmount: 0 };
  const latestWeek = weekWise[weekWise.length - 1] || { label: 'N/A', amount: 0, paidAmount: 0, pendingAmount: 0 };
  const latestMonth = monthWise[monthWise.length - 1] || { label: 'N/A', amount: 0, paidAmount: 0, pendingAmount: 0 };

  const onApplyFilter = () => {
    const nextRange = { from, to };
    setAppliedRange(nextRange);
    loadAnalytics(nextRange);
  };

  const onResetFilter = () => {
    const nextRange = { from: '', to: '' };
    setFrom('');
    setTo('');
    setAppliedRange(nextRange);
    loadAnalytics(nextRange);
  };

  const StatCard = ({ label, value, icon, sub, color }) => (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-3" style={{ background: `${color}20`, color }}>{icon}</div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-800">Billing Analytics</h2>

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
        </div>
        {(appliedRange.from || appliedRange.to) && (
          <div className="text-xs text-gray-500 mt-2">
            Showing range: {appliedRange.from || 'Beginning'} to {appliedRange.to || 'Today'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Overall Bills" value={summary.totalBills} icon="🧾" color="#2563eb" />
        <StatCard label="Overall Amount" value={currency(summary.totalAmount)} icon="💰" color="#16a34a" />
        <StatCard label="Collected" value={currency(summary.paidAmount)} icon="✅" color="#0891b2" />
        <StatCard label="Pending" value={currency(summary.pendingAmount)} icon="⏳" color="#d97706" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard label="Consultation Revenue" value={currency(summary.totalConsultationAmount)} icon="🩺" color="#0f766e" />
        <StatCard label="Treatment Revenue" value={currency(summary.totalTreatmentAmount)} icon="🏥" color="#b45309" />
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
    </div>
  );
}
