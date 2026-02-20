import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function DoctorPatients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/doctors/me/patients').then(r => setPatients(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.patientId?.includes(search)
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-6">My Patients</h2>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID..."
        className="w-full mb-5 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500" />

      {loading ? (
        <div className="flex justify-center p-16"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map(p => (
            <div key={p.id} onClick={() => navigate(`/patients/${p.id}`)}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:border-teal-200 hover:shadow-md transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center font-bold text-lg">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-gray-800">{p.name}</div>
                  <div className="text-xs text-gray-400 font-mono">{p.patientId}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                <span>🩸 {p.bloodGroup || '—'}</span>
                <span>📱 {p.phone || '—'}</span>
                <span>⚥ {p.gender || '—'}</span>
                <span>🎂 {p.dateOfBirth || '—'}</span>
              </div>
              {p.allergies && <div className="mt-2 text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded">⚠️ {p.allergies.slice(0,50)}</div>}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-2 text-center py-16 text-gray-400">
              <div className="text-5xl mb-3">🧑‍🤝‍🧑</div>
              <p>No patients found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
