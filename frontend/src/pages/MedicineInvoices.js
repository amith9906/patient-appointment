import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { medicineInvoiceAPI, medicationAPI, patientAPI, pdfAPI } from '../services/api';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { toast } from 'react-toastify';
import styles from './Page.module.css';
import PaginationControls from '../components/PaginationControls';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#64748b'];
const currency = (val) => `Rs ${Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const toRequestHash = (raw) => {
  const str = String(raw || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const round2 = (v) => Math.round(Number(v || 0) * 100) / 100;
const INIT_ITEM = { medicationId: '', quantity: 1, unitPrice: 0, discountPct: 0, taxPct: 0 };
const INVOICE_DRAFT_KEY = 'medicine_invoice_draft_v1';
const INVOICE_NAMED_DRAFTS_KEY = 'medicine_invoice_named_drafts_v1';
const CUSTOM_TEMPLATE_KEY = 'medicine_invoice_custom_templates_v1';
const QUICK_MEDICINE_INIT = {
  name: '',
  genericName: '',
  category: 'tablet',
  dosage: '',
  unitPrice: 0,
  purchasePrice: 0,
  gstRate: 0,
  hsnCode: '',
  requiresPrescription: true,
};

const getEmptyInvoiceForm = () => ({
  patientId: '',
  patientSearch: '',
  invoiceDate: new Date().toISOString().slice(0, 10),
  paymentMode: 'cash',
  isPaid: true,
  notes: '',
  items: [{ ...INIT_ITEM }],
});
const normalizeInvoiceForm = (candidate) => ({
  ...getEmptyInvoiceForm(),
  ...(candidate || {}),
  items: Array.isArray(candidate?.items) && candidate.items.length ? candidate.items : [{ ...INIT_ITEM }],
});

const GST_RATE_COLORS = {
  0: { bg: '#f1f5f9', color: '#64748b' },
  5: { bg: '#dcfce7', color: '#15803d' },
  12: { bg: '#dbeafe', color: '#1d4ed8' },
  18: { bg: '#ede9fe', color: '#6d28d9' },
  28: { bg: '#fee2e2', color: '#b91c1c' },
};
const RETURN_REASON_TEMPLATES = [
  'Wrong medicine dispensed',
  'Duplicate billing',
  'Patient returned sealed strip',
  'Prescription changed by doctor',
  'Damaged/expired strip issued',
];
const QUICK_BASKET_TEMPLATES = [
  {
    key: 'fever-basic',
    label: 'Fever Basic',
    items: [
      { keywords: ['paracetamol', 'acetaminophen'], quantity: 10 },
      { keywords: ['ors'], quantity: 5 },
    ],
  },
  {
    key: 'cold-basic',
    label: 'Cold Basic',
    items: [
      { keywords: ['cetirizine', 'levocetirizine'], quantity: 10 },
      { keywords: ['cough', 'dextromethorphan', 'ambroxol'], quantity: 1 },
      { keywords: ['steam', 'inhalant'], quantity: 1 },
    ],
  },
  {
    key: 'gastritis-basic',
    label: 'Gastritis Basic',
    items: [
      { keywords: ['pantoprazole', 'omeprazole', 'rabeprazole'], quantity: 10 },
      { keywords: ['antacid', 'gel'], quantity: 1 },
    ],
  },
];

function GSTRateBadge({ rate }) {
  const r = Number(rate || 0);
  const colors = GST_RATE_COLORS[r] || { bg: '#f1f5f9', color: '#64748b' };
  return (
    <span style={{ background: colors.bg, color: colors.color, padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
      {r === 0 ? 'Exempt (0%)' : `${r}%`}
    </span>
  );
}

export default function MedicineInvoices() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('create');

  const [medications, setMedications] = useState([]);
  const [patients, setPatients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicePerPage, setInvoicePerPage] = useState(25);
  const [invoicePagination, setInvoicePagination] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [gstReport, setGstReport] = useState(null);
  const [gstLoading, setGstLoading] = useState(false);
  const [allowRiskyExport, setAllowRiskyExport] = useState(false);
  const [cloningInvoiceId, setCloningInvoiceId] = useState('');
  const [loadingPatientLastInvoice, setLoadingPatientLastInvoice] = useState(false);
  const [returnModal, setReturnModal] = useState(null);
  const [returnRows, setReturnRows] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnSaving, setReturnSaving] = useState(false);
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [patientSaving, setPatientSaving] = useState(false);
  const [medicineModalOpen, setMedicineModalOpen] = useState(false);
  const [medicineSaving, setMedicineSaving] = useState(false);
  const [medicineTargetRow, setMedicineTargetRow] = useState(0);
  const [quickMedicine, setQuickMedicine] = useState({ ...QUICK_MEDICINE_INIT });
  const [quickPatient, setQuickPatient] = useState({
    name: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
    bloodGroup: '',
  });

  const [gstInfoOpen, setGstInfoOpen] = useState(false);
  const [gstReportHelpOpen, setGstReportHelpOpen] = useState(false);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [gstRateFilter, setGstRateFilter] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [draftMeta, setDraftMeta] = useState({ loaded: false, hasDraft: false, lastSavedAt: null });
  const [namedDraftName, setNamedDraftName] = useState('');
  const [namedDrafts, setNamedDrafts] = useState([]);
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [customTemplates, setCustomTemplates] = useState([]);
  const [bulkPasteText, setBulkPasteText] = useState('');

  const [form, setForm] = useState(getEmptyInvoiceForm());

  const loadMaster = async () => {
    const [medRes, patRes] = await Promise.all([medicationAPI.getAll(), patientAPI.getAll({ paginate: 'false' })]);
    setMedications(medRes.data || []);
    setPatients(patRes.data || []);
  };

  const loadInvoices = useCallback(async (overrides = {}) => {
    const targetPage = overrides.page ?? invoicePage;
    const targetPerPage = overrides.perPage ?? invoicePerPage;
    const nextFrom = overrides.from ?? from;
    const nextTo = overrides.to ?? to;
    const nextSearch = overrides.search ?? invoiceSearch;
    const params = {
      page: targetPage,
      per_page: targetPerPage,
    };
    if (nextFrom) params.from = nextFrom;
    if (nextTo) params.to = nextTo;
    if (nextSearch) params.search = nextSearch.trim();
    const res = await medicineInvoiceAPI.getAll(params);
    setInvoices(res.data || []);
    setInvoicePagination(res.pagination || null);
  }, [from, to, invoicePage, invoicePerPage, invoiceSearch]);

  const loadAnalytics = async () => {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const res = await medicineInvoiceAPI.getAnalytics(params);
    setAnalytics(res.data || null);
  };

  const loadGSTReport = async () => {
    setGstLoading(true);
    setAllowRiskyExport(false);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      if (gstRateFilter !== '') params.gstRate = gstRateFilter;
      const res = await medicineInvoiceAPI.getGSTReport(params);
      setGstReport(res.data || null);
    } catch {
      toast.error('Failed to load GST report');
    } finally {
      setGstLoading(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadMaster(), loadInvoices(), loadAnalytics()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const invoicesInitialized = useRef(false);
  useEffect(() => {
    if (invoicesInitialized.current) {
      loadInvoices();
    } else {
      invoicesInitialized.current = true;
    }
  }, [loadInvoices]);

  useEffect(() => {
    setInvoicePage(1);
  }, [from, to, invoiceSearch]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(INVOICE_DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      const next = normalizeInvoiceForm(parsed);
      setForm(next);
      setDraftMeta({
        loaded: true,
        hasDraft: true,
        lastSavedAt: parsed.__savedAt || null,
      });
    } catch {
      // Ignore corrupted draft and continue with fresh form
    }
  }, []);

  useEffect(() => {
    if (tab !== 'create') return;
    try {
      localStorage.setItem(
        INVOICE_DRAFT_KEY,
        JSON.stringify({
          ...form,
          __savedAt: new Date().toISOString(),
        })
      );
      setDraftMeta((m) => ({ ...m, hasDraft: true, lastSavedAt: new Date().toISOString() }));
    } catch {
      // Storage failures should not block billing flow
    }
  }, [form, tab]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(INVOICE_NAMED_DRAFTS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      setNamedDrafts(
        parsed
          .filter((d) => d && d.id && d.name && d.form)
          .slice(0, 25)
      );
    } catch {
      // ignore corrupted named draft store
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(INVOICE_NAMED_DRAFTS_KEY, JSON.stringify(namedDrafts.slice(0, 25)));
    } catch {
      // ignore storage issues
    }
  }, [namedDrafts]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_TEMPLATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      setCustomTemplates(parsed.filter((x) => x && x.key && x.label && Array.isArray(x.items)).slice(0, 30));
    } catch {
      // ignore corrupted template store
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_TEMPLATE_KEY, JSON.stringify(customTemplates.slice(0, 30)));
    } catch {
      // ignore storage issues
    }
  }, [customTemplates]);

  useEffect(() => {
    if (tab === 'gst-report') loadGSTReport();
  }, [tab]);

  const setItem = (index, key, value) => {
    setForm((prev) => {
      const next = [...prev.items];
      const item = { ...next[index], [key]: value };
      if (key === 'medicationId') {
        const med = medications.find((m) => m.id === value);
        item.unitPrice = Number(med.unitPrice || 0);
        item.taxPct = Number(med.gstRate || 0);
      }
      next[index] = item;
      return { ...prev, items: next };
    });
  };
  const adjustItemQuantity = (index, delta) => {
    setForm((prev) => {
      const next = [...prev.items];
      const src = next[index];
      if (!src) return prev;
      const current = Math.max(1, Math.trunc(Number(src.quantity || 0) || 0));
      const updatedQty = Math.max(1, current + Number(delta || 0));
      next[index] = { ...src, quantity: updatedQty };
      return { ...prev, items: next };
    });
  };

  const medicationOptionLabel = (medication) =>
    `${medication.name} (Stock: ${medication.stockQuantity} | GST: ${Number(medication.gstRate || 0)}%)`;

  const medicationSearchLabels = (medication) => {
    const labels = [medicationOptionLabel(medication)];
    if (medication.code) labels.push(`${medication.code} | ${medicationOptionLabel(medication)}`);
    if (medication.composition) labels.push(`${medication.composition} | ${medicationOptionLabel(medication)}`);
    if (medication.genericName) labels.push(`${medication.genericName} | ${medicationOptionLabel(medication)}`);
    return labels;
  };

  const getMedicationSearchText = (item) => {
    if (item.medicationSearch && !item.medicationId) return item.medicationSearch;
    const selected = medications.find((m) => m.id === item.medicationId);
    if (selected) return medicationOptionLabel(selected);
    return item.medicationSearch || '';
  };

  const patientOptionLabel = (patient) => `${patient.name} (${patient.patientId || 'NA'} | ${patient.phone || 'NA'})`;

  const getPatientSearchText = () => {
    if (form.patientSearch && !form.patientId) return form.patientSearch;
    const selected = patients.find((p) => p.id === form.patientId);
    if (selected) return patientOptionLabel(selected);
    return form.patientSearch || '';
  };

  const handlePatientSearch = (text) => {
    setForm((prev) => {
      const matched = patients.find((patient) => patientOptionLabel(patient) === text);
      if (matched) return { ...prev, patientId: matched.id, patientSearch: text };
      if (!text.trim()) return { ...prev, patientId: '', patientSearch: '' };
      return { ...prev, patientId: '', patientSearch: text };
    });
  };

  const handleMedicationSearch = (index, text) => {
    setForm((prev) => {
      const next = [...prev.items];
      const item = { ...next[index], medicationSearch: text };
      const normalized = String(text || '').trim().toLowerCase();
      const matched = medications.find((medication) => {
        if (medicationSearchLabels(medication).includes(text)) return true;
        if (!normalized) return false;
        return [
          medication.id,
          medication.code,
          medication.name,
          medication.genericName,
          medication.composition,
        ]
          .filter(Boolean)
          .some((v) => String(v).trim().toLowerCase() === normalized);
      });
      if (matched) {
        item.medicationId = matched.id;
        item.unitPrice = Number(matched.unitPrice || 0);
        item.taxPct = Number(matched.gstRate || 0);
      } else {
        item.medicationId = '';
      }
      next[index] = item;
      return { ...prev, items: next };
    });
  };

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, { ...INIT_ITEM }] }));
  const removeItem = (index) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  const duplicateItem = (index) => {
    setForm((prev) => {
      const src = prev.items[index];
      if (!src) return prev;
      const clone = {
        ...src,
        medicationSearch: getMedicationSearchText(src),
      };
      const next = [...prev.items];
      next.splice(index + 1, 0, clone);
      return { ...prev, items: next };
    });
  };

  const applyQuickPreset = (preset) => {
    setForm((prev) => ({
      ...prev,
      patientId: '',
      patientSearch: '',
      paymentMode: preset.paymentMode,
      isPaid: preset.isPaid,
      notes: preset.note || prev.notes,
    }));
    toast.info(`Quick preset applied: ${preset.label}`);
  };

  const saveCurrentAsNamedDraft = () => {
    const name = String(namedDraftName || '').trim();
    if (!name) return toast.error('Enter draft name');
    const snapshot = {
      ...form,
      __savedAt: new Date().toISOString(),
    };
    setNamedDrafts((prev) => {
      const existing = prev.find((d) => d.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        return prev.map((d) => (d.id === existing.id ? { ...d, form: snapshot, savedAt: snapshot.__savedAt } : d));
      }
      return [
        {
          id: `draft-${Date.now()}`,
          name,
          savedAt: snapshot.__savedAt,
          form: snapshot,
        },
        ...prev,
      ].slice(0, 25);
    });
    setNamedDraftName('');
    toast.success('Named draft saved');
  };

  const loadNamedDraft = (draft) => {
    const next = normalizeInvoiceForm(draft?.form || {});
    setForm(next);
    setTab('create');
    setDraftMeta((m) => ({
      ...m,
      loaded: true,
      hasDraft: true,
      lastSavedAt: draft?.savedAt || draft?.form?.__savedAt || new Date().toISOString(),
    }));
    toast.success(`Loaded draft: ${draft?.name || 'Unnamed'}`);
  };

  const deleteNamedDraft = (id) => {
    setNamedDrafts((prev) => prev.filter((d) => d.id !== id));
    toast.success('Named draft deleted');
  };

  const findMedicationForTemplate = (keywords = []) => {
    const normalizedKeywords = (keywords || []).map((k) => String(k || '').trim().toLowerCase()).filter(Boolean);
    if (!normalizedKeywords.length) return null;
    return medications.find((med) => {
      const hay = [
        med.name,
        med.genericName,
        med.composition,
        med.code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return normalizedKeywords.some((kw) => hay.includes(kw));
    }) || null;
  };

  const applyQuickBasketTemplate = (template) => {
    const matchedRows = [];
    const missingItems = [];
    for (const tplItem of template.items || []) {
      const med = findMedicationForTemplate(tplItem.keywords || []);
      if (!med) {
        missingItems.push((tplItem.keywords || [])[0] || 'unknown');
        continue;
      }
      matchedRows.push({
        medicationId: med.id,
        medicationSearch: medicationOptionLabel(med),
        quantity: Number(tplItem.quantity || 1),
        unitPrice: Number(med.unitPrice || 0),
        discountPct: 0,
        taxPct: Number(med.gstRate || 0),
      });
    }
    if (!matchedRows.length) {
      return toast.error(`No medicines found for template "${template.label}"`);
    }
    setForm((prev) => ({
      ...prev,
      items: matchedRows,
      notes: prev.notes || `Template applied: ${template.label}`,
    }));
    if (missingItems.length) {
      toast.info(`Template applied with partial match. Missing: ${missingItems.join(', ')}`);
    } else {
      toast.success(`Template applied: ${template.label}`);
    }
  };

  const saveCurrentBasketAsTemplate = () => {
    const label = String(customTemplateName || '').trim();
    if (!label) return toast.error('Enter template name');
    const rows = (form.items || [])
      .filter((r) => r.medicationId && Number(r.quantity || 0) > 0)
      .map((r) => ({
        medicationId: r.medicationId,
        quantity: Number(r.quantity || 1),
        unitPrice: Number(r.unitPrice || 0),
        discountPct: Number(r.discountPct || 0),
        taxPct: Number(r.taxPct || 0),
      }));
    if (!rows.length) return toast.error('Add at least one valid medicine row to save template');

    const key = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    setCustomTemplates((prev) => [{ key, label, items: rows }, ...prev].slice(0, 30));
    setCustomTemplateName('');
    toast.success('Template saved');
  };

  const applyCustomTemplate = (template) => {
    const nextItems = [];
    const missingCount = { value: 0 };
    (template.items || []).forEach((it) => {
      const med = medications.find((m) => m.id === it.medicationId);
      if (!med) {
        missingCount.value += 1;
        return;
      }
      nextItems.push({
        medicationId: med.id,
        medicationSearch: medicationOptionLabel(med),
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || med.unitPrice || 0),
        discountPct: Number(it.discountPct || 0),
        taxPct: Number(it.taxPct || med.gstRate || 0),
      });
    });
    if (!nextItems.length) return toast.error('No medicines from this template exist in master list');
    setForm((prev) => ({
      ...prev,
      items: nextItems,
      notes: prev.notes || `Template applied: ${template.label}`,
    }));
    if (missingCount.value > 0) {
      toast.info(`Template applied. ${missingCount.value} medicine(s) missing from master list`);
    } else {
      toast.success(`Template applied: ${template.label}`);
    }
  };

  const deleteCustomTemplate = (key) => {
    setCustomTemplates((prev) => prev.filter((tpl) => tpl.key !== key));
    toast.success('Template deleted');
  };

  const parseBulkMedicineLines = (rawText) => {
    const lines = String(rawText || '')
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
    return lines.map((line) => {
      let namePart = line;
      let quantity = 1;

      const commaParts = line.split(',');
      if (commaParts.length >= 2) {
        const maybeQty = Number(commaParts[commaParts.length - 1].trim());
        if (Number.isFinite(maybeQty) && maybeQty > 0) {
          quantity = Math.max(1, Math.round(maybeQty));
          namePart = commaParts.slice(0, -1).join(',').trim();
        }
      } else {
        const xMatch = line.match(/^(.*?)(?:\s*[x*]\s*|\s+)(\d+(?:\.\d+)?)$/i);
        if (xMatch) {
          namePart = String(xMatch[1] || '').trim();
          quantity = Math.max(1, Math.round(Number(xMatch[2] || 1)));
        }
      }

      return { raw: line, query: namePart.toLowerCase(), quantity };
    });
  };

  const findMedicationByQuery = (query) => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return null;
    return medications.find((m) => {
      const hay = [m.name, m.genericName, m.composition, m.code]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    }) || null;
  };

  const importBulkMedicines = (mode = 'replace') => {
    const parsed = parseBulkMedicineLines(bulkPasteText);
    if (!parsed.length) return toast.error('Paste at least one medicine line');

    const matched = [];
    const missing = [];
    parsed.forEach((row) => {
      const med = findMedicationByQuery(row.query);
      if (!med) {
        missing.push(row.raw);
        return;
      }
      matched.push({
        medicationId: med.id,
        medicationSearch: medicationOptionLabel(med),
        quantity: Number(row.quantity || 1),
        unitPrice: Number(med.unitPrice || 0),
        discountPct: 0,
        taxPct: Number(med.gstRate || 0),
      });
    });

    if (!matched.length) return toast.error('No pasted medicines matched master list');
    setForm((prev) => ({
      ...prev,
      items: mode === 'append' ? [...prev.items, ...matched] : matched,
      notes: prev.notes || 'Bulk medicine import used',
    }));
    if (missing.length) {
      toast.info(`Imported ${matched.length} item(s). Unmatched: ${missing.length}`);
    } else {
      toast.success(`Imported ${matched.length} item(s)`);
    }
    setBulkPasteText('');
  };

  const computed = useMemo(() => {
    const rows = form.items.map((it) => {
      const qty = Number(it.quantity || 0);
      const unit = Number(it.unitPrice || 0);
      const discPct = Number(it.discountPct || 0);
      const taxPct = Number(it.taxPct || 0);
      const lineSubtotal = round2(qty * unit);
      const lineDiscount = round2((lineSubtotal * discPct) / 100);
      const taxable = lineSubtotal - lineDiscount;
      const lineTax = round2((taxable * taxPct) / 100);
      const lineTotal = round2(taxable + lineTax);
      return { ...it, lineSubtotal, lineDiscount, lineTax, lineTotal };
    });

    const subtotal = rows.reduce((s, r) => s + r.lineSubtotal, 0);
    const discountAmount = rows.reduce((s, r) => s + r.lineDiscount, 0);
    const taxAmount = rows.reduce((s, r) => s + r.lineTax, 0);
    const totalAmount = subtotal - discountAmount + taxAmount;

    return { rows, subtotal, discountAmount, taxAmount, totalAmount };
  }, [form.items]);

  const handleCreate = async (e, options = {}) => {
    e.preventDefault();
    const { createNext = false } = options;
    if (!form.items.length) return toast.error('Add at least one medicine item');
    if (form.items.some((i) => !i.medicationId || Number(i.quantity || 0) <= 0)) {
      return toast.error('Select medicine and valid quantity for all rows');
    }

    setSaving(true);
    try {
      const payload = {
        patientId: form.patientId || null,
        invoiceDate: form.invoiceDate,
        paymentMode: form.paymentMode,
        isPaid: form.isPaid,
        notes: form.notes || null,
        items: form.items.map((it) => ({
          medicationId: it.medicationId,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discountPct: Number(it.discountPct || 0),
          taxPct: Number(it.taxPct || 0),
        })),
      };

      const res = await medicineInvoiceAPI.create(payload);
      toast.success('Medicine invoice created');
      setForm(getEmptyInvoiceForm());
      try { localStorage.removeItem(INVOICE_DRAFT_KEY); } catch { /* no-op */ }
      setDraftMeta({ loaded: false, hasDraft: false, lastSavedAt: null });
      if (!createNext) setTab('list');
      await Promise.all([loadInvoices(), loadAnalytics(), loadMaster()]);

      if (res.data.id && !createNext) {
        try {
          const pdfRes = await pdfAPI.medicineInvoice(res.data.id);
          const url = window.URL.createObjectURL(new Blob([pdfRes.data], { type: 'application/pdf' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = `medicine-invoice-${res.data.invoiceNumber || res.data.id}.pdf`;
          link.click();
          window.URL.revokeObjectURL(url);
        } catch {
          toast.info('Invoice created. PDF download failed; you can download from list.');
        }
      }
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to create medicine invoice');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (tab !== 'create') return undefined;
    const handler = (e) => {
      if (e.key !== 'Enter' || !e.ctrlKey) return;
      if (saving) return;
      e.preventDefault();
      const evt = { preventDefault: () => {} };
      if (e.shiftKey) handleCreate(evt, { createNext: false });
      else handleCreate(evt, { createNext: true });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tab, saving, form, medications]);

  const resetQuickPatient = () => {
    setQuickPatient({ name: '', phone: '', gender: '', dateOfBirth: '', bloodGroup: '' });
  };

  const resetQuickMedicine = () => {
    setQuickMedicine({ ...QUICK_MEDICINE_INIT });
  };

  const openQuickMedicineModal = (rowIndex) => {
    const idx = Number.isInteger(rowIndex) ? rowIndex : 0;
    const target = form.items[idx] || {};
    const prefillName = target.medicationId ? '' : String(target.medicationSearch || '').split('(')[0].trim();
    setMedicineTargetRow(idx);
    setQuickMedicine((prev) => ({
      ...QUICK_MEDICINE_INIT,
      name: prefillName || prev.name || '',
    }));
    setMedicineModalOpen(true);
  };

  const handleQuickMedicineCreate = async (e) => {
    e.preventDefault();
    const name = String(quickMedicine.name || '').trim();
    if (!name) return toast.error('Medicine name is required');

    setMedicineSaving(true);
    try {
      const payload = {
        name,
        genericName: quickMedicine.genericName || null,
        category: quickMedicine.category || 'tablet',
        dosage: quickMedicine.dosage || null,
        unitPrice: Number(quickMedicine.unitPrice || 0),
        purchasePrice: Number(quickMedicine.purchasePrice || quickMedicine.unitPrice || 0),
        gstRate: Number(quickMedicine.gstRate || 0),
        hsnCode: quickMedicine.hsnCode || null,
        requiresPrescription: Boolean(quickMedicine.requiresPrescription),
        stockQuantity: 0,
      };
      const res = await medicationAPI.create(payload);
      const created = res.data;
      setMedications((prev) => [created, ...prev]);
      setForm((prev) => {
        const nextItems = [...prev.items];
        const safeIndex = Math.min(Math.max(Number(medicineTargetRow || 0), 0), nextItems.length - 1);
        if (nextItems[safeIndex]) {
          nextItems[safeIndex] = {
            ...nextItems[safeIndex],
            medicationId: created.id,
            medicationSearch: medicationOptionLabel(created),
            unitPrice: Number(created.unitPrice || 0),
            taxPct: Number(created.gstRate || 0),
          };
        }
        return { ...prev, items: nextItems };
      });
      toast.success('Medicine created and selected');
      setMedicineModalOpen(false);
      resetQuickMedicine();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create medicine');
    } finally {
      setMedicineSaving(false);
    }
  };

  const handleQuickPatientCreate = async (e) => {
    e.preventDefault();
    if (!quickPatient.name.trim()) return toast.error('Patient name is required');
    if (!quickPatient.phone.trim()) return toast.error('Patient phone is required');

    setPatientSaving(true);
    try {
      const payload = {
        name: quickPatient.name.trim(),
        phone: quickPatient.phone.trim(),
        gender: quickPatient.gender || null,
        dateOfBirth: quickPatient.dateOfBirth || null,
        bloodGroup: quickPatient.bloodGroup || null,
      };
      const res = await patientAPI.create(payload);
      const created = res.data;
      const nextPatients = [created, ...patients];
      setPatients(nextPatients);
      setForm((prev) => ({
        ...prev,
        patientId: created.id,
        patientSearch: patientOptionLabel(created),
      }));
      toast.success('Patient added and selected');
      setPatientModalOpen(false);
      resetQuickPatient();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add patient');
    } finally {
      setPatientSaving(false);
    }
  };

  const handleMarkPaid = async (id, isPaid) => {
    try {
      await medicineInvoiceAPI.markPaid(id, isPaid);
      toast.success(isPaid ? 'Marked as paid' : 'Marked as unpaid');
      await Promise.all([loadInvoices(), loadAnalytics()]);
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to update payment');
    }
  };

  const handleDownload = async (id, invoiceNumber) => {
    try {
      const res = await pdfAPI.medicineInvoice(id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `medicine-invoice-${invoiceNumber || id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download invoice PDF');
    }
  };

  const applyInvoiceToDraft = (src, options = {}) => {
    const { notePrefix = '' } = options;
    const nextItems = (src.items || []).map((it) => {
      const medInMaster = medications.find((m) => m.id === it.medicationId);
      return {
        medicationId: it.medicationId,
        medicationSearch: medInMaster ? medicationOptionLabel(medInMaster) : (it.medication?.name || ''),
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || 0),
        discountPct: Number(it.discountPct || 0),
        taxPct: Number(it.taxPct || 0),
      };
    });
    const patientLabel = src.patient ? patientOptionLabel(src.patient) : '';
    setForm({
      ...getEmptyInvoiceForm(),
      patientId: src.patientId || '',
      patientSearch: patientLabel,
      invoiceDate: new Date().toISOString().slice(0, 10),
      paymentMode: src.paymentMode || 'cash',
      isPaid: Boolean(src.isPaid),
      notes: src.invoiceNumber ? `${notePrefix}${src.invoiceNumber}` : '',
      items: nextItems.length ? nextItems : [{ ...INIT_ITEM }],
    });
    setTab('create');
  };

  const loadPatientLastInvoice = async () => {
    if (!form.patientId) return toast.error('Select a patient first');
    setLoadingPatientLastInvoice(true);
    try {
      const listRes = await medicineInvoiceAPI.getAll({ patientId: form.patientId });
      const latest = (listRes.data || [])[0];
      if (!latest?.id) {
        return toast.info('No previous medicine invoice found for selected patient');
      }
      const fullRes = await medicineInvoiceAPI.getOne(latest.id);
      applyInvoiceToDraft(fullRes.data, { notePrefix: 'Loaded from last invoice: ' });
      toast.success('Loaded patient last invoice to draft');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load patient last invoice');
    } finally {
      setLoadingPatientLastInvoice(false);
    }
  };

  const loadPatientLastBasket = async () => {
    if (!form.patientId) return toast.error('Select a patient first');
    setLoadingPatientLastInvoice(true);
    try {
      const listRes = await medicineInvoiceAPI.getAll({ patientId: form.patientId });
      const latest = (listRes.data || [])[0];
      if (!latest?.id) {
        return toast.info('No previous medicine invoice found for selected patient');
      }
      const fullRes = await medicineInvoiceAPI.getOne(latest.id);
      const full = fullRes.data || {};
      const nextItems = (full.items || []).map((it) => {
        const medInMaster = medications.find((m) => m.id === it.medicationId);
        return {
          medicationId: it.medicationId,
          medicationSearch: medInMaster ? medicationOptionLabel(medInMaster) : (it.medication?.name || ''),
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || 0),
          discountPct: Number(it.discountPct || 0),
          taxPct: Number(it.taxPct || 0),
        };
      });
      setForm((prev) => ({
        ...prev,
        items: nextItems.length ? nextItems : [{ ...INIT_ITEM }],
        notes: prev.notes || (full.invoiceNumber ? `Repeated basket from ${full.invoiceNumber}` : prev.notes),
      }));
      toast.success('Repeated last basket for selected patient');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to repeat patient last basket');
    } finally {
      setLoadingPatientLastInvoice(false);
    }
  };

  const handleCloneToCreate = async (id) => {
    setCloningInvoiceId(id);
    try {
      const res = await medicineInvoiceAPI.getOne(id);
      applyInvoiceToDraft(res.data, { notePrefix: 'Cloned from ' });
      toast.success('Invoice cloned to draft. Update quantity/price and create.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to clone invoice');
    } finally {
      setCloningInvoiceId('');
    }
  };

  const invoiceColumns = [
    { key: 'invoiceNumber', label: 'Invoice #', render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v || '-'}</span> },
    { key: 'invoiceDate', label: 'Date' },
    { key: 'patient', label: 'Patient', render: (v) => v?.name || 'Walk-in' },
    { key: 'paymentMode', label: 'Mode', render: (v) => (v || 'cash').replace(/_/g, ' ') },
    { key: 'totalAmount', label: 'Amount', render: (v) => <strong>{currency(v)}</strong> },
    { key: 'isPaid', label: 'Payment', render: (v) => (
      <span style={{
        background:v ? '#dcfce7' : '#fee2e2',
        color:v ? '#15803d' : '#b91c1c',
        padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      }}>
        {v ? 'Paid' : 'Unpaid'}
      </span>
    )},
    {
      key: 'id', label: 'Actions', render: (_, row) => (
        <div className={styles.actions}>
          <button
            className={styles.btnSecondary}
            disabled={cloningInvoiceId === row.id}
            onClick={() => handleCloneToCreate(row.id)}
          >
            {cloningInvoiceId === row.id ? 'Cloning...' : 'Clone to New'}
          </button>
          <button className={styles.btnEdit} onClick={() => handleDownload(row.id, row.invoiceNumber)}>Download PDF</button>
          <button
            className={row.isPaid ? styles.btnWarning : styles.btnSuccess}
            onClick={() => handleMarkPaid(row.id, !row.isPaid)}
          >
            {row.isPaid ? 'Mark Unpaid' : 'Mark Paid'}
          </button>
          <button className={styles.btnWarning} onClick={() => openReturnModal(row)}>Return</button>
        </div>
      ),
    },
  ];

  const summary = analytics?.summary || { totalInvoices: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0, collectionRate: 0 };
  const dayWise = analytics?.dayWise || [];
  const categoryWise = analytics?.categoryWise || [];
  const topMedicines = analytics?.topMedicines || [];

  const gstSummary = gstReport?.summary || {
    totalInvoices: 0,
    totalTaxableAmount: 0,
    totalGSTAmount: 0,
    outputGSTAmount: 0,
    inputGSTAmount: 0,
    netTaxPayable: 0,
    byRate: [],
  };
  const gstReconciliation = gstReport?.reconciliation || null;
  const gstWarnings = gstReport?.warnings || [];
  const mismatchCount = useMemo(() => {
    if (!gstReconciliation) return 0;
    const checks = [
      gstReconciliation.salesItemsVsInvoiceHeaders,
      gstReconciliation.salesReturnsItemsVsReturnHeaders,
      gstReconciliation.outputByRateVsOutputTotals,
      gstReconciliation.inputByRateVsInputTotals,
      gstReconciliation.netFormulaCheck,
    ];
    return checks.filter((c) => c && c.isMatched === false).length;
  }, [gstReconciliation]);
  const filingReady = mismatchCount === 0 && gstWarnings.length === 0;
  const outputGstValue = gstSummary.outputGSTAmount || gstSummary.totalGSTAmount || 0;
  const inputGstValue = gstSummary.inputGSTAmount || 0;
  const inputCoveragePct = outputGstValue > 0 ? ((inputGstValue / outputGstValue) * 100) : 0;

  const handleDownloadGSTCsv = () => {
    if (!gstReport) return;
    const lines = [];
    lines.push('Section,Rate,Count,TaxableAmount,GSTAmount');
    (gstSummary.byRate || []).forEach((row) => {
      lines.push(`Sales,${row.gstRate},${row.invoiceCount || 0},${Number(row.taxableAmount || 0).toFixed(2)},${Number(row.gstAmount || 0).toFixed(2)}`);
    });
    (gstPurchases.byRate || []).forEach((row) => {
      lines.push(`Purchases,${row.gstRate},${row.purchaseCount || 0},${Number(row.taxableAmount || 0).toFixed(2)},${Number(row.gstAmount || 0).toFixed(2)}`);
    });
    const outputGst = gstSummary.outputGSTAmount || gstSummary.totalGSTAmount || 0;
    lines.push(`Summary,OutputGST,,${Number(gstSummary.totalTaxableAmount || 0).toFixed(2)},${Number(outputGst).toFixed(2)}`);
    lines.push(`Summary,InputGST,,${Number(gstPurchases.totalTaxableAmount || 0).toFixed(2)},${Number(gstSummary.inputGSTAmount || 0).toFixed(2)}`);
    lines.push(`Summary,NetTaxPayable,,,${Number(gstSummary.netTaxPayable || 0).toFixed(2)}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gst-report-${from || 'start'}-to-${to || 'end'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadReconciliationCsv = () => {
    if (!gstReport || !gstReconciliation) return;
    const lines = [];
    lines.push('Section,Check,DiffTaxable,DiffGST,Status');
    const rows = [
      ['Reconciliation', 'Sales Items vs Invoice Headers', gstReconciliation.salesItemsVsInvoiceHeaders.diffTaxable || 0, gstReconciliation.salesItemsVsInvoiceHeaders.diffGST || 0, gstReconciliation.salesItemsVsInvoiceHeaders.isMatched ? 'PASS' : 'MISMATCH'],
      ['Reconciliation', 'Sales Returns Items vs Return Headers', gstReconciliation.salesReturnsItemsVsReturnHeaders.diffTaxable || 0, gstReconciliation.salesReturnsItemsVsReturnHeaders.diffGST || 0, gstReconciliation.salesReturnsItemsVsReturnHeaders.isMatched ? 'PASS' : 'MISMATCH'],
      ['Reconciliation', 'Output By Rate vs Output Total', gstReconciliation.outputByRateVsOutputTotals.diffTaxable || 0, gstReconciliation.outputByRateVsOutputTotals.diffGST || 0, gstReconciliation.outputByRateVsOutputTotals.isMatched ? 'PASS' : 'MISMATCH'],
      ['Reconciliation', 'Input By Rate vs Input Total', gstReconciliation.inputByRateVsInputTotals.diffTaxable || 0, gstReconciliation.inputByRateVsInputTotals.diffGST || 0, gstReconciliation.inputByRateVsInputTotals.isMatched ? 'PASS' : 'MISMATCH'],
      ['Reconciliation', 'Net Formula Check', '', gstReconciliation.netFormulaCheck.diff || 0, gstReconciliation.netFormulaCheck.isMatched ? 'PASS' : 'MISMATCH'],
    ];
    rows.forEach((r) => lines.push(`${r[0]},${r[1]},${r[2]},${r[3]},${r[4]}`));
    lines.push(`Summary,Filing Ready,,,${filingReady ? 'YES' : 'NO'}`);
    lines.push(`Summary,Mismatch Count,,,${mismatchCount}`);
    if (gstWarnings.length > 0) {
      gstWarnings.forEach((w, i) => lines.push(`Warning #${i + 1},"${String(w).replace(/"/g, '""')}",,,`));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gst-reconciliation-${from || 'start'}-to-${to || 'end'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadReconciliationJson = () => {
    if (!gstReport || !gstReconciliation) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      period: gstReport.range || { from: from || null, to: to || null },
      filingReadiness: {
        isReady: filingReady,
        mismatchCount,
        warningCount: gstWarnings.length,
      },
      warnings: gstWarnings,
      reconciliation: gstReconciliation,
      summary: gstSummary,
      purchases: gstPurchases,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gst-reconciliation-${from || 'start'}-to-${to || 'end'}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadGSTRJson = async (type) => {
    if (!filingReady && !allowRiskyExport) {
      toast.error('GSTR export is locked due to reconciliation mismatches. Resolve checks or unlock manually.');
      return;
    }
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const res = type === 'gstr1'
        ? await medicineInvoiceAPI.getGSTR1(params)
        : await medicineInvoiceAPI.getGSTR3B(params);
      const blob = new Blob([JSON.stringify(res.data || {}, null, 2)], { type: 'application/json;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${from || 'start'}-to-${to || 'end'}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response.data.message || `Failed to download ${type.toUpperCase()} export`);
    }
  };

  const handleDownloadMargCsv = async () => {
    if (!filingReady && !allowRiskyExport) {
      toast.error('Marg export is locked due to reconciliation mismatches. Resolve checks or unlock manually.');
      return;
    }
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await medicineInvoiceAPI.getMargGstExport(params);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `marg-gst-export-${from || 'start'}-to-${to || 'end'}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download Marg GST export');
    }
  };

  const openReturnModal = async (row) => {
    try {
      const res = await medicineInvoiceAPI.getOne(row.id);
      const full = res.data;
      setReturnRows((full.items || []).map((it) => ({
        invoiceItemId: it.id,
        medicationName: it.medication?.name || 'Medicine',
        soldQty: Number(it.quantity || 0),
        quantity: 0,
        lineTotal: Number(it.lineTotal || 0),
        lineTax: Number(it.lineTax || 0),
        lineSubtotal: Number(it.lineSubtotal || 0),
      })));
      setReturnReason('');
      setReturnNotes('');
      setReturnModal(full);
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to load invoice details');
    }
  };

  const submitInvoiceReturn = async (e) => {
    e.preventDefault();
    if (!returnModal) return;
    if (returnRows.some((r) => Number(r.quantity || 0) < 0 || Number(r.quantity || 0) > Number(r.soldQty || 0))) {
      return toast.error('Return quantity cannot be negative or more than sold quantity');
    }
    const items = returnRows
      .filter((r) => Number(r.quantity || 0) > 0)
      .map((r) => ({ invoiceItemId: r.invoiceItemId, quantity: Number(r.quantity) }));
    if (!items.length) return toast.error('Enter return quantity for at least one item');
    const fingerprint = JSON.stringify({
      invoiceId: returnModal.id,
      items: [...items].sort((a, b) => String(a.invoiceItemId).localeCompare(String(b.invoiceItemId))),
      reason: String(returnReason || '').trim().toLowerCase(),
      notes: String(returnNotes || '').trim().toLowerCase(),
    });
    const clientTxnId = `invoice-return-${toRequestHash(fingerprint)}`;

    setReturnSaving(true);
    try {
      const res = await medicineInvoiceAPI.createReturn(returnModal.id, {
        items,
        reason: returnReason || null,
        notes: returnNotes || null,
        clientTxnId,
      });
      const created = res.data;
      if (created.id) {
        try {
          const pdfRes = await pdfAPI.medicineReturn(created.id);
          const url = window.URL.createObjectURL(new Blob([pdfRes.data], { type: 'application/pdf' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = `medicine-return-${created.returnNumber || created.id}.pdf`;
          link.click();
          window.URL.revokeObjectURL(url);
        } catch {
          toast.info('Return created. PDF download failed; you can generate it again from API.');
        }
      }
      toast.success('Invoice return created');
      setReturnModal(null);
      await Promise.all([loadInvoices(), loadAnalytics(), loadMaster()]);
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to create invoice return');
    } finally {
      setReturnSaving(false);
    }
  };
  const gstMedicines = gstReport?.medicines || [];
  const gstPurchases = gstReport?.purchases || { totalPurchases: 0, totalTaxableAmount: 0, totalGSTAmount: 0, byRate: [], medicines: [] };
  const returnPreview = useMemo(() => {
    const totals = returnRows.reduce((acc, r) => {
      const soldQty = Number(r.soldQty || 0);
      const retQty = Number(r.quantity || 0);
      if (soldQty <= 0 || retQty <= 0) return acc;
      const ratio = retQty / soldQty;
      acc.taxable += Number(r.lineSubtotal || 0) * ratio;
      acc.tax += Number(r.lineTax || 0) * ratio;
      acc.total += Number(r.lineTotal || 0) * ratio;
      return acc;
    }, { taxable: 0, tax: 0, total: 0 });
    return totals;
  }, [returnRows]);

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Medicine Invoices</h2>
          <p className={styles.pageSubtitle}>Create pharmacy invoices, track payment, and monitor revenue & GST analytics</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          ['create', 'Create Invoice'],
          ['list', 'Invoice Records'],
          ['analytics', 'Analytics'],
          ['gst-report', 'GST Report'],
        ].map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? styles.btnPrimary : styles.btnSecondary}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.card} style={{ padding: 16, marginBottom: 16 }}>
        <div className={styles.filterBar}>
          <input type="date" className={styles.filterSelect} value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className={styles.filterSelect} value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} />
          <button className={styles.btnSecondary} onClick={() => Promise.all([loadInvoices(), loadAnalytics()])}>Apply Range</button>
          <button className={styles.btnSecondary} onClick={() => { setFrom(''); setTo(''); setTimeout(() => Promise.all([loadInvoices(), loadAnalytics()]), 0); }}>Reset</button>
        </div>
      </div>

      {tab === 'create' && (
        <div className={styles.card} style={{ padding: 16 }}>
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Draft autosave: {draftMeta.lastSavedAt ? new Date(draftMeta.lastSavedAt).toLocaleString() : 'Not saved yet'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => applyQuickPreset({ label: 'Walk-in Cash Paid', paymentMode: 'cash', isPaid: true, note: 'Walk-in retail invoice' })}
              >
                Walk-in Cash
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => applyQuickPreset({ label: 'Walk-in UPI Paid', paymentMode: 'upi', isPaid: true, note: 'Walk-in UPI invoice' })}
              >
                Walk-in UPI
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => applyQuickPreset({ label: 'Walk-in Credit', paymentMode: 'other', isPaid: false, note: 'Walk-in credit invoice' })}
              >
                Walk-in Credit
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  setForm(getEmptyInvoiceForm());
                  try { localStorage.removeItem(INVOICE_DRAFT_KEY); } catch { /* no-op */ }
                  setDraftMeta({ loaded: false, hasDraft: false, lastSavedAt: null });
                  toast.success('Draft cleared');
                }}
              >
                Clear Draft
              </button>
              {draftMeta.loaded && draftMeta.hasDraft && (
                <span style={{ fontSize: 12, color: '#0f766e', fontWeight: 600, alignSelf: 'center' }}>
                  Draft restored
                </span>
              )}
            </div>
          </div>
          <div className={styles.card} style={{ padding: 10, marginBottom: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>Named Drafts</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <input
                className={styles.input}
                placeholder="Draft name (e.g. Evening Queue Bill 1)"
                value={namedDraftName}
                onChange={(e) => setNamedDraftName(e.target.value)}
                style={{ minWidth: 260 }}
              />
              <button type="button" className={styles.btnSecondary} onClick={saveCurrentAsNamedDraft}>
                Save Current as Draft
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {namedDrafts.length === 0 ? (
                <span style={{ fontSize: 12, color: '#94a3b8' }}>No named drafts saved.</span>
              ) : namedDrafts.map((draft) => (
                <div key={draft.id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 999, padding: '4px 8px', background: '#f8fafc' }}>
                  <button type="button" className={styles.btnSecondary} onClick={() => loadNamedDraft(draft)}>
                    {draft.name}
                  </button>
                  <button type="button" className={styles.btnDelete} onClick={() => deleteNamedDraft(draft.id)}>
                    X
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {QUICK_BASKET_TEMPLATES.map((tpl) => (
              <button
                key={tpl.key}
                type="button"
                className={styles.btnSecondary}
                onClick={() => applyQuickBasketTemplate(tpl)}
              >
                {tpl.label}
              </button>
            ))}
          </div>
          <div className={styles.card} style={{ padding: 10, marginBottom: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>My Basket Templates</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <input
                className={styles.input}
                placeholder="Template name (e.g. BP Follow-up)"
                value={customTemplateName}
                onChange={(e) => setCustomTemplateName(e.target.value)}
                style={{ minWidth: 260 }}
              />
              <button type="button" className={styles.btnSecondary} onClick={saveCurrentBasketAsTemplate}>
                Save Current Basket
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {customTemplates.length === 0 ? (
                <span style={{ fontSize: 12, color: '#94a3b8' }}>No saved templates yet.</span>
              ) : customTemplates.map((tpl) => (
                <div key={tpl.key} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 999, padding: '4px 8px', background: '#f8fafc' }}>
                  <button type="button" className={styles.btnSecondary} onClick={() => applyCustomTemplate(tpl)}>
                    {tpl.label}
                  </button>
                  <button type="button" className={styles.btnDelete} onClick={() => deleteCustomTemplate(tpl.key)}>
                    X
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.card} style={{ padding: 10, marginBottom: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>Bulk Paste Medicines</div>
            <textarea
              className={styles.input}
              rows={4}
              placeholder={'Example:\nParacetamol, 10\nCetirizine x 5\nORS 2'}
              value={bulkPasteText}
              onChange={(e) => setBulkPasteText(e.target.value)}
            />
            <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
              Accepted formats per line: `Medicine,Qty` or `Medicine x Qty` or `Medicine Qty`
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <button type="button" className={styles.btnSecondary} onClick={() => importBulkMedicines('replace')}>
                Import & Replace
              </button>
              <button type="button" className={styles.btnSecondary} onClick={() => importBulkMedicines('append')}>
                Import & Append
              </button>
              <button type="button" className={styles.btnSecondary} onClick={() => setBulkPasteText('')}>
                Clear
              </button>
            </div>
          </div>
          <form onSubmit={handleCreate} className={styles.form}>
            <div className={styles.grid3}>
              <div className={styles.field}>
                <label className={styles.label}>Invoice Date</label>
                <input className={styles.input} type="date" value={form.invoiceDate} onChange={(e) => setForm((p) => ({ ...p, invoiceDate: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Patient (Optional)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className={styles.input}
                    list="patient-options"
                    placeholder="Search by name / patient ID / mobile"
                    value={getPatientSearchText()}
                    onChange={(e) => handlePatientSearch(e.target.value)}
                  />
                  <button type="button" className={styles.btnSecondary} onClick={() => setPatientModalOpen(true)}>
                    + Add
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={loadPatientLastInvoice}
                    disabled={!form.patientId || loadingPatientLastInvoice}
                  >
                    {loadingPatientLastInvoice ? 'Loading...' : 'Load Last Invoice'}
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={loadPatientLastBasket}
                    disabled={!form.patientId || loadingPatientLastInvoice}
                  >
                    {loadingPatientLastInvoice ? 'Loading...' : 'Repeat Last Basket'}
                  </button>
                </div>
                <datalist id="patient-options">
                  <option value="">Walk-in customer</option>
                  {patients.map((p) => (
                    <option key={p.id} value={patientOptionLabel(p)} />
                  ))}
                </datalist>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Payment Mode</label>
                <select className={styles.input} value={form.paymentMode} onChange={(e) => setForm((p) => ({ ...p, paymentMode: e.target.value }))}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="net_banking">Net Banking</option>
                  <option value="insurance">Insurance</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#334155' }}>
                <input type="checkbox" checked={form.isPaid} onChange={(e) => setForm((p) => ({ ...p, isPaid: e.target.checked }))} />
                Mark as paid
              </label>
            </div>

            <div className={styles.card} style={{ padding: 12, marginBottom: 16, border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Medicine Items</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Medicine</div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Qty</div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Unit Price</div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Discount %</div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>GST %</div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Actions</div>
              </div>
              {form.items.map((item, index) => {
                const selMed = medications.find((m) => m.id === item.medicationId);
                return (
                  <div key={index} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 8 }}>
                      <>
                        <input
                          className={styles.input}
                          list={`medicine-options-${index}`}
                          placeholder="Search medicine..."
                          value={getMedicationSearchText(item)}
                          onChange={(e) => handleMedicationSearch(index, e.target.value)}
                        />
                        <datalist id={`medicine-options-${index}`}>
                          {medications.flatMap((m) => medicationSearchLabels(m).map((label) => (
                            <option key={`${m.id}-${label}`} value={label} />
                          )))}
                        </datalist>
                      </>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input className={styles.input} type="number" min="1" step="1" value={item.quantity} onChange={(e) => setItem(index, 'quantity', e.target.value)} placeholder="Qty" />
                        <button type="button" className={styles.btnSecondary} onClick={() => adjustItemQuantity(index, -1)}>-1</button>
                        <button type="button" className={styles.btnSecondary} onClick={() => adjustItemQuantity(index, 1)}>+1</button>
                        <button type="button" className={styles.btnSecondary} onClick={() => adjustItemQuantity(index, 5)}>+5</button>
                      </div>
                      <input className={styles.input} type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => setItem(index, 'unitPrice', e.target.value)} placeholder="Unit" />
                      <input className={styles.input} type="number" min="0" step="0.01" value={item.discountPct} onChange={(e) => setItem(index, 'discountPct', e.target.value)} placeholder="Disc %" />
                      <input className={styles.input} type="number" min="0" step="0.01" value={item.taxPct} onChange={(e) => setItem(index, 'taxPct', e.target.value)} placeholder="GST %" />
                       <div style={{ display: 'flex', gap: 6 }}>
                         <button type="button" className={styles.btnSecondary} onClick={() => openQuickMedicineModal(index)}>+ New</button>
                         <button type="button" className={styles.btnSecondary} onClick={() => duplicateItem(index)}>Copy</button>
                         <button type="button" className={styles.btnDelete} onClick={() => removeItem(index)} disabled={form.items.length === 1}>Remove</button>
                       </div>
                     </div>
                    {selMed && (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, paddingLeft: 4 }}>
                        GST: <strong>{Number(selMed.gstRate || 0)}%</strong>
                        {selMed.stockQuantity < 10 && (
                          <span style={{ marginLeft: 8, color: '#dc2626', fontWeight: 600 }}>
                            Low stock: {selMed.stockQuantity} remaining
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className={styles.btnSecondary} onClick={addItem}>+ Add Item</button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => openQuickMedicineModal(form.items.length - 1)}
                >
                  + Add New Medicine
                </button>
              </div>
            </div>

            <div className={styles.card} style={{ padding: 12, marginBottom: 16, border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                Invoice Summary
                <span style={{ position: 'relative', display: 'inline-flex' }}>
                  <button
                    type="button"
                    onClick={() => setGstInfoOpen(o => !o)}
                    style={{ cursor: 'pointer', fontSize: 12, color: gstInfoOpen ? '#fff' : '#2563eb', background: gstInfoOpen ? '#2563eb' : '#eff6ff', border: '1.5px solid #2563eb', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, lineHeight: 1, padding: 0 }}
                    title="How GST is calculated"
                  >?</button>
                  {gstInfoOpen && (
                    <div style={{
                      position: 'absolute', left: 26, top: -8, zIndex: 999,
                      background: '#1e293b', color: '#f8fafc', borderRadius: 12, padding: '14px 18px',
                      width: 360, fontSize: 13, lineHeight: 1.75, boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
                      whiteSpace: 'normal',
                    }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#fbbf24' }}>GST Invoice Guide</span>
                        <button type="button" onClick={() => setGstInfoOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>✕</button>
                      </div>

                      {/* Formula */}
                      <div style={{ fontWeight: 600, color: '#93c5fd', marginBottom: 4 }}>GST Calculation Formula</div>
                      <div style={{ background: '#0f172a', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, fontFamily: 'monospace', lineHeight: 2 }}>
                        Subtotal &nbsp;&nbsp;= Qty × Unit Price<br />
                        Discount &nbsp;&nbsp;= Subtotal × Discount %<br />
                        Taxable &nbsp;&nbsp;&nbsp;= Subtotal − Discount<br />
                        GST &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= Taxable × GST Rate %<br />
                        Line Total = Taxable + GST
                      </div>

                      {/* Steps */}
                      <div style={{ fontWeight: 600, color: '#86efac', marginBottom: 4 }}>Steps to Create an Invoice</div>
                      <ol style={{ margin: '0 0 10px 0', paddingLeft: 18, fontSize: 12.5, lineHeight: 1.9 }}>
                        <li>Select the patient (or leave as Walk-in)</li>
                        <li>Add medicines — GST rate auto-fills from medicine master</li>
                        <li>Enter quantity; unit price and GST pre-populate</li>
                        <li>Apply per-line discount % if applicable</li>
                        <li>Verify GST rate on each line is correct</li>
                        <li>Check Invoice Summary — Subtotal, Discount, GST, Total</li>
                        <li>Choose payment mode (Cash / Card / UPI / Credit)</li>
                        <li>Click <em>Create Invoice + PDF</em></li>
                      </ol>

                      {/* Precautions */}
                      <div style={{ fontWeight: 600, color: '#fca5a5', marginBottom: 4 }}>Precautions</div>
                      <ul style={{ margin: '0 0 10px 0', paddingLeft: 18, fontSize: 12.5, lineHeight: 1.9 }}>
                        <li>Set the correct GST rate on each medicine in the <em>Medications</em> master — it drives all invoice calculations</li>
                        <li>GST is applied on taxable amount <strong>(after discount)</strong>, not on gross subtotal</li>
                        <li>Do not backdate invoices — GST reports are date-range filtered for compliance</li>
                        <li>For returns: GST is refunded proportionally based on the original invoice's tax rate</li>
                        <li>Zero-rated medicines must be set to <strong>0% (Exempt)</strong> in Medications — do not leave GST field blank</li>
                        <li>Verify invoice date before saving — it cannot be changed after creation</li>
                      </ul>

                      <div style={{ borderTop: '1px solid #334155', paddingTop: 8, color: '#94a3b8', fontSize: 11.5 }}>
                        GST rates available: 0% (Exempt) · 5% · 12% · 18% · 28%
                      </div>
                    </div>
                  )}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, fontSize: 14 }}>
                <div>Subtotal: <strong>{currency(computed.subtotal)}</strong></div>
                <div>Discount: <strong>{currency(computed.discountAmount)}</strong></div>
                <div>GST (Tax): <strong>{currency(computed.taxAmount)}</strong></div>
                <div>Total: <strong>{currency(computed.totalAmount)}</strong></div>
              </div>
            </div>

            <div className={styles.field} style={{ marginBottom: 12 }}>
              <label className={styles.label}>Notes</label>
              <textarea className={styles.input} rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>

            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? 'Saving...' : 'Create Invoice + PDF'}</button>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={saving}
                onClick={(e) => handleCreate(e, { createNext: true })}
              >
                {saving ? 'Saving...' : 'Create & Next Invoice'}
              </button>
              <span style={{ fontSize: 12, color: '#64748b', alignSelf: 'center' }}>
                Shortcuts: Ctrl+Enter = Create & Next, Ctrl+Shift+Enter = Create + PDF
              </span>
            </div>
          </form>
        </div>
      )}

      {tab === 'list' && (
        <div className={styles.card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className={styles.filterSelect}
                placeholder="Filter by invoice #, patient, mobile, patient ID"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                style={{ minWidth: 320 }}
              />
              <button className={styles.btnSecondary} onClick={() => setInvoiceSearch('')}>Clear</button>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Showing {invoices.length} of {invoicePagination?.total ?? invoices.length}
              </span>
            </div>
          </div>
          <Table columns={invoiceColumns} data={invoices} loading={loading} emptyMessage="No invoices found" />
          <PaginationControls
            meta={invoicePagination}
            onPageChange={(next) => {
              setInvoicePage(next);
              loadInvoices({ page: next });
            }}
            onPerPageChange={(value) => {
              setInvoicePerPage(value);
              setInvoicePage(1);
              loadInvoices({ page: 1, perPage: value });
            }}
          />
        </div>
      )}

      {tab === 'analytics' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {[
              { label: 'Total Invoices', value: summary.totalInvoices, icon: 'INV' },
              { label: 'Total Amount', value: currency(summary.totalAmount), icon: 'Rs' },
              { label: 'Collected', value: currency(summary.paidAmount), icon: 'Paid' },
              { label: 'Pending', value: currency(summary.pendingAmount), icon: 'Due' },
              { label: 'Collection Rate', value: `${Number(summary.collectionRate || 0).toFixed(2)}%`, icon: '%' },
            ].map((s) => (
              <div key={s.label} className={styles.card} style={{ padding: 12 }}>
                <div style={{ fontSize: 18 }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className={styles.card} style={{ padding: 12 }}>
            <h3 style={{ margin: 0, marginBottom: 8, color: '#334155' }}>Day-wise Invoice Revenue</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dayWise}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => currency(value)} />
                <Legend />
                <Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={2} name="Amount" />
                <Line type="monotone" dataKey="paidAmount" stroke="#16a34a" strokeWidth={2} name="Paid" />
                <Line type="monotone" dataKey="pendingAmount" stroke="#d97706" strokeWidth={2} name="Pending" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className={styles.card} style={{ padding: 12 }}>
              <h3 style={{ margin: 0, marginBottom: 8, color: '#334155' }}>Revenue by Medicine Category</h3>
              {categoryWise.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: 13 }}>No category data available.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={categoryWise.map((c) => ({ name: c.category, value: c.amount }))}
                      cx="50%" cy="50%" outerRadius={90} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false} style={{ fontSize: 10 }}
                    >
                      {categoryWise.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => currency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className={styles.card} style={{ padding: 12 }}>
              <h3 style={{ margin: 0, marginBottom: 8, color: '#334155' }}>Top Medicines by Revenue</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topMedicines}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => currency(value)} />
                  <Legend />
                  <Bar dataKey="amount" fill="#0891b2" name="Revenue" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'gst-report' && (
        <div style={{ display: 'grid', gap: 16 }}>

          {/* GST Report Help Panel */}
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setGstReportHelpOpen(o => !o)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, color: '#0369a1', fontWeight: 700 }}>? How to Use GST Report</span>
                <span style={{ fontSize: 12, color: '#0284c7', background: '#e0f2fe', borderRadius: 999, padding: '2px 10px', fontWeight: 500 }}>Click to {gstReportHelpOpen ? 'collapse' : 'expand'}</span>
              </span>
              <span style={{ fontSize: 18, color: '#0369a1', lineHeight: 1 }}>{gstReportHelpOpen ? '▲' : '▼'}</span>
            </button>

            {gstReportHelpOpen && (
              <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, borderTop: '1px solid #bae6fd' }}>

                {/* What this report shows */}
                <div style={{ paddingTop: 16 }}>
                  <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>📊</span> What This Report Shows
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.9, color: '#1e3a5f' }}>
                    <li>Total GST collected from patients (Output Tax) for the selected date range</li>
                    <li>GST paid on purchases / stock replenishment (Input Tax / ITC)</li>
                    <li>Net GST payable to the government = Output GST − Input GST</li>
                    <li>Breakdown by slab: 0%, 5%, 12%, 18%, 28%</li>
                    <li>Medicine-wise GST contribution</li>
                    <li>Reconciliation checks to validate data integrity before filing</li>
                  </ul>
                </div>

                {/* How calculations happen */}
                <div style={{ paddingTop: 16 }}>
                  <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>🧮</span> How the Calculations Work
                  </div>
                  <div style={{ background: '#e0f2fe', borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, lineHeight: 2.1, color: '#0c4a6e', marginBottom: 8 }}>
                    Taxable = (Qty × Price) − Discount<br />
                    Output GST = Taxable × GST Rate %<br />
                    Line Total = Taxable + Output GST<br />
                    ─────────────────────<br />
                    Net Payable = Output − Input (ITC)
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.7 }}>
                    GST is calculated <strong>after</strong> discount — not on the gross price. Each medicine's GST rate is stored in the Medications master and auto-fills when building an invoice.
                  </div>
                </div>

                {/* Steps + Precautions */}
                <div style={{ paddingTop: 16 }}>
                  <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>✅</span> Steps to Use
                  </div>
                  <ol style={{ margin: '0 0 12px 0', paddingLeft: 16, fontSize: 13, lineHeight: 1.9, color: '#1e3a5f' }}>
                    <li>Select <strong>From</strong> and <strong>To</strong> dates (a month or quarter)</li>
                    <li>Optionally filter by a specific GST rate slab</li>
                    <li>Click <strong>Generate Report</strong></li>
                    <li>Review summary cards — Output GST, Input GST, Net Payable</li>
                    <li>Check <strong>Reconciliation</strong> section for any mismatches</li>
                    <li>Resolve mismatches before exporting (invoices must balance)</li>
                    <li>Download <strong>GSTR-1</strong> (sales) and <strong>GSTR-3B</strong> (summary) JSON for filing</li>
                    <li>Use <strong>Marg GST CSV</strong> if filing via Marg ERP</li>
                  </ol>
                  <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#78350f', lineHeight: 1.75 }}>
                    <strong>⚠ Precautions</strong><br />
                    • Always set the correct GST rate on each medicine <em>before</em> creating invoices — it cannot be changed retroactively on saved invoices.<br />
                    • Do not backdate invoices — GST reports are period-locked for compliance.<br />
                    • GSTR-1 / GSTR-3B exports are locked when reconciliation has mismatches. Resolve them first, or check the unlock box only if you are certain the data is correct.<br />
                    • Input GST (ITC) is only counted from purchase entries that have a valid GST rate and supplier details.
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* GST filter bar */}
          <div className={styles.card} style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>GST Rate:</label>
              <select className={styles.filterSelect} value={gstRateFilter} onChange={(e) => setGstRateFilter(e.target.value)}>
                <option value="">All Rates</option>
                <option value="0">0% (Exempt)</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
              <button className={styles.btnPrimary} onClick={loadGSTReport}>Generate Report</button>
              <button className={styles.btnSecondary} onClick={handleDownloadGSTCsv} disabled={!gstReport}>Download CSV</button>
              <button className={styles.btnSecondary} onClick={handleDownloadReconciliationCsv} disabled={!gstReport}>Reconciliation CSV</button>
              <button className={styles.btnSecondary} onClick={handleDownloadReconciliationJson} disabled={!gstReport}>Reconciliation JSON</button>
              <button className={styles.btnSecondary} onClick={() => handleDownloadGSTRJson('gstr1')} disabled={!gstReport || (!filingReady && !allowRiskyExport)}>GSTR-1 JSON</button>
              <button className={styles.btnSecondary} onClick={() => handleDownloadGSTRJson('gstr3b')} disabled={!gstReport || (!filingReady && !allowRiskyExport)}>GSTR-3B JSON</button>
              <button className={styles.btnSecondary} onClick={handleDownloadMargCsv} disabled={!gstReport || (!filingReady && !allowRiskyExport)}>Marg GST CSV</button>
            </div>
            {!filingReady && gstReport && (
              <div style={{ marginTop: 10, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 12, color: '#9a3412', marginBottom: 8 }}>
                  Filing export is locked because reconciliation checks have mismatches.
                </div>
                <label style={{ fontSize: 12, color: '#7c2d12', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={allowRiskyExport} onChange={(e) => setAllowRiskyExport(e.target.checked)} />
                  Unlock and allow export despite mismatches (not recommended)
                </label>
              </div>
            )}
          </div>

          {gstLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading GST report...</div>
          ) : !gstReport ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Apply date range and click Generate Report</div>
          ) : (
            <>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                {[
                  { label: 'Filing Readiness', value:filingReady ? 'READY' : 'BLOCKED', icon:filingReady ? 'OK' : 'LOCK'},
                  { label: 'Mismatch Count', value: mismatchCount, icon: 'CHK' },
                  { label: 'Total Invoices', value: gstSummary.totalInvoices, icon: 'INV' },
                  { label: 'Total Taxable Sales', value: currency(gstSummary.totalTaxableAmount), icon: 'Rs' },
                  { label: 'Output GST', value: currency(gstSummary.outputGSTAmount || gstSummary.totalGSTAmount), icon: 'OUT' },
                  { label: 'Input GST', value: currency(gstSummary.inputGSTAmount || 0), icon: 'IN' },
                  { label: 'Net Tax Payable', value: currency(gstSummary.netTaxPayable || 0), icon: 'NET' },
                  { label: 'Input Coverage', value: `${inputCoveragePct.toFixed(1)}%`, icon: 'COV' },
                  { label: 'GST Rates Applied', value: gstSummary.byRate.length || 0, icon: 'RATES' },
                ].map((s) => (
                  <div key={s.label} className={styles.card} style={{ padding: 12 }}>
                    <div style={{ fontSize: 18 }}>{s.icon}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color:s.label === 'Filing Readiness' ? (filingReady ? '#15803d' : '#b91c1c') : '#1e293b' }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div className={styles.card} style={{ padding: 12, background: '#f8fafc' }}>
                <div style={{ fontSize: 14, color: '#334155', fontWeight: 700, marginBottom: 6 }}>GST Liability Snapshot</div>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  Output GST {currency(gstSummary.outputGSTAmount || gstSummary.totalGSTAmount)} - Input GST {currency(gstSummary.inputGSTAmount || 0)} = Net {currency(gstSummary.netTaxPayable || 0)}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                  Purchases included for input GST: {gstPurchases.totalPurchases || 0}
                </div>
              </div>

              {gstReconciliation && (
                <div className={styles.card} style={{ padding: 12 }}>
                  <h3 style={{ margin: 0, marginBottom: 10, color: '#334155', fontSize: 14 }}>Reconciliation Checks</h3>
                  {gstWarnings.length > 0 ? (
                    <div style={{ marginBottom: 10, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: 10, fontSize: 12, color: '#9a3412' }}>
                      {gstWarnings.map((w, i) => <div key={i}>- {w}</div>)}
                    </div>
                  ) : (
                    <div style={{ marginBottom: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 10, fontSize: 12, color: '#166534' }}>
                      All GST reconciliation checks passed.
                    </div>
                  )}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Check', 'Taxable Diff', 'GST Diff', 'Status'].map((h) => (
                          <th key={h} style={{ padding: '8px 10px', textAlign:h === 'Check' ? 'left' : 'right', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Sales Items vs Invoice Headers', gstReconciliation.salesItemsVsInvoiceHeaders],
                        ['Sales Returns Items vs Return Headers', gstReconciliation.salesReturnsItemsVsReturnHeaders],
                        ['Output By-Rate vs Output Total', gstReconciliation.outputByRateVsOutputTotals],
                        ['Input By-Rate vs Input Total', gstReconciliation.inputByRateVsInputTotals],
                      ].map(([label, rec]) => (
                        <tr key={label} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', textAlign: 'left' }}>{label}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: Math.abs(Number(rec.diffTaxable || 0)) > 0.5 ? '#b91c1c' : '#475569'}}>{currency(rec.diffTaxable || 0)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: Math.abs(Number(rec.diffGST || 0)) > 0.5 ? '#b91c1c' : '#475569'}}>{currency(rec.diffGST || 0)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color:rec.isMatched ? '#15803d' : '#b91c1c'}}>
                            {rec.isMatched ? 'PASS' : 'MISMATCH'}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', textAlign: 'left' }}>Net Formula Check</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>-</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: Math.abs(Number(gstReconciliation.netFormulaCheck.diff || 0)) > 0.5 ? '#b91c1c' : '#475569'}}>
                          {currency(gstReconciliation.netFormulaCheck.diff || 0)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color:gstReconciliation.netFormulaCheck.isMatched ? '#15803d' : '#b91c1c'}}>
                          {gstReconciliation.netFormulaCheck.isMatched ? 'PASS' : 'MISMATCH'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* GST by Rate table + chart */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className={styles.card} style={{ padding: 12 }}>
                  <h3 style={{ margin: 0, marginBottom: 12, color: '#334155', fontSize: 14 }}>GST by Rate</h3>
                  {gstSummary.byRate.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: 13 }}>No data for selected filters</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Rate', 'Invoices', 'Taxable Amt', 'GST Collected', '% of Total'].map((h) => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {gstSummary.byRate.map((row) => (
                          <tr key={row.gstRate} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              <GSTRateBadge rate={row.gstRate} />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{row.invoiceCount}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{currency(row.taxableAmount)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{currency(row.gstAmount)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>
                              {gstSummary.totalGSTAmount > 0
                                ? `${((row.gstAmount / gstSummary.totalGSTAmount) * 100).toFixed(1)}%`
                                : '-'}
                            </td>
                          </tr>
                        ))}
                        <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>Total</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>{gstSummary.totalInvoices}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>{currency(gstSummary.totalTaxableAmount)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>{currency(gstSummary.totalGSTAmount)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>100%</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>

                <div className={styles.card} style={{ padding: 12 }}>
                  <h3 style={{ margin: 0, marginBottom: 8, color: '#334155', fontSize: 14 }}>GST Collected by Rate</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={gstSummary.byRate.map((r) => ({ name:r.gstRate === 0 ? 'Exempt' : `${r.gstRate}%`, gstAmount: r.gstAmount, taxableAmount: r.taxableAmount }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => currency(value)} />
                      <Legend />
                      <Bar dataKey="taxableAmount" fill="#93c5fd" name="Taxable Amount" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="gstAmount" fill="#2563eb" name="GST Collected" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Medicine-wise GST table */}
              <div className={styles.card} style={{ padding: 12 }}>
                <h3 style={{ margin: 0, marginBottom: 12, color: '#334155', fontSize: 14 }}>Medicine-wise GST Breakdown (Top 50)</h3>
                {gstMedicines.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: 13 }}>No medicine data for selected filters</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Medicine', 'GST Rate', 'Qty Sold', 'Taxable Amount', 'GST Amount'].map((h) => (
                            <th key={h} style={{ padding: '8px 10px', textAlign:h === 'Medicine' || h === 'GST Rate' ? 'left' : 'right', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {gstMedicines.map((med, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 500 }}>{med.name}</td>
                            <td style={{ padding: '8px 10px' }}><GSTRateBadge rate={med.gstRate} /></td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{med.qtySold}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{currency(med.taxableAmount)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#1d4ed8' }}>{currency(med.gstAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                  * GST figures are based on the tax % applied at the time of invoice creation. For filing GST returns, please consult your accountant/CA.
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <Modal
        isOpen={patientModalOpen}
        onClose={() => {
          setPatientModalOpen(false);
          resetQuickPatient();
        }}
        title="Quick Add Patient"
      >
        <form onSubmit={handleQuickPatientCreate} className={styles.form}>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Name *</label>
              <input
                className={styles.input}
                value={quickPatient.name}
                onChange={(e) => setQuickPatient((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Mobile *</label>
              <input
                className={styles.input}
                value={quickPatient.phone}
                onChange={(e) => setQuickPatient((p) => ({ ...p, phone: e.target.value }))}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Gender</label>
              <select
                className={styles.input}
                value={quickPatient.gender}
                onChange={(e) => setQuickPatient((p) => ({ ...p, gender: e.target.value }))}
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Date of Birth</label>
              <input
                className={styles.input}
                type="date"
                value={quickPatient.dateOfBirth}
                onChange={(e) => setQuickPatient((p) => ({ ...p, dateOfBirth: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Blood Group</label>
              <select
                className={styles.input}
                value={quickPatient.bloodGroup}
                onChange={(e) => setQuickPatient((p) => ({ ...p, bloodGroup: e.target.value }))}
              >
                <option value="">Select</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                setPatientModalOpen(false);
                resetQuickPatient();
              }}
            >
              Cancel
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={patientSaving}>
              {patientSaving ? 'Saving...' : 'Save & Select Patient'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={medicineModalOpen}
        onClose={() => {
          setMedicineModalOpen(false);
          resetQuickMedicine();
        }}
        title="Quick Add Medicine"
      >
        <form onSubmit={handleQuickMedicineCreate} className={styles.form}>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Medicine Name *</label>
              <input
                className={styles.input}
                value={quickMedicine.name}
                onChange={(e) => setQuickMedicine((m) => ({ ...m, name: e.target.value }))}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Generic Name</label>
              <input
                className={styles.input}
                value={quickMedicine.genericName}
                onChange={(e) => setQuickMedicine((m) => ({ ...m, genericName: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Category</label>
              <select
                className={styles.input}
                value={quickMedicine.category}
                onChange={(e) => setQuickMedicine((m) => ({ ...m, category: e.target.value }))}
              >
                {['tablet', 'capsule', 'syrup', 'injection', 'ointment', 'drops', 'inhaler', 'powder', 'spray', 'vaccine', 'other'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Dosage</label>
              <input
                className={styles.input}
                value={quickMedicine.dosage}
                onChange={(e) => setQuickMedicine((m) => ({ ...m, dosage: e.target.value }))}
                placeholder="e.g. 500mg"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Selling Price</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={quickMedicine.unitPrice}
                onChange={(e) => setQuickMedicine((m) => ({ ...m, unitPrice: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Purchase Price</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={quickMedicine.purchasePrice}
                onChange={(e) => setQuickMedicine((m) => ({ ...m, purchasePrice: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>GST %</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={quickMedicine.gstRate}
                onChange={(e) => setQuickMedicine((m) => ({ ...m, gstRate: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>HSN Code</label>
              <input
                className={styles.input}
                value={quickMedicine.hsnCode}
                onChange={(e) => setQuickMedicine((m) => ({ ...m, hsnCode: e.target.value }))}
              />
            </div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={Boolean(quickMedicine.requiresPrescription)}
                  onChange={(e) => setQuickMedicine((m) => ({ ...m, requiresPrescription: e.target.checked }))}
                />
                Requires prescription
              </label>
            </div>
          </div>
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                setMedicineModalOpen(false);
                resetQuickMedicine();
              }}
            >
              Cancel
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={medicineSaving}>
              {medicineSaving ? 'Saving...' : 'Save & Select Medicine'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!returnModal}
        onClose={() => setReturnModal(null)}
        title={`Invoice Return${returnModal?.invoiceNumber ? ` - ${returnModal.invoiceNumber}` : ''}`}
        size="lg"
      >
        <form onSubmit={submitInvoiceReturn} className={styles.form}>
          <div className={styles.card} style={{ padding: 12, marginBottom: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 600 }}>Return Items</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setReturnRows((prev) => prev.map((r) => ({ ...r, quantity: r.soldQty })))}
                >
                  Full Return
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setReturnRows((prev) => prev.map((r) => ({ ...r, quantity: 0 })))}
                >
                  Clear Qty
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 6, fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              <div>Medicine</div>
              <div>Sold Qty</div>
              <div>Return Qty</div>
            </div>
            {returnRows.map((r, idx) => (
              <div key={r.invoiceItemId} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: '#1f2937' }}>{r.medicationName}</div>
                <div style={{ fontSize: 13, color: '#64748b' }}>{r.soldQty}</div>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  max={r.soldQty}
                  step="0.01"
                  value={r.quantity}
                  onChange={(e) => {
                    const v = Number(e.target.value || 0);
                    setReturnRows((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: Math.max(0, Math.min(v, x.soldQty)) } : x)));
                  }}
                />
              </div>
            ))}
            <div style={{ marginTop: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: '#334155', marginBottom: 6 }}>Refund Preview</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: 8 }}>
                <div>Taxable: <strong>{currency(returnPreview.taxable)}</strong></div>
                <div>GST: <strong>{currency(returnPreview.tax)}</strong></div>
                <div>Total: <strong>{currency(returnPreview.total)}</strong></div>
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Reason</label>
            <input className={styles.input} value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="e.g. patient returned unopened medicine" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {RETURN_REASON_TEMPLATES.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setReturnReason(tpl)}
                >
                  {tpl}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Notes</label>
            <textarea className={styles.input} rows={2} value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setReturnModal(null)}>Cancel</button>
            <button type="submit" className={styles.btnWarning} disabled={returnSaving}>
              {returnSaving ? 'Saving...' : 'Create Return'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
