import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { packageAPI } from '../../services/api';
import { toast } from 'react-toastify';

const STEPS = ['Select Hospital', 'Select Doctor', 'Choose Date & Time', 'Confirm'];

export default function BookAppointment() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selected, setSelected] = useState({ hospital: null, doctor: null, date: '', time: '', type: 'consultation', reason: '', patientPackageId: '' });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [patient, setPatient] = useState(null);
  const [patientPackages, setPatientPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const updateSelected = (changes) => setSelected((prev) => ({ ...prev, ...changes }));
  const selectedPackage = patientPackages.find((pkg) => pkg.id === selected.patientPackageId);

  useEffect(() => { api.get('/hospitals').then(r => setHospitals(r.data)); }, []);

  useEffect(() => {
    let isMounted = true;
    const loadPatientPackages = async () => {
      setPackagesLoading(true);
      try {
        const res = await api.get('/patients/me');
        if (!isMounted) return;
        setPatient(res.data);
        const pkgRes = await packageAPI.getPatientAssignments(res.data.id);
        if (!isMounted) return;
        setPatientPackages(pkgRes.data || []);
        if (pkgRes.data?.length === 1) {
          setSelected((prev) => ({ ...prev, patientPackageId: pkgRes.data[0].id }));
        }
      } catch (err) {
        if (isMounted) {
          setPatientPackages([]);
        }
      } finally {
        if (isMounted) setPackagesLoading(false);
      }
    };
    loadPatientPackages();
    return () => { isMounted = false; };
  }, []);

  const selectHospital = async (h) => {
    setSelected(s => ({ ...s, hospital: h, doctor: null, date: '', time: '' }));
    const r = await api.get('/doctors', { params: { hospitalId: h.id } });
    setDoctors(r.data);
    setStep(1);
  };

  const selectDoctor = (d) => {
    setSelected(s => ({ ...s, doctor: d, date: '', time: '' }));
    setStep(2);
  };

  const handleDateChange = async (date) => {
    setSelected(s => ({ ...s, date, time: '' }));
    if (selected.doctor && date) {
      setLoading(true);
      try {
        const r = await api.get(`/doctors/${selected.doctor.id}/slots`, { params: { date } });
        setSlots(r.data);
      } catch { setSlots([]); }
      finally { setLoading(false); }
    }
  };

  const handleBook = async () => {
    setSubmitting(true);
    try {
      await api.post('/patients/me/book', {
        doctorId: selected.doctor.id,
        appointmentDate: selected.date,
        appointmentTime: selected.time,
        type: selected.type,
        reason: selected.reason,
        fee: selected.doctor.consultationFee,
        patientPackageId: selected.patientPackageId || null,
      });
      toast.success('Appointment booked successfully!');
      navigate('/patient-portal/appointments');
    } catch (err) { toast.error(err.response.data.message || 'Booking failed'); }
    finally { setSubmitting(false); }
  };

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Book an Appointment</h2>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <React.Fragment key={i}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-sm hidden sm:block ${i === step ? 'font-semibold text-blue-600' : 'text-gray-400'}`}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {/* Step 0: Hospital */}
        {step === 0 && (
          <div>
            <h3 className="font-semibold text-gray-700 mb-4">Select a Hospital</h3>
            <div className="grid gap-3">
              {hospitals.map(h => (
                <button key={h.id} onClick={() => selectHospital(h)}
                  className="text-left p-4 border rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <div className="font-semibold text-gray-800">Hospital {h.name}</div>
                  <div className="text-sm text-gray-500">{h.city}, {h.state}  |  {h.type}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Doctor */}
        {step === 1 && (
          <div>
            <button onClick={() => setStep(0)} className="text-sm text-blue-600 mb-4 flex items-center gap-1">← Back</button>
            <h3 className="font-semibold text-gray-700 mb-1">Select a Doctor</h3>
            <p className="text-sm text-gray-400 mb-4">{selected.hospital.name}</p>
            <div className="grid gap-3">
              {doctors.filter(d => d.isActive).map(d => (
                <button key={d.id} onClick={() => selectDoctor(d)}
                  className="text-left p-4 border rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-gray-800">Dr. {d.name}</div>
                      <div className="text-sm text-blue-600">{d.specialization}</div>
                      <div className="text-sm text-gray-500 mt-1">{d.qualification}  |  {d.experience} yrs exp</div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-600 font-bold">${d.consultationFee}</div>
                      <div className="text-xs text-gray-400">Consultation</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    ⏰ {d.availableFrom.slice(0,5)} - {d.availableTo.slice(0,5)}  |  {d.availableDays.join(', ')}
                  </div>
                </button>
              ))}
              {doctors.filter(d => d.isActive).length === 0 && <p className="text-gray-400 text-center py-8">No doctors available at this hospital</p>}
            </div>
          </div>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <div>
            <button onClick={() => setStep(1)} className="text-sm text-blue-600 mb-4 flex items-center gap-1">← Back</button>
            <h3 className="font-semibold text-gray-700 mb-1">Choose Date & Time</h3>
            <p className="text-sm text-gray-400 mb-4">Dr. {selected.doctor.name}  |  {selected.doctor.specialization}</p>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
              <input type="date" min={minDate} value={selected.date}
                onChange={e => handleDateChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>

            {selected.date && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">Available Slots</label>
                {loading ? <div className="text-center py-4 text-gray-400">Loading slots...</div> : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map(slot => (
                      <button key={slot.time} disabled={!slot.available}
                        onClick={() => setSelected(s => ({ ...s, time: slot.time }))}
                        className={`py-2 text-sm rounded-lg border font-medium transition-colors
                          ${!slot.available ? 'bg-gray-100 text-gray-300 cursor-not-allowed border-gray-100'
                            : slot.time === selected.time ? 'bg-blue-600 text-white border-blue-600'
                            : 'hover:border-blue-400 hover:bg-blue-50 border-gray-200'}`}>
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {patientPackages.length > 0 && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Use Package</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  value={selected.patientPackageId}
                  onChange={(e) => updateSelected({ patientPackageId: e.target.value })}
                >
                  <option value="">Do not use a package</option>
                  {patientPackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.plan?.name || 'Package'} — {pkg.status} ({pkg.usedVisits}/{pkg.totalVisits})
                    </option>
                  ))}
                </select>
                <div className="text-xs text-gray-500 mt-2">
                  {packagesLoading
                    ? 'Checking active packages...'
                    : selectedPackage
                      ? `${Math.max(selectedPackage.totalVisits - selectedPackage.usedVisits, 0)} visits remaining${selectedPackage.expiryDate ? ` • Expires ${selectedPackage.expiryDate}` : ''}`
                      : 'Select a package to attach this visit'}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Type</label>
              <select value={selected.type} onChange={e => setSelected(s => ({...s, type: e.target.value}))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                {['consultation','follow_up','routine_checkup','emergency'].map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Visit</label>
              <textarea rows={3} value={selected.reason} onChange={e => setSelected(s => ({...s, reason: e.target.value}))}
                placeholder="Describe your symptoms or reason..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>

            <button onClick={() => setStep(3)} disabled={!selected.date || !selected.time}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 hover:bg-blue-700 transition-colors">
              Continue {'->'}
            </button>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div>
            <button onClick={() => setStep(2)} className="text-sm text-blue-600 mb-4 flex items-center gap-1">← Back</button>
            <h3 className="font-semibold text-gray-700 mb-4">Confirm Appointment</h3>
            <div className="bg-gray-50 rounded-xl p-5 space-y-3 mb-6">
              {[
                ['Hospital', selected.hospital.name],
                ['Doctor', `Dr. ${selected.doctor.name}`],
                ['Specialization', selected.doctor.specialization],
                ['Date', selected.date],
                ['Time', selected.time],
                ['Type', selected.type.replace('_',' ')],
                ['Consultation Fee', `$${selected.doctor.consultationFee}`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-800 capitalize">{value}</span>
                </div>
              ))}
              {selected.reason && <div className="pt-2 border-t"><div className="text-xs text-gray-500">Reason</div><div className="text-sm mt-1">{selected.reason}</div></div>}
            </div>
            <button onClick={handleBook} disabled={submitting}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Booking...' : 'Done Confirm Booking'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
