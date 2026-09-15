import React, { useState } from 'react';

export default function PatientQRCodeModal({ patient, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!patient) return null;

  const patientIdStr = patient.patientId || patient.id || 'N/A';
  const qrData = JSON.stringify({
    uhid: patientIdStr,
    name: patient.name,
    gender: patient.gender,
    bloodGroup: patient.bloodGroup || 'N/A',
    emergencyPhone: patient.phone || patient.emergencyContact || 'N/A',
  });

  // Generate SVG QR Code representation dynamically (SVG data URL or quick canvas API)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

  const handleCopyUHID = () => {
    navigator.clipboard.writeText(patientIdStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 print:hidden">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100">
        {/* Header Header Banner */}
        <div className="bg-gradient-to-r from-teal-600 to-indigo-600 p-4 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/80 hover:text-white font-bold text-lg"
          >
            ✕
          </button>
          <div className="text-3xl mb-1">🏥</div>
          <h3 className="font-extrabold text-base tracking-wide">DIGITAL HEALTH PASS</h3>
          <p className="text-xs text-teal-100">MediSchedule Hospital Network</p>
        </div>

        {/* Card Body */}
        <div className="p-5 text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-2 border-2 border-indigo-100 rounded-lg bg-slate-50 shadow-inner">
              <img
                src={qrCodeUrl}
                alt={`QR Code for ${patient.name}`}
                className="w-44 h-44 object-contain rounded"
              />
            </div>
          </div>

          <div>
            <h4 className="font-bold text-lg text-slate-800">{patient.name}</h4>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="font-mono text-sm font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded border">
                UHID: {patientIdStr}
              </span>
              <button
                type="button"
                onClick={handleCopyUHID}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-left text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
            <div>
              <span className="text-slate-400 block text-[10px]">GENDER / AGE</span>
              <span className="font-semibold text-slate-700 capitalize">
                {patient.gender || '—'} {patient.dob ? `(${new Date().getFullYear() - new Date(patient.dob).getFullYear()}y)` : ''}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">BLOOD GROUP</span>
              <span className="font-semibold text-red-600">{patient.bloodGroup || 'Not Specified'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">CONTACT PHONE</span>
              <span className="font-semibold text-slate-700">{patient.phone || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">INSURANCE</span>
              <span className="font-semibold text-slate-700">{patient.insuranceProvider || 'Self-pay'}</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 italic">
            Scan QR code at Reception desk, Pharmacy POS, or Lab counter for instant verification.
          </div>

          <div className="pt-2 flex gap-2">
            <button
              onClick={() => window.print()}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition"
            >
              🖨️ Print Digital Health Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
