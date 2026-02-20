import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const FEATURES = [
  { icon: '🗓️', title: 'Smart Scheduling', desc: 'Appointment booking with real-time slot availability across all doctors and departments' },
  { icon: '💊', title: 'Prescriptions & Pharmacy', desc: 'Digital prescriptions, medication inventory, and stock tracking with vendor management' },
  { icon: '🔬', title: 'Lab Management', desc: 'End-to-end lab test workflow — from order to results with PDF lab reports' },
  { icon: '🧾', title: 'Billing & PDFs', desc: 'Auto-generated medical bills, receipts and prescriptions with hospital GSTIN branding' },
  { icon: '📊', title: 'Analytics Dashboard', desc: 'Revenue trends, appointment stats, stock alerts and real-time hospital performance' },
  { icon: '🏥', title: 'Multi-Clinic Ready', desc: 'Each clinic gets its own settings, PDF templates, GSTIN and doctor signatory' },
];

const ROLES = [
  { label: 'Admin', color: 'bg-purple-100 text-purple-700' },
  { label: 'Doctor', color: 'bg-teal-100 text-teal-700' },
  { label: 'Receptionist', color: 'bg-blue-100 text-blue-700' },
  { label: 'Patient', color: 'bg-green-100 text-green-700' },
  { label: 'Lab Technician', color: 'bg-orange-100 text-orange-700' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>

      {/* ── Left: Product Showcase ── */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1d4ed8 100%)',
        padding: '48px 52px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        color: '#fff',
        minWidth: 0,
      }} className="hidden md:flex">

        {/* Logo + Product name */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <div style={{ fontSize: 36, lineHeight: 1 }}>🏥</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>MediSchedule</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Hospital Management Platform</div>
            </div>
          </div>

          <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.2, marginBottom: 12, letterSpacing: '-0.5px' }}>
            Everything your clinic<br />needs, in one place.
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', marginBottom: 36, lineHeight: 1.6, maxWidth: 420 }}>
            From patient registration to PDF prescriptions, lab reports, billing and analytics — MediSchedule runs your entire hospital workflow.
          </p>

          {/* Role pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 36 }}>
            {ROLES.map(r => (
              <span key={r.label} style={{
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                padding: '5px 14px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
              }}>{r.label}</span>
            ))}
          </div>

          {/* Feature grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 14,
                padding: '14px 16px',
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{f.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{f.title}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer tag */}
        <div style={{ marginTop: 32, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          MediSchedule · Built with Node.js + React + PostgreSQL
        </div>
      </div>

      {/* ── Right: Login Form ── */}
      <div style={{
        width: '100%',
        maxWidth: 460,
        minWidth: 320,
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 32px',
        flexShrink: 0,
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Mobile logo (hidden on md+) */}
          <div className="flex md:hidden items-center gap-3 mb-8">
            <span style={{ fontSize: 28 }}>🏥</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>MediSchedule</span>
          </div>

          <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Welcome back</h2>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 32 }}>Sign in to your hospital portal</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Email address
              </label>
              <input
                type="email" required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@hospital.com"
                style={{
                  width: '100%', padding: '11px 14px',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 10, fontSize: 14,
                  background: '#fff', outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#2563eb'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'} required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '11px 42px 11px 14px',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 10, fontSize: 14,
                    background: '#fff', outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#2563eb'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#94a3b8' }}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Submit */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6 }}>
              <Link to="/forgot-password" style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={loading} style={{
              background: loading ? '#93c5fd' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#fff', border: 'none',
              padding: '13px', borderRadius: 10,
              fontSize: 15, fontWeight: 700,
              cursor: loading ? 'default' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
              marginTop: 4,
            }}>
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>New to MediSchedule?</span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          <Link to="/register" style={{
            display: 'block', textAlign: 'center',
            padding: '12px', borderRadius: 10,
            border: '1.5px solid #e2e8f0',
            fontSize: 14, fontWeight: 600,
            color: '#374151', textDecoration: 'none',
            background: '#fff',
            transition: 'border-color 0.2s',
          }}
            onMouseOver={e => e.target.style.borderColor = '#2563eb'}
            onMouseOut={e => e.target.style.borderColor = '#e2e8f0'}
          >
            Create an account
          </Link>

          {/* Quick demo hint */}
          <div style={{
            marginTop: 28,
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 10,
            padding: '14px 16px',
            fontSize: 12,
          }}>
            <div style={{ fontWeight: 700, color: '#1d4ed8', marginBottom: 6 }}>👋 First time? Get started:</div>
            <ol style={{ color: '#3730a3', margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
              <li>Click <strong>Create an account</strong> and choose <em>Admin</em></li>
              <li>Log in and add your <strong>Hospital</strong> from the sidebar</li>
              <li>Configure GSTIN & PDF templates in <strong>Settings</strong></li>
              <li>Add doctors, create appointments — and generate PDFs!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
