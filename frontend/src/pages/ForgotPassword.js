import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { toast } from 'react-toastify';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', otp: '', newPassword: '', confirmPassword: '' });

  const sendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.sendForgotPasswordOtp({ email: form.email });
      toast.success('OTP sent to your email');
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    setLoading(true);
    try {
      await authAPI.resetPasswordWithOtp({
        email: form.email,
        otp: form.otp,
        newPassword: form.newPassword,
      });
      toast.success('Password reset successful. Please login.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Forgot Password</h2>
        <p className="text-sm text-gray-500 mb-6">Reset your password using OTP sent to your email.</p>

        {step === 1 ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} disabled className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">OTP</label>
              <input
                type="text"
                required
                value={form.otp}
                onChange={(e) => setForm({ ...form, otp: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Enter 6-digit OTP"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full h-10 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
          </form>
        )}

        <div className="mt-5 text-center text-sm">
          <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
