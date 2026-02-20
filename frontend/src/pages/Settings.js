import React, { useState, useEffect } from 'react';
import { hospitalAPI, hospitalSettingsAPI } from '../services/api';
import { toast } from 'react-toastify';

const DEFAULT = {
  gstin: '', pan: '', regNumber: '', tagline: '',
  phone: '', altPhone: '', website: '',
  doctorName: '', doctorQualification: '', doctorRegNumber: '', doctorSpecialization: '',
  receiptHeader: '', receiptFooter: 'Thank you for choosing our hospital. Get well soon!',
  currency: '₹', dateFormat: 'DD/MM/YYYY', timezone: 'Asia/Kolkata',
  showLogoOnReceipt: true, showGSTINOnReceipt: true, showDoctorOnReceipt: true,
  appointmentSlotDuration: 30, workingHoursFrom: '09:00', workingHoursTo: '18:00',
};

export default function Settings() {
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [settings, setSettings] = useState(DEFAULT);
  const [activeTab, setActiveTab] = useState('hospital');
  const [saving, setSaving] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);

  useEffect(() => {
    hospitalAPI.getAll().then(r => {
      setHospitals(r.data);
      if (r.data.length === 1) setSelectedHospital(r.data[0]);
    });
  }, []);

  useEffect(() => {
    if (!selectedHospital) return;
    setLoadingSettings(true);
    hospitalSettingsAPI.get(selectedHospital.id)
      .then(r => setSettings({ ...DEFAULT, ...r.data }))
      .catch(() => setSettings(DEFAULT))
      .finally(() => setLoadingSettings(false));
  }, [selectedHospital]);

  const handleSave = async () => {
    if (!selectedHospital) return toast.warn('Please select a hospital first');
    setSaving(true);
    try {
      await hospitalSettingsAPI.update(selectedHospital.id, settings);
      toast.success(`Settings saved for ${selectedHospital.name}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const Field = ({ label, k, type = 'text', placeholder, span }) => (
    <div className={`flex flex-col gap-1 ${span ? 'col-span-2' : ''}`}>
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <input type={type} value={settings[k] || ''} onChange={e => set(k, e.target.value)} placeholder={placeholder}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-white" />
    </div>
  );

  const tabs = [
    { id: 'hospital', label: '🏥 Hospital Info' },
    { id: 'doctor', label: '👨‍⚕️ Doctor Info' },
    { id: 'receipt', label: '🧾 Receipt / PDF' },
    { id: 'system', label: '⚙️ System' },
  ];

  const hospitalName = selectedHospital?.name || 'Hospital Name';
  const hospitalAddr = [selectedHospital?.address, selectedHospital?.city, selectedHospital?.state].filter(Boolean).join(', ');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Settings</h2>
          <p className="text-sm text-gray-500">Per-hospital PDF templates, receipt config, and system preferences</p>
        </div>
        <button onClick={handleSave} disabled={saving || !selectedHospital}
          className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? '✓ Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Hospital selector */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-sm font-semibold text-gray-700 whitespace-nowrap">Select Hospital / Clinic:</div>
          <div className="flex gap-2 flex-wrap">
            {hospitals.map(h => (
              <button key={h.id} onClick={() => setSelectedHospital(h)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${selectedHospital?.id === h.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                {h.name}
              </button>
            ))}
            {hospitals.length === 0 && <span className="text-sm text-gray-400">No hospitals found. Create a hospital first.</span>}
          </div>
        </div>
        {selectedHospital && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              Editing: {selectedHospital.name}
            </span>
            {selectedHospital.city && <span>· {selectedHospital.city}</span>}
            {selectedHospital.type && <span>· {selectedHospital.type}</span>}
          </div>
        )}
      </div>

      {!selectedHospital ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center text-gray-400">
          <div className="text-5xl mb-4">🏥</div>
          <div className="text-base font-medium">Select a hospital above to configure its settings</div>
          <div className="text-sm mt-2">Each clinic has its own GSTIN, PDF template, receipt footer and doctor signatory</div>
        </div>
      ) : loadingSettings ? (
        <div className="flex justify-center p-16">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === t.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

            {activeTab === 'hospital' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
                  ℹ️ Hospital name and address are managed from the <strong>Hospitals</strong> page. Fields below appear on PDFs and bills.
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Hospital Name (read-only)</label>
                  <input disabled value={selectedHospital?.name || ''} className="border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
                </div>
                <Field label="Tagline / Motto" k="tagline" placeholder="Your health, our priority" span />
                <Field label="GSTIN" k="gstin" placeholder="27AABCU9603R1ZX" />
                <Field label="PAN Number" k="pan" placeholder="AABCU9603R" />
                <Field label="Registration Number" k="regNumber" placeholder="MH/HOS/2024/0001" />
                <Field label="Phone Override (for PDFs)" k="phone" placeholder="+91 98765 43210" />
                <Field label="Alternate Phone" k="altPhone" placeholder="+91 22 1234 5678" />
                <Field label="Website" k="website" placeholder="www.hospital.com" />
              </div>
            )}

            {activeTab === 'doctor' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
                  ℹ️ This doctor appears as the default signatory on prescriptions and receipts for <strong>{selectedHospital?.name}</strong>.
                </div>
                <Field label="Default Doctor Name" k="doctorName" placeholder="Dr. Priya Sharma" />
                <Field label="Qualification" k="doctorQualification" placeholder="MBBS, MD (Medicine)" />
                <Field label="Specialization" k="doctorSpecialization" placeholder="General Medicine" />
                <Field label="Registration Number" k="doctorRegNumber" placeholder="MH-12345" />
              </div>
            )}

            {activeTab === 'receipt' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Currency Symbol</label>
                    <select value={settings.currency} onChange={e => set('currency', e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                      <option value="₹">₹ Indian Rupee (INR)</option>
                      <option value="$">$ US Dollar (USD)</option>
                      <option value="€">€ Euro (EUR)</option>
                      <option value="£">£ British Pound (GBP)</option>
                      <option value="AED">AED (UAE Dirham)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Date Format</label>
                    <select value={settings.dateFormat} onChange={e => set('dateFormat', e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Document Header Text</label>
                  <textarea rows={2} value={settings.receiptHeader} onChange={e => set('receiptHeader', e.target.value)}
                    placeholder="e.g. Empanelled with CGHS | Accepts all major insurance..."
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Document Footer Text</label>
                  <textarea rows={2} value={settings.receiptFooter} onChange={e => set('receiptFooter', e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-3 border border-gray-100 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-700">Show on All PDFs</h4>
                  {[
                    ['showLogoOnReceipt', 'Show Hospital Logo'],
                    ['showGSTINOnReceipt', 'Show GSTIN / PAN on documents'],
                    ['showDoctorOnReceipt', 'Show Doctor Signature block'],
                  ].map(([k, label]) => (
                    <label key={k} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={!!settings[k]} onChange={e => set(k, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>

                {/* Live preview */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">PDF Header Preview</h4>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 bg-white font-mono text-xs text-gray-800 max-w-sm mx-auto">
                    <div className="text-center border-b pb-3 mb-3">
                      <div className="text-base font-bold">{hospitalName}</div>
                      {settings.tagline && <div className="text-xs text-gray-500 italic">{settings.tagline}</div>}
                      {hospitalAddr && <div className="text-xs mt-1">{hospitalAddr}</div>}
                      <div className="text-xs">{settings.phone || selectedHospital?.phone || ''}</div>
                      {settings.showGSTINOnReceipt && settings.gstin && (
                        <div className="text-xs mt-1">GSTIN: {settings.gstin}{settings.pan ? ` | PAN: ${settings.pan}` : ''}</div>
                      )}
                      {settings.receiptHeader && <div className="text-xs mt-1 italic">{settings.receiptHeader}</div>}
                    </div>
                    <div className="flex justify-between mb-1"><span>Patient: John Doe</span><span>01/01/2024</span></div>
                    <div className="flex justify-between mb-1"><span>APT-000001</span><span>Consultation</span></div>
                    <div className="border-t pt-2 mt-1 text-right">Fee: {settings.currency}500</div>
                    {settings.showDoctorOnReceipt && settings.doctorName && (
                      <div className="mt-3 text-right">
                        <div>____________</div>
                        <div className="font-bold">{settings.doctorName}</div>
                        <div className="text-gray-500">{settings.doctorQualification}</div>
                      </div>
                    )}
                    {settings.receiptFooter && (
                      <div className="text-center border-t pt-2 mt-2 text-gray-400 italic">{settings.receiptFooter}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'system' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Appointment Slot Duration</label>
                  <select value={settings.appointmentSlotDuration} onChange={e => set('appointmentSlotDuration', parseInt(e.target.value))}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    {[15, 20, 30, 45, 60].map(m => <option key={m} value={m}>{m} minutes</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Timezone</label>
                  <select value={settings.timezone} onChange={e => set('timezone', e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Working Hours From</label>
                  <input type="time" value={settings.workingHoursFrom} onChange={e => set('workingHoursFrom', e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Working Hours To</label>
                  <input type="time" value={settings.workingHoursTo} onChange={e => set('workingHoursTo', e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
