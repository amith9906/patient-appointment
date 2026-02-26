import React, {useEffect, useState} from 'react';
import { nurseAPI, departmentAPI, shiftAPI, nurseLeaveAPI } from '../services/api';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import Modal from '../components/Modal';
import styles from './Page.module.css';

export default function NurseDashboard(){
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', departmentId: '' });
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalRows, setModalRows] = useState([]);

  useEffect(()=>{ load(); loadDepts(); }, []);

  const loadDepts = async () => {
    try {
      const res = await departmentAPI.getAll();
      setDepartments(res.data || []);
    } catch (e) { console.error(e); }
  };

  const load = async ()=>{
    setLoading(true);
    try{
      const params = {};
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;
      if (filters.departmentId) params.departmentId = filters.departmentId;
      const res = await nurseAPI.getDashboard(params);
      setData(res.data);
    }catch(e){
      console.error(e);
      setData(null);
    }finally{ setLoading(false); }
  }

  const openShiftDrill = async (key) => {
    try {
      const [id] = key.split(':');
      const date = data?.params?.fromDate || new Date().toISOString().split('T')[0];
      const res = await shiftAPI.getAssignments({ date, shiftId: id });
      setModalTitle(`Assignments — ${key.split(':')[1] || id}`);
      setModalRows((res.data || []).map(a => ({ id: a.id, name: a.nurse?.name, workArea: a.workArea })));
      setShowModal(true);
    } catch (e) { console.error(e); }
  };

  const openDeptDrill = async (name) => {
    try {
      const dept = departments.find(d => d.name === name);
      const res = dept ? await nurseAPI.getAll({ departmentId: dept.id }) : await nurseAPI.getAll({});
      setModalTitle(`Nurses — ${name}`);
      setModalRows((res.data || []).map(n => ({ id: n.id, name: n.name, email: n.email })));
      setShowModal(true);
    } catch (e) { console.error(e); }
  };

  const openOnLeaveDrill = async () => {
    try {
      const date = data?.params?.fromDate || new Date().toISOString().split('T')[0];
      const res = await nurseLeaveAPI.getAll({ from: date, to: date });
      setModalTitle(`On Leave — ${date}`);
      setModalRows((res.data || []).map(l => ({ id: l.id, name: l.nurse?.name, reason: l.reason })));
      setShowModal(true);
    } catch (e) { console.error(e); }
  };

  if(loading) return <div className={styles.page}><h2>Loading nurse dashboard...</h2></div>;
  if(!data) return <div className={styles.page}><h2>No data</h2></div>;

  return (
    <><div className={styles.page}>
          <h1>Nurse Dashboard</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column' }}>
                  From
                  <input type="date" className={styles.input} value={filters.fromDate} onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column' }}>
                  To
                  <input type="date" className={styles.input} value={filters.toDate} onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column' }}>
                  Department
                  <select className={styles.input} value={filters.departmentId} onChange={(e) => setFilters(prev => ({ ...prev, departmentId: e.target.value }))}>
                      <option value="">All</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
              </label>
              <div>
                  <button className={styles.btnPrimary} onClick={load}>Apply</button>
                  <button className={styles.btnSecondary} style={{ marginLeft: 8 }} onClick={() => { setFilters({ fromDate: '', toDate: '', departmentId: '' }); load(); } }>Reset</button>
              </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
              <div className={styles.card}><div className={styles.cardTitle}>Total Nurses</div><div className={styles.cardValue}>{data.total}</div></div>
              <div className={styles.card}><div className={styles.cardTitle}>Active</div><div className={styles.cardValue}>{data.active}</div></div>
              <div className={styles.card}><div className={styles.cardTitle}>On Leave (start)</div><div className={styles.cardValue} style={{ cursor: 'pointer' }} onClick={openOnLeaveDrill}>{data.onLeave}</div></div>
              <div className={styles.card}><div className={styles.cardTitle}>Assignments (start)</div><div className={styles.cardValue}>{data.assignments}</div></div>
          </div>

          <h3 style={{ marginTop: 20 }}>By Shift (start)</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(data.byShift || {}).map(([k, v]) => {
                  const name = k.split(':')[1] || k;
                  return <div key={k} className={styles.pill} style={{ cursor: 'pointer' }} onClick={() => openShiftDrill(k)}>{name}: {v}</div>;
              })}
          </div>

          <h3 style={{ marginTop: 20 }}>By Department</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(data.byDepartment || {}).map(([k, v]) => <div key={k} className={styles.pill} style={{ cursor: 'pointer' }} onClick={() => openDeptDrill(k)}>{k}: {v}</div>)}
          </div>

          <h3 style={{ marginTop: 20 }}>Unique Patients Attended</h3>
          <div className={styles.cardValue}>{data.patientsAttended}</div>

          <h3 style={{ marginTop: 20 }}>Assignments & New Nurses ({data.params && data.params.fromDate} → {data.params && data.params.toDate})</h3>
          <div style={{ height: 320 }}>
              {data.assignmentsSeries && data.assignmentsSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.assignmentsSeries} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="assignments" stroke="#8884d8" strokeWidth={2} />
                          <Line type="monotone" dataKey="newNurses" stroke="#82ca9d" strokeWidth={2} />
                      </LineChart>
                  </ResponsiveContainer>
              ) : (
                  <div>No series data for the selected range.</div>
              )}
          </div>
      </div><Modal isOpen={showModal} onClose={() => setShowModal(false)} title={modalTitle}>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {modalRows.length === 0 ? <div style={{ padding: 12 }}>No records</div> : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                              <tr>
                                  <th style={{ textAlign: 'left', padding: 8 }}>#</th>
                                  <th style={{ textAlign: 'left', padding: 8 }}>Name</th>
                                  <th style={{ textAlign: 'left', padding: 8 }}>Info</th>
                              </tr>
                          </thead>
                          <tbody>
                              {modalRows.map((r, i) => (
                                  <tr key={r.id} style={{ borderTop: '1px solid #eee' }}>
                                      <td style={{ padding: 8 }}>{i + 1}</td>
                                      <td style={{ padding: 8 }}>{r.name}</td>
                                      <td style={{ padding: 8 }}>{r.workArea || r.email || r.reason || ''}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  )}
              </div>
          </Modal></>
  );
}
