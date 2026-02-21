import React, { useState, useEffect } from 'react';
import api from '../../services/api';

export default function MyPrescriptions() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/prescriptions/my').then(r => setPrescriptions(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center p-16"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-6">My Prescriptions</h2>
      {prescriptions.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center border border-gray-100">
          <div className="text-5xl mb-3">Rx</div>
          <p className="text-gray-500">No prescriptions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {prescriptions.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-lg text-gray-800">Rx {p.medication.name}</div>
                  <div className="text-sm text-gray-500">{p.medication.genericName}  |  {p.medication.category}</div>
                </div>
                <span className="bg-green-50 text-green-700 text-xs px-3 py-1 rounded-full font-medium">Active</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-gray-50 rounded-lg p-4">
                {[
                  ['Dosage', p.dosage || p.medication.dosage],
                  ['Frequency', p.frequency],
                  ['Duration', p.duration],
                  ['Quantity', p.quantity],
                  ['Prescribed By', p.appointment.doctor ? `Dr. ${p.appointment.doctor.name}` : '-'],
                  ['Date', p.appointment ? new Date(p.createdAt).toLocaleDateString() : '-'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
                    <div className="text-sm font-semibold text-gray-700 mt-0.5">{value || '-'}</div>
                  </div>
                ))}
              </div>
              {p.instructions && (
                <div className="mt-3 text-sm bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 text-yellow-800">
                  📌 {p.instructions}
                </div>
              )}
              {p.medication.sideEffects && (
                <div className="mt-2 text-xs text-gray-400">Warning️ Side effects: {p.medication.sideEffects}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
