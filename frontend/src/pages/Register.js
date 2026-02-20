import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { toast } from 'react-toastify';

const ROLES = [
  { value: 'patient', label: '🧑‍🤝‍🧑 Patient', desc: 'Book appointments, view prescriptions & reports' },
  { value: 'doctor', label: '👨‍⚕️ Doctor', desc: 'Manage schedule, write prescriptions, view patients' },
  { value: 'receptionist', label: '🖥️ Receptionist', desc: 'Manage appointments, register patients' },
  { value: 'lab_technician', label: '🔬 Lab Technician', desc: 'Process lab tests, upload results' },
  { value: 'admin', label: '⚙️ Admin', desc: 'Full access — manage hospital, staff & settings' },
];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'patient',
    phone: '', dateOfBirth: '', gender: '',
  });
  const [loading, setLoading] = useState(false);

  const isPatient = form.role === 'patient';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { name: form.name, email: form.email, password: form.password, role: form.role };
      if (isPatient) {
        if (form.phone) payload.phone = form.phone;
        if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
        if (form.gender) payload.gender = form.gender;
      }
      await authAPI.register(payload);
      toast.success('Account created! Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const set = (k, v) => setForm({ ...form, [k]: v });

  const inputStyle = {
    width: '100%', padding: '11px 14px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 10, fontSize: 14,
    background: '#fff', outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>

      {/* ── Left Panel ── */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #059669 100%)',
        padding: '48px 52px',
        flexDirection: 'column',
        justifyContent: 'space-between',
        color: '#fff',
        minWidth: 0,
      }} className="hidden md:flex">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <div style={{ fontSize: 36 }}>🏥</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>MediSchedule</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Hospital Management Platform</div>
            </div>
          </div>

          <h1 style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.25, marginBottom: 16, letterSpacing: '-0.3px' }}>
            Join your hospital's<br />digital platform
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 40, lineHeight: 1.7, maxWidth: 380 }}>
            Whether you're a patient booking your first appointment or an admin setting up a new clinic — it all starts here.
          </p>

          {/* Role cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ROLES.map(r => (
              <div key={r.value} style={{
                background: form.role === r.value ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)',
                border: `1.5px solid ${form.role === r.value ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 12,
                padding: '12px 16px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }} onClick={() => set('role', r.value)}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{r.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 32, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
          MediSchedule · Secure · Multi-tenant · HIPAA-ready
        </div>
      </div>

      {/* ── Right: Form ── */}
      <div style={{
        width: '100%',
        maxWidth: 480,
        minWidth: 0,
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 18px',
        flexShrink: 0,
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div className="flex md:hidden items-center gap-3 mb-8">
            <span style={{ fontSize: 28 }}>🏥</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>MediSchedule</span>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Create your account</h2>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 28 }}>Fill in the details below to get started</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Role selector (mobile only) */}
            <div className="md:hidden">
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Role</label>
              <select value={form.role} onChange={e => set('role', e.target.value)} style={{ ...inputStyle }}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            {/* Selected role badge (desktop) */}
            <div className="hidden md:flex items-center gap-2">
              <div style={{ fontSize: 12, color: '#64748b' }}>Registering as:</div>
              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe',
                color: '#1d4ed8', padding: '4px 12px', borderRadius: 999,
                fontSize: 12, fontWeight: 700,
              }}>
                {ROLES.find(r => r.value === form.role)?.label}
              </div>
            </div>

            {/* Full name */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Full Name *</label>
              <input type="text" required value={form.name} onChange={e => set('name', e.target.value)}
                placeholder={isPatient ? 'Your full name' : 'Dr. John Smith'}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#2563eb'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
            </div>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email Address *</label>
              <input type="email" required value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="you@example.com" style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#2563eb'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password *</label>
              <input type="password" required minLength={6} value={form.password} onChange={e => set('password', e.target.value)}
                placeholder="Min 6 characters" style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#2563eb'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
            </div>

            {/* Patient extra fields */}
            {isPatient && (
              <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>Patient Information (optional)</div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Phone Number</label>
                  <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                    placeholder="+91 98765 43210" style={{ ...inputStyle, fontSize: 13 }}
                    onFocus={e => e.target.style.borderColor = '#16a34a'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Date of Birth</label>
                    <input type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      style={{ ...inputStyle, fontSize: 13 }}
                      onFocus={e => e.target.style.borderColor = '#16a34a'}
                      onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Gender</label>
                    <select value={form.gender} onChange={e => set('gender', e.target.value)}
                      style={{ ...inputStyle, fontSize: 13 }}>
                      <option value="">Prefer not to say</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              background: loading ? '#6ee7b7' : 'linear-gradient(135deg, #059669, #047857)',
              color: '#fff', border: 'none',
              padding: '13px', borderRadius: 10,
              fontSize: 15, fontWeight: 700,
              cursor: loading ? 'default' : 'pointer',
              boxShadow: '0 4px 14px rgba(5,150,105,0.35)',
              marginTop: 4,
            }}>
              {loading ? 'Creating account…' : 'Create Account →'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Already registered?</span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          <Link to="/login" style={{
            display: 'block', textAlign: 'center',
            padding: '12px', borderRadius: 10,
            border: '1.5px solid #e2e8f0',
            fontSize: 14, fontWeight: 600,
            color: '#374151', textDecoration: 'none',
            background: '#fff',
          }}>
            Sign in instead
          </Link>
        </div>
      </div>
    </div>
  );
}
