import React, { useEffect, useState } from 'react';
import { useParams } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function PublicDoctorBooking() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const [form, setForm] = useState({
    patientName: '',
    patientPhone: '',
    patientEmail: '',
    appointmentDate: new Date().toISOString().slice(0, 10),
    appointmentTime: '10:00 AM',
    reason: '',
  });

  useEffect(() => {
    setLoading(true);
    setError('');
    axios.get(`${API_BASE}/public/doctors/${slug}`)
      .then((res) => {
        setData(res.data);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load doctor profile');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess(null);

    axios.post(`${API_BASE}/public/doctors/${slug}/book`, form)
      .then((res) => {
        setSuccess(res.data);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Booking submission failed');
      })
      .finally(() => setSubmitting(false));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-slate-500 font-medium">Loading doctor booking page...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Doctor Profile Unavailable</h2>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const { doctor, qrCodeDataUrl } = data || {};
  const { hospital } = doctor || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header / Hospital Branding */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full uppercase tracking-wider">
              {hospital?.name || 'Hospital Healthcare'}
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800">{doctor?.name}</h1>
            <p className="text-sm font-semibold text-blue-600">{doctor?.specialization}</p>
            <p className="text-xs text-slate-500">{doctor?.qualification} • {doctor?.experience || 0} years experience</p>
            {hospital?.address && (
              <p className="text-xs text-slate-400 mt-1">📍 {hospital.address}, {hospital.city}</p>
            )}
          </div>

          {qrCodeDataUrl && (
            <div className="flex flex-col items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
              <img src={qrCodeDataUrl} alt="QR Code" className="w-28 h-28 object-contain" />
              <span className="text-[10px] text-slate-400 mt-1 font-mono">Scan to Share</span>
            </div>
          )}
        </div>

        {/* Doctor Details & Consultation Fee */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 grid md:grid-cols-3 gap-4 text-center">
          <div className="bg-blue-50/50 p-4 rounded-xl">
            <div className="text-xs text-slate-500 uppercase font-semibold">Consultation Fee</div>
            <div className="text-xl font-bold text-blue-700 mt-1">Rs {Number(doctor?.consultationFee || 0).toLocaleString('en-IN')}</div>
          </div>
          <div className="bg-indigo-50/50 p-4 rounded-xl">
            <div className="text-xs text-slate-500 uppercase font-semibold">Available Days</div>
            <div className="text-xs font-bold text-indigo-700 mt-1">
              {Array.isArray(doctor?.availableDays) ? doctor.availableDays.join(', ') : 'Mon - Fri'}
            </div>
          </div>
          <div className="bg-emerald-50/50 p-4 rounded-xl">
            <div className="text-xs text-slate-500 uppercase font-semibold">OPD Hours</div>
            <div className="text-xs font-bold text-emerald-700 mt-1">{doctor?.availableFrom} - {doctor?.availableTo}</div>
          </div>
        </div>

        {/* Booking Form */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Request an Online Appointment</h2>
          <p className="text-xs text-slate-500 mb-6">No account required. Your booking will be reviewed by clinic staff.</p>

          {success ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-5 text-center space-y-2">
              <div className="text-3xl">✅</div>
              <h3 className="font-bold text-base">Appointment Request Received!</h3>
              <p className="text-xs text-emerald-700">{success.message}</p>
              <div className="text-xs font-mono bg-white inline-block px-3 py-1 rounded border border-emerald-200 mt-2">
                Booking ID: {success.appointment?.appointmentNumber} (Status: {success.appointment?.status})
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Patient Full Name *</label>
                  <input
                    type="text"
                    required
                    value={form.patientName}
                    onChange={(e) => setForm({ ...form, patientName: e.target.value })}
                    placeholder="Enter full name"
                    className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={form.patientPhone}
                    onChange={(e) => setForm({ ...form, patientPhone: e.target.value })}
                    placeholder="Enter 10-digit mobile"
                    className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={form.patientEmail}
                    onChange={(e) => setForm({ ...form, patientEmail: e.target.value })}
                    placeholder="name@example.com"
                    className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Preferred Date *</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().slice(0, 10)}
                    value={form.appointmentDate}
                    onChange={(e) => setForm({ ...form, appointmentDate: e.target.value })}
                    className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Preferred Slot</label>
                  <select
                    value={form.appointmentTime}
                    onChange={(e) => setForm({ ...form, appointmentTime: e.target.value })}
                    className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                  >
                    <option value="09:00 AM">09:00 AM</option>
                    <option value="10:00 AM">10:00 AM</option>
                    <option value="11:00 AM">11:00 AM</option>
                    <option value="02:00 PM">02:00 PM</option>
                    <option value="04:00 PM">04:00 PM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason for Visit / Symptoms</label>
                <textarea
                  rows={2}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Briefly describe health concerns or reason for consultation..."
                  className="w-full p-3 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50"
              >
                {submitting ? 'Submitting Request...' : 'Submit Booking Request'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
