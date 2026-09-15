import React, { useState, useEffect } from 'react';
import { hospitalAPI, hospitalSettingsAPI, doctorAPI } from '../services/api';
import { toast } from 'react-toastify';

const DEFAULT = {
  gstin: '', pan: '', regNumber: '', tagline: '',
  phone: '', altPhone: '', website: '',
  doctorName: '', doctorQualification: '', doctorRegNumber: '', doctorSpecialization: '',
  receiptHeader: '', receiptFooter: 'Thank you for choosing our hospital. Get well soon!',
  currency: 'Rs ', dateFormat: 'DD/MM/YYYY', timezone: 'Asia/Kolkata',
  showLogoOnReceipt: true, showGSTINOnReceipt: true, showDoctorOnReceipt: true,
  appointmentSlotDuration: 30, workingHoursFrom: '09:00', workingHoursTo: '18:00',
};

function Field({ label, value, onChange, type = 'text', placeholder, span }) {
  return (
    <div className={`flex flex-col gap-1 ${span ? 'col-span-2' : ''}`}>
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-white"
      />
    </div>
  );
}

export default function Settings() {
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [settings, setSettings] = useState(DEFAULT);
  const [activeTab, setActiveTab] = useState('hospital');
  const [saving, setSaving] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);

  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('default');
  const [doctorForm, setDoctorForm] = useState({
    name: '',
    qualification: '',
    specialization: '',
    licenseNumber: '',
    signatureUrl: '',
  });
  const [savingDoctor, setSavingDoctor] = useState(false);

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

    doctorAPI.getAll({ hospitalId: selectedHospital.id })
      .then(r => setDoctors(r.data || []))
      .catch(() => setDoctors([]));
  }, [selectedHospital]);

  useEffect(() => {
    if (selectedDoctorId === 'default') {
      setDoctorForm({
        name: settings.doctorName || '',
        qualification: settings.doctorQualification || '',
        specialization: settings.doctorSpecialization || '',
        licenseNumber: settings.doctorRegNumber || '',
        signatureUrl: '',
      });
    } else {
      const doc = doctors.find((d) => d.id === selectedDoctorId);
      if (doc) {
        setDoctorForm({
          name: doc.name || '',
          qualification: doc.qualification || '',
          specialization: doc.specialization || '',
          licenseNumber: doc.licenseNumber || '',
          signatureUrl: doc.signatureUrl || '',
        });
      }
    }
  }, [selectedDoctorId, doctors, settings]);

  const handleSave = async () => {
    if (!selectedHospital) return toast.warn('Please select a hospital first');
    setSaving(true);
    try {
      await hospitalSettingsAPI.update(selectedHospital.id, settings);
      toast.success(`Settings saved for ${selectedHospital.name}`);
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSignatureFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      return toast.error('Please select a valid image file (PNG, JPG, or WEBP)');
    }
    if (file.size > 2 * 1024 * 1024) {
      return toast.error('File size exceeds 2MB limit. Please upload a smaller image.');
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setDoctorForm((prev) => ({ ...prev, signatureUrl: dataUrl }));
      toast.success('Scanned signature file uploaded & loaded into preview!');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveDoctor = async () => {
    if (selectedDoctorId === 'default') {
      setSettings((prev) => ({
        ...prev,
        doctorName: doctorForm.name,
        doctorQualification: doctorForm.qualification,
        doctorSpecialization: doctorForm.specialization,
        doctorRegNumber: doctorForm.licenseNumber,
      }));
      toast.info('Updated hospital default signatory in form. Click "Save Settings" to save to database.');
      return;
    }

    setSavingDoctor(true);
    try {
      await doctorAPI.update(selectedDoctorId, {
        name: doctorForm.name,
        qualification: doctorForm.qualification,
        specialization: doctorForm.specialization,
        licenseNumber: doctorForm.licenseNumber,
        signatureUrl: doctorForm.signatureUrl,
      });
      toast.success(`Signature credentials updated for ${doctorForm.name}`);
      const res = await doctorAPI.getAll({ hospitalId: selectedHospital.id });
      setDoctors(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update doctor profile');
    } finally {
      setSavingDoctor(false);
    }
  };

  const handleSetAsDefaultSignatory = () => {
    setSettings((prev) => ({
      ...prev,
      doctorName: doctorForm.name,
      doctorQualification: doctorForm.qualification,
      doctorSpecialization: doctorForm.specialization,
      doctorRegNumber: doctorForm.licenseNumber,
    }));
    toast.success(`Set ${doctorForm.name} as default hospital signatory! Click "Save Settings" to save.`);
  };

  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }));

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
            {selectedHospital.city && <span> |  {selectedHospital.city}</span>}
            {selectedHospital.type && <span> |  {selectedHospital.type}</span>}
          </div>
        )}
      </div>

      {!selectedHospital ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center text-gray-400">
          <div className="text-5xl mb-4">Hospital</div>
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
                  <input disabled value={selectedHospital.name || ''} className="border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
                </div>
                <Field label="Tagline / Motto" value={settings.tagline} onChange={e => set('tagline', e.target.value)} placeholder="Your health, our priority" span />
                <Field label="GSTIN" value={settings.gstin} onChange={e => set('gstin', e.target.value)} placeholder="27AABCU9603R1ZX" />
                <Field label="PAN Number" value={settings.pan} onChange={e => set('pan', e.target.value)} placeholder="AABCU9603R" />
                <Field label="Registration Number" value={settings.regNumber} onChange={e => set('regNumber', e.target.value)} placeholder="MH/HOS/2024/0001" />
                <Field label="Phone Override (for PDFs)" value={settings.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
                <Field label="Alternate Phone" value={settings.altPhone} onChange={e => set('altPhone', e.target.value)} placeholder="+91 22 1234 5678" />
                <Field label="Website" value={settings.website} onChange={e => set('website', e.target.value)} placeholder="www.hospital.com" />
              </div>
            )}

            {activeTab === 'doctor' && (
              <div className="space-y-6">
                <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 flex items-start justify-between flex-wrap gap-2">
                  <div>
                    ℹ️ Each doctor has their own signature and credentials for consultation templates, prescriptions, and bills.
                    <div className="text-xs text-blue-600 mt-1">
                      Select a doctor below to edit their specific signature block, or configure the hospital fallback signatory.
                    </div>
                  </div>
                  <span className="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-xs font-semibold">
                    {doctors.length} Doctors Registered
                  </span>
                </div>

                {/* Doctor Selector Header */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide whitespace-nowrap">
                      Select Doctor:
                    </label>
                    <select
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:border-blue-500 flex-1"
                    >
                      <option value="default">🏥 Default Hospital Signatory (Fallback)</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          👨‍⚕️ {d.name} {d.specialization ? `(${d.specialization})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedDoctorId !== 'default' && (
                    <button
                      type="button"
                      onClick={handleSetAsDefaultSignatory}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                    >
                      ★ Set as Hospital Default Signatory
                    </button>
                  )}
                </div>

                {/* Doctor Signature Fields & Live Preview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <Field
                      label="Doctor Full Name"
                      value={doctorForm.name}
                      onChange={(e) => setDoctorForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Dr. Priya Sharma"
                    />
                    <Field
                      label="Qualification"
                      value={doctorForm.qualification}
                      onChange={(e) => setDoctorForm((p) => ({ ...p, qualification: e.target.value }))}
                      placeholder="e.g. MBBS, MD (Medicine)"
                    />
                    <Field
                      label="Specialization"
                      value={doctorForm.specialization}
                      onChange={(e) => setDoctorForm((p) => ({ ...p, specialization: e.target.value }))}
                      placeholder="e.g. General Medicine"
                    />
                    <Field
                      label="Registration / License Number"
                      value={doctorForm.licenseNumber}
                      onChange={(e) => setDoctorForm((p) => ({ ...p, licenseNumber: e.target.value }))}
                      placeholder="e.g. MH-12345"
                    />
                    <div className="col-span-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Digital Signature Text / Stamp Note or Image
                        </label>
                        <label className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md border border-blue-200 flex items-center gap-1.5 transition-colors">
                          <span>📤</span> Upload Signature PNG / JPG
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={handleSignatureFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <input
                        type="text"
                        value={doctorForm.signatureUrl}
                        onChange={(e) => setDoctorForm((p) => ({ ...p, signatureUrl: e.target.value }))}
                        placeholder="Type stamp text e.g. 'Digitally Signed & Verified' OR click Upload button above for PNG image"
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-white w-full"
                      />
                      
                      {/* Preset Quick Stamp Chips */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-semibold text-gray-500">Quick Stamp Presets:</span>
                        {[
                          'Digitally Signed & Verified',
                          'Electronically Prescribed & Approved',
                          'Verified Registered Medical Practitioner',
                          'Valid without physical signature (ABDM Certified)',
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setDoctorForm((p) => ({ ...p, signatureUrl: preset }))}
                            className="text-[11px] px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors font-medium"
                          >
                            + {preset}
                          </button>
                        ))}
                        {doctorForm.signatureUrl && (
                          <button
                            type="button"
                            onClick={() => setDoctorForm((p) => ({ ...p, signatureUrl: '' }))}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors font-medium ml-auto"
                          >
                            ✕ Clear Signature
                          </button>
                        )}
                      </div>

                      <div className="text-[11px] text-gray-500 flex items-center gap-3 pt-1">
                        <span>📤 <strong>Upload Button:</strong> Select a scanned PNG/JPG signature image from your device</span>
                        <span>•</span>
                        <span>✍️ <strong>Text Note:</strong> Renders as electronic verification stamp</span>
                      </div>
                    </div>
                    <div className="col-span-2 flex justify-end gap-3 mt-2">
                      <button
                        type="button"
                        onClick={handleSaveDoctor}
                        disabled={savingDoctor}
                        className="px-5 py-2 rounded-lg font-semibold text-xs bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {savingDoctor ? 'Saving Doctor...' : selectedDoctorId === 'default' ? 'Apply to Settings' : 'Save Doctor Signature'}
                      </button>
                    </div>
                  </div>

                  {/* Live PDF Signature Preview */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center justify-between">
                        <span className="flex items-center gap-1.5"><span>📄</span> Prescription Signature Preview</span>
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-mono font-semibold">Real-Time</span>
                      </div>
                      <div className="border border-gray-300 rounded-lg p-4 bg-white shadow-xs font-sans text-xs">
                        <div className="border-b border-dashed border-gray-300 pb-2 mb-3 text-gray-400 italic text-[11px]">
                          Rx / Consultation Notes Signature Block
                        </div>
                        {doctorForm.signatureUrl && (doctorForm.signatureUrl.startsWith('http') || doctorForm.signatureUrl.startsWith('data:image')) ? (
                          <div className="text-right mb-1">
                            <img src={doctorForm.signatureUrl} alt="Signature" className="h-10 max-w-[140px] object-contain ml-auto border-b border-gray-300 pb-1" />
                          </div>
                        ) : (
                          <div className="text-right text-gray-400 font-mono text-[10px] mb-1">
                            ___________________________
                          </div>
                        )}
                        <div className="text-right font-bold text-gray-900 text-sm">
                          {doctorForm.name ? (doctorForm.name.startsWith('Dr.') ? doctorForm.name : `Dr. ${doctorForm.name}`) : 'Dr. Doctor Name'}
                        </div>
                        <div className="text-right text-gray-600 font-medium text-xs">
                          {doctorForm.qualification || 'MBBS, MD (Medicine)'}
                        </div>
                        <div className="text-right text-gray-500 text-[11px]">
                          {doctorForm.specialization || 'General Physician'}
                        </div>
                        <div className="text-right text-gray-500 text-[11px] font-mono mt-0.5">
                          Reg / Lic No: {doctorForm.licenseNumber || 'MH-12345'}
                        </div>
                        <div className="mt-2 pt-1.5 border-t border-gray-100 flex items-center justify-end gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50/80 px-2 py-1 rounded">
                          <span>✓</span> {doctorForm.signatureUrl && !(doctorForm.signatureUrl.startsWith('http') || doctorForm.signatureUrl.startsWith('data:image')) ? doctorForm.signatureUrl : 'Digitally Signed & Verified'}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-4 italic text-center">
                      Live preview updates instantly as you type credentials or click quick stamp presets.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'receipt' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Currency Symbol</label>
                    <select value={settings.currency} onChange={e => set('currency', e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                      <option value="Rs ">Rs  Indian Rupee (INR)</option>
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
                      <div className="text-xs">{settings.phone || selectedHospital.phone || ''}</div>
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
