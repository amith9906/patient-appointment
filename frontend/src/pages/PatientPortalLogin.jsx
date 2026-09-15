import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export default function PatientPortalLogin() {
  const [step, setStep] = useState(1); // 1: Phone, 2: Select Hospital (if multi), 3: OTP
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [hospitals, setHospitals] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRequestOtp = async (e) => {
    e?.preventDefault();
    if (!phone.trim()) {
      setError('Please enter your registered phone number');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/patient-portal/auth/request-otp`, {
        phone: phone.trim(),
        hospitalId: hospitalId || undefined,
      });

      if (res.status === 300 && res.data.hospitals?.length) {
        setHospitals(res.data.hospitals);
        setStep(2);
        setMessage(res.data.message);
      } else {
        setMessage(res.data.message || 'OTP requested successfully');
        if (res.data.devOtp) {
          setMessage(`[DEV MODE] Your OTP is: ${res.data.devOtp}`);
        }
        setStep(3);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please check phone number.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHospital = (selectedHospId) => {
    setHospitalId(selectedHospId);
    setStep(1); // Re-trigger request OTP with selected hospitalId
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    if (!otp.trim()) {
      setError('Please enter the 6-digit OTP');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/patient-portal/auth/verify-otp`, {
        phone: phone.trim(),
        otp: otp.trim(),
        hospitalId: hospitalId || undefined,
      });

      const { token, patient } = res.data;
      localStorage.setItem('patientToken', token);
      localStorage.setItem('patientUser', JSON.stringify(patient));

      navigate('/patient-portal/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600 mb-3 text-2xl font-bold">
            🩺
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Patient Portal</h1>
          <p className="text-sm text-slate-500 mt-1">Access your medical records & appointments</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-mono rounded-lg break-all">
            {message}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                Registered Mobile Number
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition duration-200 disabled:opacity-50"
            >
              {loading ? 'Sending OTP...' : 'Send Login OTP'}
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 font-medium mb-2">Multiple patient records found. Choose your hospital:</p>
            {hospitals.map((h) => (
              <button
                key={h.hospitalId}
                type="button"
                onClick={() => handleSelectHospital(h.hospitalId)}
                className="w-full text-left p-3 border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition flex justify-between items-center"
              >
                <div>
                  <div className="font-semibold text-slate-800 text-sm">{h.hospitalName}</div>
                  <div className="text-xs text-slate-500">Patient: {h.patientName}</div>
                </div>
                <span className="text-blue-600 text-sm font-semibold">Select &rarr;</span>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                Enter 6-Digit OTP
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-center text-xl tracking-widest font-mono text-slate-800"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md transition duration-200 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify OTP & Log In'}
            </button>
            <div className="text-center mt-3">
              <button
                type="button"
                onClick={() => { setStep(1); setOtp(''); }}
                className="text-xs text-slate-500 hover:text-blue-600 underline"
              >
                Change Phone Number
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
