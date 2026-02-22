import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ResponsiveContainer, CartesianGrid, Tooltip, XAxis, YAxis, Legend, LineChart, Line } from 'recharts';
import { hospitalAPI, medicationAPI, pdfAPI, stockPurchaseAPI, vendorAPI } from '../services/api';
import { exportToCSV } from '../utils/exportCsv';
import { toast } from 'react-toastify';
import Table from '../components/Table';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import PaginationControls from '../components/PaginationControls';
import styles from './Page.module.css';

const INIT_PURCHASE = {
  medicationId: '',
  vendorId: '',
  batchNo: '',
  mfgDate: '',
  expiryDate: '',
  quantity: 1,
  unitCost: 0,
  discountPct: 0,
  taxPct: 0,
  invoiceNumber: '',
  purchaseDate: new Date().toISOString().slice(0, 10),
  notes: '',
};

const NEW_MED_INIT = {
  name: '',
  genericName: '',
  category: 'tablet',
  dosage: '',
  unitPrice: 0,
  purchasePrice: 0,
  gstRate: 0,
  hsnCode: '',
  requiresPrescription: true,
  hospitalId: '',
};

const currency = (v) => `Rs ${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function StockManagement() {
  const [medications, setMedications] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('stock');
  const [stockModal, setStockModal] = useState(null);
  const [purchaseModal, setPurchaseModal] = useState(false);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState(INIT_PURCHASE);
  const [purchaseReturnModal, setPurchaseReturnModal] = useState(null);
  const [purchaseReturnForm, setPurchaseReturnForm] = useState({ quantity: 1, reason: '', notes: '' });
  const [savingPurchaseReturn, setSavingPurchaseReturn] = useState(false);
  const [showCreateMedicine, setShowCreateMedicine] = useState(false);
  const [newMedForm, setNewMedForm] = useState(NEW_MED_INIT);
  const [savingNewMedicine, setSavingNewMedicine] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [batchModal, setBatchModal] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchData, setBatchData] = useState([]);
  const [ledgerData, setLedgerData] = useState([]);
  const [stockAnalytics, setStockAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [medPage, setMedPage] = useState(1);
  const [medPerPage, setMedPerPage] = useState(25);
  const [medPagination, setMedPagination] = useState(null);
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchasePerPage, setPurchasePerPage] = useState(25);
  const [purchasePagination, setPurchasePagination] = useState(null);
  const userRole = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').role || ''; } catch { return ''; }
  })();
  const isSuperAdmin = userRole === 'super_admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tasks = [
        medicationAPI.getAll({ page: medPage, per_page: medPerPage }),
        vendorAPI.getAll({ isActive: true }),
        stockPurchaseAPI.getAll({ page: purchasePage, per_page: purchasePerPage }),
      ];
      if (isSuperAdmin) tasks.push(hospitalAPI.getAll());
      const [medRes, venRes, purRes, hospRes] = await Promise.all(tasks);
      setMedications(medRes.data || []);
      setMedPagination(medRes.pagination || null);
      setVendors(venRes.data || []);
      setPurchases(purRes.data || []);
      setPurchasePagination(purRes.pagination || null);
      if (isSuperAdmin && hospRes) setHospitals(hospRes.data || []);
    } catch {
      toast.error('Failed to load stock data');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, medPage, medPerPage, purchasePage, purchasePerPage]);

  useEffect(() => {
    load();
  }, [load]);

  // Expiry alerts
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [expiryDays, setExpiryDays] = useState(30);
  const [expiryLoading, setExpiryLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'stock') return;
    setExpiryLoading(true);
    medicationAPI.getExpiryAlerts({ days: expiryDays })
      .then((res) => setExpiryAlerts(res.data || []))
      .catch(() => {})
      .finally(() => setExpiryLoading(false));
  }, [tab, expiryDays]);

  useEffect(() => {
    if (tab !== 'analytics') return;
    setAnalyticsLoading(true);
    medicationAPI.getAdvancedAnalytics()
      .then((res) => setStockAnalytics(res.data || null))
      .catch(() => toast.error('Failed to load stock analytics'))
      .finally(() => setAnalyticsLoading(false));
  }, [tab]);

  const handleStockUpdate = async (e) => {
    e.preventDefault();
    try {
      await medicationAPI.updateStock(stockModal.id, {
        quantity: parseInt(stockModal.qty, 10),
        operation: stockModal.op,
      });
      toast.success('Stock updated');
      setStockModal(null);
      await load();
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to update stock');
    }
  };

  const selectedMedication = useMemo(
    () => medications.find((m) => m.id === purchaseForm.medicationId),
    [medications, purchaseForm.medicationId]
  );

  const computedPurchase = useMemo(() => {
    const qty = Number(purchaseForm.quantity || 0);
    const unitCost = Number(purchaseForm.unitCost || 0);
    const discountPct = Number(purchaseForm.discountPct || 0);
    const taxPct = Number(purchaseForm.taxPct || 0);
    const base = qty * unitCost;
    const discount = (base * discountPct) / 100;
    const taxable = base - discount;
    const taxAmount = (taxable * taxPct) / 100;
    return { base, discount, taxable, taxAmount, total: taxable + taxAmount };
  }, [purchaseForm]);

  const handlePurchase = async (e) => {
    e.preventDefault();
    if (!purchaseForm.medicationId) return toast.error('Please select medication');

    setSavingPurchase(true);
    try {
      await stockPurchaseAPI.create({
        medicationId: purchaseForm.medicationId,
        vendorId: purchaseForm.vendorId || null,
        batchNo: purchaseForm.batchNo || null,
        mfgDate: purchaseForm.mfgDate || null,
        expiryDate: purchaseForm.expiryDate || null,
        quantity: Number(purchaseForm.quantity),
        unitCost: Number(purchaseForm.unitCost || 0),
        discountPct: Number(purchaseForm.discountPct || 0),
        taxPct: Number(purchaseForm.taxPct || 0),
        invoiceNumber: purchaseForm.invoiceNumber || null,
        purchaseDate: purchaseForm.purchaseDate || new Date().toISOString().slice(0, 10),
        notes: purchaseForm.notes || null,
      });
      toast.success('Purchase recorded and stock updated');
      setPurchaseModal(false);
      setPurchaseForm(INIT_PURCHASE);
      await load();
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to record purchase');
    } finally {
      setSavingPurchase(false);
    }
  };

  const createMedicine = async () => {
    if (!newMedForm.name.trim()) return toast.error('Medicine name is required');
    if (isSuperAdmin && !newMedForm.hospitalId) return toast.error('Please select hospital for new medicine');
    setSavingNewMedicine(true);
    try {
      const payload = {
        name: newMedForm.name.trim(),
        genericName: newMedForm.genericName || null,
        category: newMedForm.category || 'tablet',
        dosage: newMedForm.dosage || null,
        unitPrice: Number(newMedForm.unitPrice || 0),
        purchasePrice: Number(newMedForm.purchasePrice || 0),
        gstRate: Number(newMedForm.gstRate || 0),
        hsnCode: newMedForm.hsnCode || null,
        requiresPrescription: Boolean(newMedForm.requiresPrescription),
        stockQuantity: 0,
        ...(isSuperAdmin ? { hospitalId: newMedForm.hospitalId } : {}),
      };
      const res = await medicationAPI.create(payload);
      const created = res.data;
      setMedications((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to create medicine');
      return null;
    } finally {
      setSavingNewMedicine(false);
    }
  };

  const handleCreateMedicine = async (e) => {
    e.preventDefault();
    const created = await createMedicine();
    if (!created) return;
    setPurchaseForm((f) => ({
      ...f,
      medicationId: created.id,
      unitCost: Number(created.purchasePrice || created.unitPrice || 0),
      taxPct: Number(created.gstRate || 0),
    }));
    setShowCreateMedicine(false);
    setNewMedForm(NEW_MED_INIT);
    toast.success('Medicine created and selected for purchase');
  };

  const handleCreateAndPurchase = async (e) => {
    e.preventDefault();
    const created = await createMedicine();
    if (!created) return;
    setSavingPurchase(true);
    try {
      await stockPurchaseAPI.create({
        medicationId: created.id,
        vendorId: purchaseForm.vendorId || null,
        batchNo: purchaseForm.batchNo || null,
        mfgDate: purchaseForm.mfgDate || null,
        expiryDate: purchaseForm.expiryDate || null,
        quantity: Number(purchaseForm.quantity),
        unitCost: Number(purchaseForm.unitCost || created.purchasePrice || created.unitPrice || 0),
        discountPct: Number(purchaseForm.discountPct || 0),
        taxPct: Number(purchaseForm.taxPct || created.gstRate || 0),
        invoiceNumber: purchaseForm.invoiceNumber || null,
        purchaseDate: purchaseForm.purchaseDate || new Date().toISOString().slice(0, 10),
        notes: purchaseForm.notes || null,
      });
      toast.success('Medicine created and first purchase recorded');
      setShowCreateMedicine(false);
      setNewMedForm(NEW_MED_INIT);
      setPurchaseForm(INIT_PURCHASE);
      setPurchaseModal(false);
      await load();
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to record purchase for new medicine');
    } finally {
      setSavingPurchase(false);
    }
  };

  const openBatchModal = async (medication) => {
    setBatchModal(medication);
    setBatchData([]);
    setLedgerData([]);
    setBatchLoading(true);
    try {
      const [batchesRes, ledgerRes] = await Promise.all([
        medicationAPI.getBatches(medication.id),
        medicationAPI.getStockLedger(medication.id, { limit: 80 }),
      ]);
      setBatchData(batchesRes.data || []);
      setLedgerData(ledgerRes.data || []);
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to load batch/ledger details');
    } finally {
      setBatchLoading(false);
    }
  };

  const openPurchaseReturn = (purchase) => {
    setPurchaseReturnModal(purchase);
    setPurchaseReturnForm({ quantity: 1, reason: '', notes: '' });
  };

  const downloadStockAnalyticsCsv = () => {
    if (!stockAnalytics) return;
    const lines = [];
    lines.push('Section,Medicine,Category,Qty,Value,Extra1,Extra2');

    (stockAnalytics.deadStock || []).forEach((x) => {
      lines.push(`Dead Stock,"${x.name}",${x.category || ''},${Number(x.stockQuantity || 0)},${Number(x.stockValue || 0).toFixed(2)},"Last Movement: ${x.lastMovementDate || '-'}",`);
    });
    (stockAnalytics.expiryRisk || []).forEach((x) => {
      lines.push(`Expiry Risk,"${x.name}",,${Number(x.nearExpiryQty || 0)},${Number(x.nearExpiryValue || 0).toFixed(2)},"Nearest Expiry: ${x.nearestExpiryDate || '-'}",`);
    });
    (stockAnalytics.fastMovers || []).forEach((x) => {
      lines.push(`Fast Mover,"${x.name}",${x.category || ''},${Number(x.netSoldQty || 0)},${Number(x.stockValue || 0).toFixed(2)},"Velocity/30d: ${Number(x.velocityPer30Days || 0)}","Days Cover: ${x.daysOfCover ?? '-'}"`);
    });
    (stockAnalytics.slowMovers || []).forEach((x) => {
      lines.push(`Slow Mover,"${x.name}",${x.category || ''},${Number(x.netSoldQty || 0)},${Number(x.stockValue || 0).toFixed(2)},"Stock Qty: ${Number(x.stockQuantity || 0)}",`);
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-advanced-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handlePurchaseReturn = async (e) => {
    e.preventDefault();
    if (!purchaseReturnModal) return;
    setSavingPurchaseReturn(true);
    try {
      const res = await stockPurchaseAPI.createReturn(purchaseReturnModal.id, {
        quantity: Number(purchaseReturnForm.quantity || 0),
        reason: purchaseReturnForm.reason || null,
        notes: purchaseReturnForm.notes || null,
      });
      const created = res.data;
      if (created.id) {
        try {
          const pdfRes = await pdfAPI.purchaseReturn(created.id);
          const url = window.URL.createObjectURL(new Blob([pdfRes.data], { type: 'application/pdf' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = `purchase-return-${created.returnNumber || created.id}.pdf`;
          link.click();
          window.URL.revokeObjectURL(url);
        } catch {
          toast.info('Purchase return created. PDF download failed; you can generate it again from API.');
        }
      }
      toast.success('Purchase return recorded');
      setPurchaseReturnModal(null);
      await load();
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to create purchase return');
    } finally {
      setSavingPurchaseReturn(false);
    }
  };

  const lowStock = medications.filter((m) => Number(m.stockQuantity || 0) < 10);
  const totalValue = medications.reduce((s, m) => s + (Number(m.stockQuantity || 0) * Number(m.unitPrice || 0)), 0);
  const inventoryTotal = medPagination?.total ?? medications.length;
  const purchaseTotal = purchasePagination?.total ?? purchases.length;

  const handleExportStock = async () => {
    try {
      const res = await medicationAPI.getAll({ paginate: 'false' });
      const rows = res.data || [];
      exportToCSV(rows, [
        { label: 'Name', key: 'name' },
        { label: 'Generic Name', key: 'genericName' },
        { label: 'Category', key: 'category' },
        { label: 'Dosage', key: 'dosage' },
        { label: 'Stock Qty', key: 'stockQuantity' },
        { label: 'Unit Price (Rs)', key: 'unitPrice' },
        { label: 'Purchase Price (Rs)', key: 'purchasePrice' },
        { label: 'Stock Value (Rs)', key: (r) => (Number(r.stockQuantity || 0) * Number(r.unitPrice || 0)).toFixed(2) },
        { label: 'GST %', key: 'gstRate' },
        { label: 'HSN Code', key: 'hsnCode' },
        { label: 'Expiry Date', key: 'expiryDate' },
        { label: 'Requires Prescription', key: (r) => r.requiresPrescription ? 'Yes' : 'No' },
      ], 'stock_inventory');
    } catch { toast.error('Export failed'); }
  };

  const handleExportPurchases = async () => {
    try {
      const res = await stockPurchaseAPI.getAll({ paginate: 'false' });
      const rows = res.data || [];
      exportToCSV(rows, [
        { label: 'Invoice #', key: 'invoiceNumber' },
        { label: 'Date', key: 'purchaseDate' },
        { label: 'Medication', key: (r) => r.medication?.name || '' },
        { label: 'Vendor', key: (r) => r.vendor?.name || '' },
        { label: 'Batch #', key: 'batchNo' },
        { label: 'Mfg Date', key: 'mfgDate' },
        { label: 'Expiry Date', key: 'expiryDate' },
        { label: 'Qty', key: 'quantity' },
        { label: 'Unit Cost (Rs)', key: 'unitCost' },
        { label: 'Discount %', key: 'discountPct' },
        { label: 'GST %', key: 'taxPct' },
        { label: 'Input GST (Rs)', key: 'taxAmount' },
        { label: 'Total (Rs)', key: 'totalAmount' },
        { label: 'Notes', key: 'notes' },
      ], 'stock_purchases');
    } catch { toast.error('Export failed'); }
  };

  const stockCols = [
    {
      key: 'name',
      label: 'Medication',
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{r.category} | {r.dosage || '-'}</div>
        </div>
      ),
    },
    {
      key: 'stockQuantity',
      label: 'Stock',
      render: (v) => (
        <span style={{ fontWeight: 700, fontSize: 15, color: v < 10 ? '#dc2626' : v < 50 ? '#d97706' : '#16a34a' }}>
          {v}
        </span>
      ),
    },
    { key: 'unitPrice', label: 'Unit Price', render: (v) => currency(v) },
    { key: 'stockQuantity', label: 'Stock Value', render: (v, r) => currency(Number(v || 0) * Number(r.unitPrice || 0)) },
    { key: 'expiryDate', label: 'Expiry', render: (v) => v || '-' },
    {
      key: 'id',
      label: 'Actions',
      render: (_, r) => (
        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={() => openBatchModal(r)}>Batches</button>
          <button className={styles.btnSuccess} onClick={() => setStockModal({ ...r, qty: 1, op: 'add' })}>Add Stock</button>
          <button className={styles.btnWarning} onClick={() => setStockModal({ ...r, qty: 1, op: 'subtract' })}>Remove</button>
        </div>
      ),
    },
  ];

  const purchaseCols = [
    { key: 'invoiceNumber', label: 'Invoice #', render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v || '-'}</span> },
    { key: 'purchaseDate', label: 'Date' },
    { key: 'medication', label: 'Medication', render: (v) => v?.name || '-' },
    { key: 'vendor', label: 'Vendor', render: (v) => v?.name || '-' },
    { key: 'quantity', label: 'Qty' },
    { key: 'unitCost', label: 'Unit Cost', render: (v) => currency(v) },
    { key: 'taxPct', label: 'GST %', render: (v) => `${Number(v || 0)}%` },
    { key: 'taxAmount', label: 'Input GST', render: (v) => currency(v) },
    { key: 'totalAmount', label: 'Total', render: (v) => <strong>{currency(v)}</strong> },
    {
      key: 'id',
      label: 'Actions',
      render: (_, row) => (
        <div className={styles.actions}>
          <button className={styles.btnWarning} onClick={() => openPurchaseReturn(row)}>Return</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Stock Management</h2>
          <p className={styles.pageSubtitle}>Medical inventory, vendor purchases, and input GST tracking</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setPurchaseModal(true)}>+ Record Purchase</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Items', value: inventoryTotal, color: '#2563eb' },
          { label: 'Low Stock Items', value: lowStock.length, color: '#dc2626' },
          { label: 'Total Stock Value', value: currency(totalValue), color: '#16a34a' },
          { label: 'Total Purchases', value: purchaseTotal, color: '#7c3aed' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#fff', border: `2px solid ${s.color}20`, borderRadius: 12, padding: 16, borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
          Low stock alert: {lowStock.map((m) => m.name).join(', ')}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        {['stock', 'purchases', 'analytics'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderBottom:tab === t ? '3px solid #2563eb' : '3px solid transparent',
              background: 'none',
              fontWeight: 600,
              fontSize: 14,
              color:tab === t ? '#2563eb' : '#64748b',
              cursor: 'pointer',
            }}
          >
            {t === 'stock' ? 'Current Stock' : t === 'purchases' ? 'Purchase History' : 'Advanced Analytics'}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {tab === 'stock' && (
            <button className={styles.btnSecondary} onClick={handleExportStock} title="Export stock inventory to CSV">Export CSV</button>
          )}
          {tab === 'purchases' && (
            <button className={styles.btnSecondary} onClick={handleExportPurchases} title="Export purchase history to CSV">Export CSV</button>
          )}
        </div>
      </div>

      {tab === 'stock' && expiryAlerts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#dc2626' }}>
              Expiry Alerts ({expiryAlerts.length} medicine{expiryAlerts.length !== 1 ? 's' : ''})
            </span>
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}
            >
              <option value={7}>Expiring in 7 days</option>
              <option value={30}>Expiring in 30 days</option>
              <option value={90}>Expiring in 90 days</option>
              <option value={-1}>Already Expired</option>
            </select>
            {expiryLoading && <span style={{ fontSize: 12, color: '#94a3b8' }}>Loading...</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
            {expiryAlerts.map((m) => {
              const isExpired = m.daysRemaining < 0;
              const isUrgent = m.daysRemaining >= 0 && m.daysRemaining < 7;
              const bg = isExpired ? '#fef2f2' : isUrgent ? '#fff7ed' : '#fffbeb';
              const border = isExpired ? '#fecaca' : isUrgent ? '#fed7aa' : '#fde68a';
              const color = isExpired ? '#dc2626' : isUrgent ? '#c2410c' : '#b45309';
              return (
                <div key={m.id} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{m.category} · Stock: {m.stockQuantity}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Expiry: {m.expiryDate || 'N/A'}</div>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, color, flexShrink: 0, marginLeft: 8 }}>
                    {isExpired ? 'EXPIRED' : m.daysRemaining === 0 ? 'Today' : `${m.daysRemaining}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'stock' && (
        <div className={styles.card}>
          <Table columns={stockCols} data={medications} loading={loading} />
          <PaginationControls
            meta={medPagination}
            onPageChange={(next) => setMedPage(next)}
            onPerPageChange={(value) => { setMedPerPage(value); setMedPage(1); }}
          />
        </div>
      )}
      {tab === 'purchases' && (
        <div className={styles.card}>
          <Table columns={purchaseCols} data={purchases} loading={loading} emptyMessage="No purchases recorded yet" />
          <PaginationControls
            meta={purchasePagination}
            onPageChange={(next) => setPurchasePage(next)}
            onPerPageChange={(value) => { setPurchasePerPage(value); setPurchasePage(1); }}
          />
        </div>
      )}
      {tab === 'analytics' && (
        <div className={styles.card} style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button className={styles.btnSecondary} onClick={downloadStockAnalyticsCsv} disabled={!stockAnalytics}>
              Export Analytics CSV
            </button>
          </div>
          {analyticsLoading ? (
            <div style={{ textAlign: 'center', color: '#64748b', padding: 30 }}>Loading analytics...</div>
          ) : !stockAnalytics ? (
            <div style={{ textAlign: 'center', color: '#64748b', padding: 30 }}>No analytics data found.</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 14 }}>
                {[
                  ['Stock Value', currency(stockAnalytics.summary?.totalStockValue)],
                  ['Dead Stock', stockAnalytics.summary?.deadStockCount || 0],
                  ['Expiry Risk', stockAnalytics.summary?.expiryRiskCount || 0],
                  ['Near Expiry Value', currency(stockAnalytics.summary?.nearExpiryValue)],
                  ['Fast Movers', stockAnalytics.summary?.fastMoverCount || 0],
                  ['Slow Movers', stockAnalytics.summary?.slowMoverCount || 0],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 19, fontWeight: 700, color: '#1e293b' }}>{value}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className={styles.card} style={{ padding: 10, gridColumn: 'span 2' }}>
                  <h4 style={{ margin: '0 0 8px', color: '#334155' }}>Stock Movement Trend</h4>
                  {(stockAnalytics.monthlyMovement || []).length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: 13 }}>No movement trend data in selected period.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={stockAnalytics.monthlyMovement || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="purchaseQty" stroke="#2563eb" strokeWidth={2} name="Purchased Qty" />
                        <Line type="monotone" dataKey="saleQty" stroke="#16a34a" strokeWidth={2} name="Sold Qty" />
                        <Line type="monotone" dataKey="netSaleQty" stroke="#d97706" strokeWidth={2} name="Net Sold Qty" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div>
                  <h4 style={{ margin: '0 0 8px', color: '#334155' }}>Dead Stock (Top)</h4>
                  <Table
                    columns={[
                      { key: 'name', label: 'Medicine' },
                      { key: 'stockQuantity', label: 'Qty' },
                      { key: 'stockValue', label: 'Value', render: (v) => currency(v) },
                      { key: 'lastMovementDate', label: 'Last Move', render: (v) => v || '-' },
                    ]}
                    data={(stockAnalytics.deadStock || []).slice(0, 10)}
                    emptyMessage="No dead stock"
                  />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 8px', color: '#334155' }}>Expiry Risk (Top)</h4>
                  <Table
                    columns={[
                      { key: 'name', label: 'Medicine' },
                      { key: 'nearExpiryQty', label: 'Near-Exp Qty' },
                      { key: 'nearestExpiryDate', label: 'Nearest Expiry' },
                      { key: 'nearExpiryValue', label: 'Value', render: (v) => currency(v) },
                    ]}
                    data={(stockAnalytics.expiryRisk || []).slice(0, 10)}
                    emptyMessage="No expiry risk"
                  />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 8px', color: '#334155' }}>Fast Movers (Top)</h4>
                  <Table
                    columns={[
                      { key: 'name', label: 'Medicine' },
                      { key: 'netSoldQty', label: `Sold (${stockAnalytics.params?.lookbackDays || 90}d)` },
                      { key: 'velocityPer30Days', label: 'Velocity/30d' },
                      { key: 'daysOfCover', label: 'Days of Cover', render: (v) => (v == null ? '-' : Number(v).toFixed(1)) },
                    ]}
                    data={(stockAnalytics.fastMovers || []).slice(0, 10)}
                    emptyMessage="No fast movers"
                  />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 8px', color: '#334155' }}>Slow Movers (Top)</h4>
                  <Table
                    columns={[
                      { key: 'name', label: 'Medicine' },
                      { key: 'stockQuantity', label: 'Qty' },
                      { key: 'stockValue', label: 'Stock Value', render: (v) => currency(v) },
                      { key: 'netSoldQty', label: `Sold (${stockAnalytics.params?.lookbackDays || 90}d)` },
                    ]}
                    data={(stockAnalytics.slowMovers || []).slice(0, 10)}
                    emptyMessage="No slow movers"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <Modal isOpen={!!stockModal} onClose={() => setStockModal(null)} title={`${stockModal?.op === 'add' ? 'Add' : 'Remove'} Stock`} size="sm">
        <form onSubmit={handleStockUpdate} className={styles.form}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
              Current Stock: <strong>{stockModal?.stockQuantity ?? '-'}</strong>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Quantity</label>
              <input
                type="number"
                min={1}
                className={styles.input}
                value={stockModal?.qty || 1}
                onChange={(e) => setStockModal((s) => ({ ...s, qty: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setStockModal(null)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>Update Stock</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={purchaseModal} onClose={() => setPurchaseModal(false)} title="Record Medicine Purchase" size="lg">
        <form onSubmit={handlePurchase} className={styles.form}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Select existing medicine or create one instantly.</div>
            <button type="button" className={styles.btnSecondary} onClick={() => setShowCreateMedicine((v) => !v)}>
              {showCreateMedicine ? 'Hide Create Medicine' : '+ Create New Medicine'}
            </button>
          </div>

          {showCreateMedicine && (
            <div className={styles.card} style={{ padding: 12, marginBottom: 14, border: '1px solid #dbeafe', background: '#f8fbff' }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#1e3a8a' }}>Create Medicine Master</div>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Medicine Name *</label>
                  <input className={styles.input} value={newMedForm.name} onChange={(e) => setNewMedForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Generic Name</label>
                  <input className={styles.input} value={newMedForm.genericName} onChange={(e) => setNewMedForm((f) => ({ ...f, genericName: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Category</label>
                  <select className={styles.input} value={newMedForm.category} onChange={(e) => setNewMedForm((f) => ({ ...f, category: e.target.value }))}>
                    {['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'patch', 'suppository', 'vaccine', 'other'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Dosage</label>
                  <input className={styles.input} value={newMedForm.dosage} onChange={(e) => setNewMedForm((f) => ({ ...f, dosage: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>MRP</label>
                  <input type="number" min={0} step="0.01" className={styles.input} value={newMedForm.unitPrice} onChange={(e) => setNewMedForm((f) => ({ ...f, unitPrice: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Purchase Price</label>
                  <input type="number" min={0} step="0.01" className={styles.input} value={newMedForm.purchasePrice} onChange={(e) => setNewMedForm((f) => ({ ...f, purchasePrice: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>GST %</label>
                  <input type="number" min={0} step="0.01" className={styles.input} value={newMedForm.gstRate} onChange={(e) => setNewMedForm((f) => ({ ...f, gstRate: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>HSN Code</label>
                  <input className={styles.input} value={newMedForm.hsnCode} onChange={(e) => setNewMedForm((f) => ({ ...f, hsnCode: e.target.value }))} />
                </div>
                {isSuperAdmin && (
                  <div className={styles.field} style={{ gridColumn: 'span 2' }}>
                    <label className={styles.label}>Hospital *</label>
                    <SearchableSelect
                      className={styles.input}
                      value={newMedForm.hospitalId}
                      onChange={(value) => setNewMedForm((f) => ({ ...f, hospitalId: value }))}
                      options={hospitals.map((h) => ({ value: h.id, label: h.name }))}
                      placeholder="Search hospital..."
                      emptyLabel="Select Hospital"
                    />
                  </div>
                )}
              </div>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className={styles.btnSecondary} onClick={handleCreateMedicine} disabled={savingNewMedicine}>
                    {savingNewMedicine ? 'Creating...' : 'Create Only'}
                  </button>
                  <button type="button" className={styles.btnPrimary} onClick={handleCreateAndPurchase} disabled={savingNewMedicine || savingPurchase}>
                    {(savingNewMedicine || savingPurchase) ? 'Working...' : 'Create & Purchase'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Medication *</label>
              <SearchableSelect
                className={styles.input}
                value={purchaseForm.medicationId}
                onChange={(value) => {
                  const med = medications.find((m) => m.id === value);
                  setPurchaseForm((f) => ({
                    ...f,
                    medicationId: value,
                    unitCost: Number(med?.purchasePrice || med?.unitPrice || 0),
                    taxPct: Number(med?.gstRate || 0),
                  }));
                }}
                options={medications.map((m) => ({ value: m.id, label: `${m.name} (${m.dosage || '-'})` }))}
                placeholder="Search medication..."
                emptyLabel="Select Medication"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Vendor</label>
              <SearchableSelect
                className={styles.input}
                value={purchaseForm.vendorId}
                onChange={(value) => setPurchaseForm((f) => ({ ...f, vendorId: value }))}
                options={vendors.map((v) => ({ value: v.id, label: v.name }))}
                placeholder="Search vendor..."
                emptyLabel="Select Vendor"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Quantity *</label>
              <input type="number" min={1} className={styles.input} value={purchaseForm.quantity} onChange={(e) => setPurchaseForm((f) => ({ ...f, quantity: e.target.value }))} required />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Unit Cost</label>
              <input type="number" min={0} step="0.01" className={styles.input} value={purchaseForm.unitCost} onChange={(e) => setPurchaseForm((f) => ({ ...f, unitCost: e.target.value }))} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Batch Number</label>
              <input className={styles.input} value={purchaseForm.batchNo} onChange={(e) => setPurchaseForm((f) => ({ ...f, batchNo: e.target.value }))} placeholder="e.g. B2402A" />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Mfg Date</label>
              <input type="date" className={styles.input} value={purchaseForm.mfgDate} onChange={(e) => setPurchaseForm((f) => ({ ...f, mfgDate: e.target.value }))} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Expiry Date</label>
              <input type="date" className={styles.input} value={purchaseForm.expiryDate} onChange={(e) => setPurchaseForm((f) => ({ ...f, expiryDate: e.target.value }))} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Discount %</label>
              <input type="number" min={0} step="0.01" className={styles.input} value={purchaseForm.discountPct} onChange={(e) => setPurchaseForm((f) => ({ ...f, discountPct: e.target.value }))} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>GST %</label>
              <input type="number" min={0} step="0.01" className={styles.input} value={purchaseForm.taxPct} onChange={(e) => setPurchaseForm((f) => ({ ...f, taxPct: e.target.value }))} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Supplier Invoice Number</label>
              <input className={styles.input} value={purchaseForm.invoiceNumber} onChange={(e) => setPurchaseForm((f) => ({ ...f, invoiceNumber: e.target.value }))} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Purchase Date</label>
              <input type="date" className={styles.input} value={purchaseForm.purchaseDate} onChange={(e) => setPurchaseForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
            </div>

            <div className={styles.field} style={{ gridColumn: 'span 2' }}>
              <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, fontSize: 14, color: '#15803d' }}>
                Taxable: <strong>{currency(computedPurchase.taxable)}</strong> | Input GST: <strong>{currency(computedPurchase.taxAmount)}</strong> | Total: <strong>{currency(computedPurchase.total)}</strong>
                {selectedMedication?.hsnCode ? <span> | HSN: <strong>{selectedMedication.hsnCode}</strong></span> : null}
              </div>
            </div>

            <div className={styles.field} style={{ gridColumn: 'span 2' }}>
              <label className={styles.label}>Notes</label>
              <textarea className={styles.input} rows={2} value={purchaseForm.notes} onChange={(e) => setPurchaseForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setPurchaseModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={savingPurchase}>
              {savingPurchase ? 'Saving...' : 'Record Purchase'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!purchaseReturnModal}
        onClose={() => setPurchaseReturnModal(null)}
        title={`Purchase Return${purchaseReturnModal?.invoiceNumber ? ` - ${purchaseReturnModal.invoiceNumber}` : ''}`}
        size="sm"
      >
        <form onSubmit={handlePurchaseReturn} className={styles.form}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: 10, fontSize: 13, color: '#9a3412' }}>
              This will decrease stock and create a debit-note style purchase return.
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Return Quantity</label>
              <input
                type="number"
                min={1}
                max={Number(purchaseReturnModal?.quantity || 1)}
                className={styles.input}
                value={purchaseReturnForm.quantity}
                onChange={(e) => setPurchaseReturnForm((f) => ({ ...f, quantity: e.target.value }))}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Reason</label>
              <input
                className={styles.input}
                value={purchaseReturnForm.reason}
                onChange={(e) => setPurchaseReturnForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. damaged/expired supply"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Notes</label>
              <textarea
                className={styles.input}
                rows={2}
                value={purchaseReturnForm.notes}
                onChange={(e) => setPurchaseReturnForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setPurchaseReturnModal(null)}>Cancel</button>
            <button type="submit" className={styles.btnWarning} disabled={savingPurchaseReturn}>
              {savingPurchaseReturn ? 'Saving...' : 'Create Return'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!batchModal}
        onClose={() => setBatchModal(null)}
        title={`Batch & Ledger${batchModal ? ` - ${batchModal.name}` : ''}`}
        size="lg"
      >
        {batchLoading ? (
          <div style={{ padding: 20, color: '#64748b' }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className={styles.card} style={{ padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Available Batches (FEFO order)</div>
              {batchData.length === 0 ? (
                <div style={{ fontSize: 13, color: '#64748b' }}>No active batches</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {['Batch', 'Mfg', 'Expiry', 'Qty', 'Unit Cost'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: '#64748b' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {batchData.map((b) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>{b.batchNo}</td>
                        <td style={{ padding: '7px 10px' }}>{b.mfgDate || '-'}</td>
                        <td style={{ padding: '7px 10px' }}>{b.expiryDate || '-'}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 700 }}>{b.quantityOnHand}</td>
                        <td style={{ padding: '7px 10px' }}>{currency(b.unitCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className={styles.card} style={{ padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Recent Stock Ledger</div>
              {ledgerData.length === 0 ? (
                <div style={{ fontSize: 13, color: '#64748b' }}>No ledger entries</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {['Date', 'Type', 'Batch', 'In', 'Out', 'Balance', 'Ref'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: '#64748b' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData.map((e) => (
                      <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '7px 10px' }}>{e.entryDate}</td>
                        <td style={{ padding: '7px 10px' }}>{e.entryType}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>{e.batch.batchNo || '-'}</td>
                        <td style={{ padding: '7px 10px' }}>{e.quantityIn}</td>
                        <td style={{ padding: '7px 10px' }}>{e.quantityOut}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 700 }}>{e.balanceAfter}</td>
                        <td style={{ padding: '7px 10px' }}>{e.referenceType || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
