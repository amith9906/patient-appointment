const PDFDocument = require('pdfkit');
const {
  Appointment,
  Doctor,
  Patient,
  Hospital,
  HospitalSettings,
  Prescription,
  Medication,
  LabTest,
  Lab,
  MedicineInvoice,
  MedicineInvoiceItem,
  MedicineInvoiceReturn,
  MedicineInvoiceReturnItem,
  StockPurchase,
  StockPurchaseReturn,
  Vendor,
  User,
} = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');
const { LANGUAGE_MAP } = require('../utils/translator');

// ─── Shared defaults ────────────────────────────────────────────────────────
const DEFAULTS = {
  receiptFooter: 'Thank you for choosing our hospital. Get well soon!',
  currency: '₹', showLogoOnReceipt: true, showGSTINOnReceipt: true, showDoctorOnReceipt: true,
};

async function ensureAppointmentPdfAccess(req, res, appointment) {
  if (req.user.role === 'patient') {
    if (!appointment.patient || appointment.patient.userId !== req.user.id) {
      res.status(403).json({ message: 'Access denied for this appointment document' });
      return false;
    }
    return true;
  }

  const scope = await ensureScopedHospital(req, res);
  if (!scope.allowed) return false;
  if (isSuperAdmin(req.user)) return true;

  const hospitalId = appointment.doctor?.hospitalId || appointment.patient?.hospitalId || null;
  if (!hospitalId || hospitalId !== scope.hospitalId) {
    res.status(403).json({ message: 'Access denied for this hospital document' });
    return false;
  }
  return true;
}

async function ensureLabReportAccess(req, res, labTest) {
  if (req.user.role === 'patient') {
    if (!labTest.patient || labTest.patient.userId !== req.user.id) {
      res.status(403).json({ message: 'Access denied for this lab report' });
      return false;
    }
    return true;
  }

  const scope = await ensureScopedHospital(req, res);
  if (!scope.allowed) return false;
  if (isSuperAdmin(req.user)) return true;

  const hospitalId = labTest.lab?.hospitalId || null;
  if (!hospitalId || hospitalId !== scope.hospitalId) {
    res.status(403).json({ message: 'Access denied for this hospital report' });
    return false;
  }
  return true;
}

async function ensureMedicineInvoiceAccess(req, res, invoice) {
  if (req.user.role === 'patient') {
    if (!invoice.patient || invoice.patient.userId !== req.user.id) {
      res.status(403).json({ message: 'Access denied for this medicine invoice' });
      return false;
    }
    return true;
  }

  const scope = await ensureScopedHospital(req, res);
  if (!scope.allowed) return false;
  if (isSuperAdmin(req.user)) return true;

  if (invoice.hospitalId !== scope.hospitalId) {
    res.status(403).json({ message: 'Access denied for this hospital invoice' });
    return false;
  }
  return true;
}

async function getSettings(hospitalId) {
  const [settings] = await HospitalSettings.findOrCreate({
    where: { hospitalId },
    defaults: { ...DEFAULTS, hospitalId },
  });
  return settings;
}

// ─── PDF builder helpers ─────────────────────────────────────────────────────
function initDoc(res, filename) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);
  return doc;
}

function drawHRule(doc, y) {
  doc.moveTo(50, y || doc.y).lineTo(545, y || doc.y).lineWidth(0.5).strokeColor('#999').stroke();
  doc.strokeColor('#000');
}

function drawHeader(doc, hospital, settings) {
  const name = hospital.name || 'Hospital';
  const addrParts = [hospital.address, hospital.city, hospital.state, hospital.zipCode].filter(Boolean);
  const addr = addrParts.join(', ');
  const phone = settings.phone || hospital.phone || '';
  const email = hospital.email || '';

  doc.fontSize(18).font('Helvetica-Bold').text(name, { align: 'center' });
  if (settings.tagline) doc.fontSize(10).font('Helvetica-Oblique').text(settings.tagline, { align: 'center' });
  if (addr) doc.fontSize(9).font('Helvetica').text(addr, { align: 'center' });

  const contactLine = [phone && `Ph: ${phone}`, email].filter(Boolean).join('  |  ');
  if (contactLine) doc.fontSize(9).text(contactLine, { align: 'center' });

  if (settings.showGSTINOnReceipt && settings.gstin) {
    const taxLine = [`GSTIN: ${settings.gstin}`, settings.pan && `PAN: ${settings.pan}`].filter(Boolean).join('  |  ');
    doc.fontSize(8).text(taxLine, { align: 'center' });
  }
  if (settings.regNumber) doc.fontSize(8).text(`Reg: ${settings.regNumber}`, { align: 'center' });
  if (settings.receiptHeader) doc.fontSize(9).font('Helvetica-Oblique').text(settings.receiptHeader, { align: 'center' });

  doc.moveDown(0.5);
  drawHRule(doc);
  doc.moveDown(0.5);
}

function drawFooter(doc, settings, showSignature, appointmentOrDoctor) {
  doc.moveDown(1.5);
  if (showSignature && settings.showDoctorOnReceipt) {
    const dName = appointmentOrDoctor?.doctor?.name || settings.doctorName;
    const dQual = appointmentOrDoctor?.doctor?.qualification || settings.doctorQualification;
    const dReg = settings.doctorRegNumber;
    if (dName) {
      const sigX = 370;
      doc.moveTo(sigX, doc.y).lineTo(545, doc.y).lineWidth(0.5).strokeColor('#555').stroke().strokeColor('#000');
      doc.fontSize(10).font('Helvetica-Bold').text(dName, sigX, doc.y + 2, { width: 175 });
      if (dQual) doc.fontSize(9).font('Helvetica').text(dQual, sigX, doc.y, { width: 175 });
      if (dReg) doc.fontSize(8).text(`Reg: ${dReg}`, sigX, doc.y, { width: 175 });
    }
  }
  doc.moveDown(1);
  drawHRule(doc);
  doc.moveDown(0.3);
  if (settings.receiptFooter) {
    // Explicitly anchor at left margin so { align: 'center' } centres across full page width
    doc.fontSize(8).font('Helvetica-Oblique')
       .text(settings.receiptFooter, 50, doc.y, { width: 495, align: 'center' });
  }
}

function patientAge(dateOfBirth) {
  if (!dateOfBirth) return '—';
  const age = Math.floor((Date.now() - new Date(dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25));
  return `${age} yrs`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMoney(val, currency) {
  const n = parseFloat(val) || 0;
  return `${currency}${n.toFixed(2)}`;
}

function normalizedTranslations(value) {
  if (!value) return {};
  const src = typeof value === 'string' ? (() => {
    try { return JSON.parse(value); } catch { return {}; }
  })() : value;
  if (!src || typeof src !== 'object' || Array.isArray(src)) return {};
  const out = {};
  Object.keys(src).forEach((k) => {
    const code = String(k || '').toLowerCase();
    const txt = String(src[k] || '').trim();
    if (txt) out[code] = txt;
  });
  return out;
}

// ─── 1. Prescription PDF ──────────────────────────────────────────────────────
exports.generatePrescription = async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.appointmentId, {
      include: [
        {
          model: Doctor, as: 'doctor',
          include: [{ model: Hospital, as: 'hospital' }],
        },
        { model: Patient, as: 'patient' },
        {
          model: Prescription, as: 'prescriptions',
          include: [{ model: Medication, as: 'medication' }],
        },
      ],
    });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
    if (!(await ensureAppointmentPdfAccess(req, res, appointment))) return;

    const hospital = appointment.doctor?.hospital;
    if (!hospital) return res.status(400).json({ message: 'Hospital not found for this appointment' });
    const settings = await getSettings(hospital.id);
    const patient = appointment.patient;
    const doctor = appointment.doctor;
    const currency = settings.currency || '₹';

    const doc = initDoc(res, `prescription-${appointment.appointmentNumber}.pdf`);
    drawHeader(doc, hospital, settings);

    // Title
    doc.fontSize(13).font('Helvetica-Bold').text('PRESCRIPTION', { align: 'center' });
    doc.moveDown(0.3);
    drawHRule(doc);
    doc.moveDown(0.5);

    // Patient + Appointment info row
    const info = [
      [`Date:`, fmtDate(appointment.appointmentDate)],
      [`Appointment #:`, appointment.appointmentNumber],
    ];
    const patInfo = [
      [`Patient:`, patient?.name || '—'],
      [`Age / Gender:`, `${patientAge(patient?.dateOfBirth)} / ${patient?.gender || '—'}`],
      [`Patient ID:`, patient?.patientId || '—'],
      [`Doctor:`, `Dr. ${doctor?.name || '—'}`],
      [`Specialization:`, doctor?.specialization || '—'],
    ];

    doc.font('Helvetica').fontSize(9);
    info.forEach(([label, val]) => {
      doc.font('Helvetica-Bold').text(`${label} `, { continued: true }).font('Helvetica').text(val);
    });
    doc.moveDown(0.3);
    patInfo.forEach(([label, val]) => {
      doc.font('Helvetica-Bold').text(`${label} `, { continued: true }).font('Helvetica').text(val);
    });

    doc.moveDown(0.5);
    drawHRule(doc);
    doc.moveDown(0.5);

    // Rx heading
    doc.fontSize(11).font('Helvetica-Bold').text('Rx  (Medications)');
    doc.moveDown(0.3);

    const prescriptions = appointment.prescriptions || [];
    if (prescriptions.length === 0) {
      doc.fontSize(9).font('Helvetica-Oblique').text('No medications prescribed.', 50, doc.y, { width: 495 });
    } else {
      prescriptions.forEach((p, idx) => {
        const med = p.medication;
        const L = 50;   // left margin
        const W = 495;  // full text width

        // ── Line 1: index + name + dosage + category (all as one text block)
        const namePart = med?.name || '—';
        const dosagePart = med?.dosage ? `  ${med.dosage}` : '';
        const catPart = med?.category ? `  (${med.category})` : '';
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000')
           .text(`${idx + 1}.  ${namePart}${dosagePart}${catPart}`, L, doc.y, { width: W });

        // ── Line 2: composition (blue italic)
        if (med?.composition) {
          doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#1d4ed8')
             .text(`       Composition: ${med.composition}`, L, doc.y, { width: W });
        }

        // ── Line 3: dose · frequency · timing · duration · qty
        const details = [
          p.dosage    && `Dose: ${p.dosage}`,
          p.frequency && p.frequency,
          p.timing    && p.timing,
          p.duration  && `for ${p.duration}`,
          p.quantity  && `Qty: ${p.quantity}`,
        ].filter(Boolean);
        if (details.length) {
          doc.fontSize(9).font('Helvetica').fillColor('#374151')
             .text(`       ${details.join('   ·   ')}`, L, doc.y, { width: W });
        }

        // ── Line 4: multilingual notes
        const originalInstruction = p.instructionsOriginal || p.instructions;
        const translatedInstructions = normalizedTranslations(p.translatedInstructions);

        if (originalInstruction) {
          doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#92400e')
             .text(`       Note (Original): ${originalInstruction}`, L, doc.y, { width: W });
        }

        Object.entries(translatedInstructions).forEach(([code, text]) => {
          const label = LANGUAGE_MAP[code] || code.toUpperCase();
          doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#0369a1')
            .text(`       ${label}: ${text}`, L, doc.y, { width: W });
        });

        if (!originalInstruction && Object.keys(translatedInstructions).length > 0) {
          doc.fillColor('#000');
        }

        // reset color
        doc.fillColor('#000');
        doc.moveDown(0.6);

        // thin divider between medicines
        if (idx < prescriptions.length - 1) {
          const lineY = doc.y - 3;
          doc.moveTo(L, lineY).lineTo(545, lineY)
             .lineWidth(0.3).strokeColor('#d1d5db').stroke()
             .strokeColor('#000').lineWidth(0.5);
        }
      });
    }

    doc.moveDown(0.5);
    drawHRule(doc);
    doc.moveDown(0.5);

    // Diagnosis & Notes — always anchored at left margin x=50
    if (appointment.diagnosis) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000')
         .text('Diagnosis:', 50, doc.y, { width: 495 });
      doc.fontSize(9).font('Helvetica')
         .text(appointment.diagnosis, 50, doc.y, { width: 495, indent: 10 });
      doc.moveDown(0.3);
    }
    if (appointment.notes) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000')
         .text('Clinical Notes:', 50, doc.y, { width: 495 });
      doc.fontSize(9).font('Helvetica')
         .text(appointment.notes, 50, doc.y, { width: 495, indent: 10 });
    }

    drawFooter(doc, settings, true, appointment);
    doc.end();
  } catch (err) {
    console.error('Prescription PDF error:', err);
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
};

// ─── 2. Medical Bill PDF ──────────────────────────────────────────────────────
exports.generateBill = async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.appointmentId, {
      include: [
        {
          model: Doctor, as: 'doctor',
          include: [{ model: Hospital, as: 'hospital' }],
        },
        { model: Patient, as: 'patient' },
        { model: LabTest, as: 'labTests' },
      ],
    });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    const hospital = appointment.doctor?.hospital;
    if (!hospital) return res.status(400).json({ message: 'Hospital not found' });
    const settings = await getSettings(hospital.id);
    const patient = appointment.patient;
    const currency = settings.currency || '₹';

    const doc = initDoc(res, `bill-${appointment.appointmentNumber}.pdf`);
    drawHeader(doc, hospital, settings);

    // Title + Bill info
    doc.fontSize(13).font('Helvetica-Bold').text('INVOICE / MEDICAL BILL', { align: 'center' });
    doc.moveDown(0.3);
    drawHRule(doc);
    doc.moveDown(0.5);

    // Bill meta
    const billRows = [
      ['Bill No:', appointment.appointmentNumber, 'Date:', fmtDate(appointment.appointmentDate)],
      ['Patient:', patient?.name || '—', 'Patient ID:', patient?.patientId || '—'],
      ['Doctor:', `Dr. ${appointment.doctor?.name || '—'}`, 'Payment:', appointment.isPaid ? '✓ Paid' : '⬜ Unpaid'],
    ];
    doc.fontSize(9);
    billRows.forEach(([l1, v1, l2, v2]) => {
      doc.font('Helvetica-Bold').text(l1, 50, doc.y, { width: 70, continued: true })
         .font('Helvetica').text(v1, { width: 180, continued: true })
         .font('Helvetica-Bold').text(l2, { width: 80, continued: true })
         .font('Helvetica').text(v2, { width: 130 });
    });

    doc.moveDown(0.5);
    drawHRule(doc);
    doc.moveDown(0.5);

    // Line items
    doc.fontSize(10).font('Helvetica-Bold').text('Charges');
    doc.moveDown(0.3);

    // Header row
    const cw = [300, 100, 95];
    const hY = doc.y;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Description', 50, hY, { width: cw[0] });
    doc.text('Qty', 50 + cw[0], hY, { width: cw[1], align: 'right' });
    doc.text('Amount', 50 + cw[0] + cw[1], hY, { width: cw[2], align: 'right' });
    doc.moveDown(0.2);
    drawHRule(doc);
    doc.moveDown(0.3);

    let subtotal = 0;

    // Consultation row
    const consultFee = parseFloat(appointment.fee) || 0;
    subtotal += consultFee;
    const rY1 = doc.y;
    doc.font('Helvetica').fontSize(9);
    doc.text(`${appointment.type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} — Dr. ${appointment.doctor?.name || ''}`, 50, rY1, { width: cw[0] });
    doc.text('1', 50 + cw[0], rY1, { width: cw[1], align: 'right' });
    doc.text(fmtMoney(consultFee, currency), 50 + cw[0] + cw[1], rY1, { width: cw[2], align: 'right' });
    doc.moveDown(0.4);

    const treatmentFee = parseFloat(appointment.treatmentBill) || 0;
    if (treatmentFee > 0) {
      subtotal += treatmentFee;
      const treatmentLabel = appointment.treatmentDone
        ? `Treatment: ${appointment.treatmentDone}`
        : 'Treatment Charges';
      const rY2 = doc.y;
      doc.text(treatmentLabel, 50, rY2, { width: cw[0] });
      doc.text('1', 50 + cw[0], rY2, { width: cw[1], align: 'right' });
      doc.text(fmtMoney(treatmentFee, currency), 50 + cw[0] + cw[1], rY2, { width: cw[2], align: 'right' });
      doc.moveDown(0.4);
    }

    // Lab test rows
    const labTests = appointment.labTests || [];
    labTests.forEach(lt => {
      const price = parseFloat(lt.price) || 0;
      subtotal += price;
      const rY = doc.y;
      doc.text(`Lab: ${lt.testName}`, 50, rY, { width: cw[0] });
      doc.text('1', 50 + cw[0], rY, { width: cw[1], align: 'right' });
      doc.text(fmtMoney(price, currency), 50 + cw[0] + cw[1], rY, { width: cw[2], align: 'right' });
      doc.moveDown(0.4);
    });

    // Totals: use configurable tax rate when available; default to 0 to avoid incorrect hard-coded taxation.
    const taxRate = Number(settings?.billTaxRate || 0);
    const gst = subtotal * (taxRate / 100);
    const total = subtotal + gst;

    doc.moveDown(0.3);
    drawHRule(doc);
    doc.moveDown(0.3);

    const totals = [
      ['Subtotal', fmtMoney(subtotal, currency)],
      [`Tax (${taxRate}%)`, fmtMoney(gst, currency)],
    ];
    totals.forEach(([label, val]) => {
      const ty = doc.y;
      doc.fontSize(9).font('Helvetica').text(label, 50 + cw[0], ty, { width: cw[1], align: 'right' });
      doc.text(val, 50 + cw[0] + cw[1], ty, { width: cw[2], align: 'right' });
      doc.moveDown(0.3);
    });

    drawHRule(doc);
    doc.moveDown(0.2);
    const gtY = doc.y;
    doc.fontSize(11).font('Helvetica-Bold').text('TOTAL', 50 + cw[0], gtY, { width: cw[1], align: 'right' });
    doc.text(fmtMoney(total, currency), 50 + cw[0] + cw[1], gtY, { width: cw[2], align: 'right' });
    doc.moveDown(0.3);
    drawHRule(doc);

    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica-Bold')
       .text(`Payment Status: `, { continued: true })
       .font('Helvetica').text(appointment.isPaid ? 'PAID' : 'UNPAID');

    drawFooter(doc, settings, false);
    doc.end();
  } catch (err) {
    console.error('Bill PDF error:', err);
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
};

// ─── 3. Appointment Receipt PDF ───────────────────────────────────────────────
exports.generateReceipt = async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.appointmentId, {
      include: [
        { model: Doctor, as: 'doctor', include: [{ model: Hospital, as: 'hospital' }] },
        { model: Patient, as: 'patient' },
      ],
    });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    const hospital = appointment.doctor?.hospital;
    if (!hospital) return res.status(400).json({ message: 'Hospital not found' });
    const settings = await getSettings(hospital.id);
    const currency = settings.currency || '₹';

    const doc = initDoc(res, `receipt-${appointment.appointmentNumber}.pdf`);
    drawHeader(doc, hospital, settings);

    doc.fontSize(13).font('Helvetica-Bold').text('APPOINTMENT RECEIPT', { align: 'center' });
    doc.moveDown(0.3);
    drawHRule(doc);
    doc.moveDown(0.5);

    const rows = [
      ['Receipt No:', appointment.appointmentNumber],
      ['Date:', fmtDate(appointment.appointmentDate)],
      ['Time:', appointment.appointmentTime || '—'],
      ['Patient:', appointment.patient?.name || '—'],
      ['Patient ID:', appointment.patient?.patientId || '—'],
      ['Doctor:', `Dr. ${appointment.doctor?.name || '—'}`],
      ['Type:', appointment.type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—'],
      ['Status:', appointment.status?.replace(/_/g, ' ').toUpperCase()],
    ];
    doc.fontSize(9);
    rows.forEach(([label, val]) => {
      doc.font('Helvetica-Bold').text(`${label} `, { continued: true }).font('Helvetica').text(val);
    });

    doc.moveDown(0.5);
    drawHRule(doc);
    doc.moveDown(0.3);
    const fee = parseFloat(appointment.fee) || 0;
    doc.fontSize(11).font('Helvetica-Bold').text(`Consultation Fee: `, { continued: true })
       .font('Helvetica').text(fmtMoney(fee, currency));
    doc.moveDown(0.2);
    doc.fontSize(10).font('Helvetica-Bold').text(`Payment: `, { continued: true })
       .font('Helvetica').text(appointment.isPaid ? 'PAID' : 'UNPAID');

    drawFooter(doc, settings, false);
    doc.end();
  } catch (err) {
    console.error('Receipt PDF error:', err);
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
};

// ─── 4. Lab Report PDF ────────────────────────────────────────────────────────
exports.generateLabReport = async (req, res) => {
  try {
    const labTest = await LabTest.findByPk(req.params.labTestId, {
      include: [
        { model: Patient, as: 'patient' },
        {
          model: Lab, as: 'lab',
          include: [{ model: Hospital, as: 'hospital' }],
        },
        {
          model: Appointment, as: 'appointment',
          include: [{ model: Doctor, as: 'doctor' }],
        },
      ],
    });
    if (!labTest) return res.status(404).json({ message: 'Lab test not found' });
    if (!(await ensureLabReportAccess(req, res, labTest))) return;

    const hospital = labTest.lab?.hospital;
    if (!hospital) return res.status(400).json({ message: 'Hospital not found for lab test' });
    const settings = await getSettings(hospital.id);

    const doc = initDoc(res, `lab-report-${labTest.testNumber}.pdf`);
    drawHeader(doc, hospital, settings);

    // Lab info
    if (labTest.lab?.name) {
      doc.fontSize(11).font('Helvetica-Bold').text(`LAB: ${labTest.lab.name}`, { align: 'center' });
    }
    doc.fontSize(13).font('Helvetica-Bold').text('LAB REPORT', { align: 'center' });
    doc.moveDown(0.3);
    drawHRule(doc);
    doc.moveDown(0.5);

    // Report meta
    const patient = labTest.patient;
    const metaRows = [
      ['Report No:', labTest.testNumber, 'Test Name:', labTest.testName],
      ['Patient:', patient?.name || '—', 'Patient ID:', patient?.patientId || '—'],
      ['Age / Gender:', `${patientAge(patient?.dateOfBirth)} / ${patient?.gender || '—'}`, 'Category:', labTest.category || '—'],
      ['Doctor:', `Dr. ${labTest.appointment?.doctor?.name || '—'}`, 'Test Code:', labTest.testCode || '—'],
      ['Ordered:', fmtDate(labTest.orderedDate), 'Completed:', fmtDate(labTest.completedDate)],
    ];
    doc.fontSize(9);
    metaRows.forEach(([l1, v1, l2, v2]) => {
      doc.font('Helvetica-Bold').text(l1, 50, doc.y, { width: 80, continued: true })
         .font('Helvetica').text(v1, { width: 160, continued: true })
         .font('Helvetica-Bold').text(l2, { width: 85, continued: true })
         .font('Helvetica').text(v2, { width: 160 });
    });

    doc.moveDown(0.5);
    drawHRule(doc);
    doc.moveDown(0.5);

    // Results section
    doc.fontSize(11).font('Helvetica-Bold').text('Test Results');
    doc.moveDown(0.3);

    // Result table headers
    const rCols = [170, 100, 110, 60, 55];
    const rHeaders = ['Parameter', 'Result', 'Normal Range', 'Unit', 'Flag'];
    const rhY = doc.y;
    doc.fontSize(9).font('Helvetica-Bold');
    let rx = 50;
    rHeaders.forEach((h, i) => { doc.text(h, rx, rhY, { width: rCols[i] }); rx += rCols[i]; });
    doc.moveDown(0.2);
    drawHRule(doc);
    doc.moveDown(0.3);

    // Try parsing result as JSON for structured output, fallback to plain text
    let resultsRendered = false;
    if (labTest.result) {
      try {
        const parsed = JSON.parse(labTest.result);
        if (Array.isArray(parsed)) {
          parsed.forEach(row => {
            const flag = row.flag || (labTest.isAbnormal ? 'ABN' : 'N');
            const cells = [row.parameter || '—', row.result || '—', row.normalRange || labTest.normalRange || '—', row.unit || labTest.unit || '—', flag];
            const rowY = doc.y;
            doc.font('Helvetica').fontSize(9);
            rx = 50;
            cells.forEach((cell, i) => { doc.text(cell, rx, rowY, { width: rCols[i] }); rx += rCols[i]; });
            doc.moveDown(0.4);
          });
          resultsRendered = true;
        }
      } catch (_) { /* not JSON, use plain text */ }
    }

    if (!resultsRendered) {
      // Single result row
      const flag = labTest.isAbnormal ? 'ABN' : 'N';
      const cells = [labTest.testName, labTest.resultValue || labTest.result || '—', labTest.normalRange || '—', labTest.unit || '—', flag];
      const rowY = doc.y;
      doc.font('Helvetica').fontSize(9);
      rx = 50;
      cells.forEach((cell, i) => { doc.text(String(cell).slice(0, 50), rx, rowY, { width: rCols[i] }); rx += rCols[i]; });
      doc.moveDown(0.4);
    }

    // Status
    doc.moveDown(0.3);
    drawHRule(doc);
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica-Bold').text('Status: ', { continued: true })
       .font('Helvetica').text(labTest.status?.replace(/_/g, ' ').toUpperCase() || '—');
    if (labTest.isAbnormal) {
      doc.fontSize(9).font('Helvetica-Bold').fillColor('red').text('⚠ ABNORMAL RESULT — Please consult your doctor').fillColor('black');
    }

    // Technician notes
    if (labTest.technicianNotes) {
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica-Bold').text('Technician Notes: ', { continued: true })
         .font('Helvetica').text(labTest.technicianNotes);
    }

    // Signature
    doc.moveDown(1.5);
    const sigX = 370;
    doc.moveTo(sigX, doc.y).lineTo(545, doc.y).lineWidth(0.5).strokeColor('#555').stroke().strokeColor('#000');
    doc.fontSize(9).font('Helvetica-Bold').text('Lab Technician', sigX, doc.y + 2, { width: 175 });
    if (labTest.lab?.name) doc.fontSize(9).font('Helvetica').text(labTest.lab.name, sigX, doc.y, { width: 175 });

    drawFooter(doc, settings, false);
    doc.end();
  } catch (err) {
    console.error('Lab report PDF error:', err);
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
};

// ─── 5. Medicine Invoice PDF ─────────────────────────────────────────────────
exports.generateMedicineInvoice = async (req, res) => {
  try {
    const invoice = await MedicineInvoice.findByPk(req.params.invoiceId, {
      include: [
        { model: Hospital, as: 'hospital' },
        { model: Patient, as: 'patient' },
        { model: User, as: 'soldBy', attributes: ['id', 'name', 'email'] },
        {
          model: MedicineInvoiceItem,
          as: 'items',
          include: [{ model: Medication, as: 'medication' }],
        },
      ],
    });

    if (!invoice) return res.status(404).json({ message: 'Medicine invoice not found' });
    if (!(await ensureMedicineInvoiceAccess(req, res, invoice))) return;
    if (!invoice.hospital) return res.status(400).json({ message: 'Hospital not found for invoice' });

    const settings = await getSettings(invoice.hospital.id);
    const currency = settings.currency || '₹';

    const doc = initDoc(res, `medicine-invoice-${invoice.invoiceNumber || invoice.id}.pdf`);
    drawHeader(doc, invoice.hospital, settings);

    doc.fontSize(13).font('Helvetica-Bold').text('PHARMACY INVOICE', { align: 'center' });
    doc.moveDown(0.3);
    drawHRule(doc);
    doc.moveDown(0.5);

    const soldBy = invoice.soldBy?.name || '—';
    const metaRows = [
      ['Invoice No:', invoice.invoiceNumber || '—', 'Date:', fmtDate(invoice.invoiceDate)],
      ['Patient:', invoice.patient?.name || 'Walk-in Customer', 'Patient ID:', invoice.patient?.patientId || '—'],
      ['Phone:', invoice.patient?.phone || '—', 'Sold By:', soldBy],
      ['Payment:', invoice.isPaid ? '✓ Paid' : '⬜ Unpaid', 'Mode:', (invoice.paymentMode || 'cash').replace(/_/g, ' ')],
    ];

    doc.fontSize(9);
    metaRows.forEach(([l1, v1, l2, v2]) => {
      doc.font('Helvetica-Bold').text(l1, 50, doc.y, { width: 80, continued: true })
         .font('Helvetica').text(v1, { width: 160, continued: true })
         .font('Helvetica-Bold').text(l2, { width: 85, continued: true })
         .font('Helvetica').text(v2, { width: 160 });
    });

    doc.moveDown(0.5);
    drawHRule(doc);
    doc.moveDown(0.5);

    // cols: Medicine | HSN | Qty | Unit | Disc | Tax | Amount
    const cols = [155, 45, 50, 65, 45, 45, 60];
    const colX = cols.reduce((acc, w, i) => { acc.push((acc[i - 1] || 50) + (i > 0 ? cols[i - 1] : 0)); return acc; }, [50]);
    const headY = doc.y;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Medicine', colX[0], headY, { width: cols[0] });
    doc.text('HSN', colX[1], headY, { width: cols[1] });
    doc.text('Qty', colX[2], headY, { width: cols[2], align: 'right' });
    doc.text('Unit', colX[3], headY, { width: cols[3], align: 'right' });
    doc.text('Disc', colX[4], headY, { width: cols[4], align: 'right' });
    doc.text('GST%', colX[5], headY, { width: cols[5], align: 'right' });
    doc.text('Amount', colX[6], headY, { width: cols[6], align: 'right' });
    doc.moveDown(0.2);
    drawHRule(doc);
    doc.moveDown(0.3);

    (invoice.items || []).forEach((item) => {
      const y = doc.y;
      const med = item.medication;
      const medName = med?.name || 'Medicine';
      const hsnCode = med?.hsnCode || '—';
      doc.font('Helvetica').fontSize(9);
      doc.text(medName, colX[0], y, { width: cols[0] });
      doc.font('Helvetica').fontSize(8).fillColor('#475569')
         .text(hsnCode, colX[1], y + 1, { width: cols[1] });
      doc.fillColor('#000').fontSize(9);
      doc.text(String(item.quantity || 0), colX[2], y, { width: cols[2], align: 'right' });
      doc.text(fmtMoney(item.unitPrice, currency), colX[3], y, { width: cols[3], align: 'right' });
      doc.text(`${Number(item.discountPct || 0).toFixed(1)}%`, colX[4], y, { width: cols[4], align: 'right' });
      doc.text(`${Number(item.taxPct || 0).toFixed(1)}%`, colX[5], y, { width: cols[5], align: 'right' });
      doc.text(fmtMoney(item.lineTotal, currency), colX[6], y, { width: cols[6], align: 'right' });
      doc.moveDown(0.4);
    });

    doc.moveDown(0.3);
    drawHRule(doc);
    doc.moveDown(0.3);

    const sumRows = [
      ['Subtotal', invoice.subtotal],
      ['Discount', invoice.discountAmount],
      ['Tax', invoice.taxAmount],
    ];
    sumRows.forEach(([label, value]) => {
      const y = doc.y;
      doc.fontSize(9).font('Helvetica').text(label, colX[3], y, { width: cols[3] + cols[4] + cols[5], align: 'right' });
      doc.text(fmtMoney(value, currency), colX[6], y, { width: cols[6], align: 'right' });
      doc.moveDown(0.25);
    });

    drawHRule(doc);
    doc.moveDown(0.2);
    const tY = doc.y;
    doc.fontSize(11).font('Helvetica-Bold').text('TOTAL', colX[3], tY, { width: cols[3] + cols[4] + cols[5], align: 'right' });
    doc.text(fmtMoney(invoice.totalAmount, currency), colX[6], tY, { width: cols[6], align: 'right' });

    if (invoice.notes) {
      doc.moveDown(0.8);
      doc.fontSize(9).font('Helvetica-Bold').text('Notes:', 50, doc.y, { width: 495 });
      doc.font('Helvetica').text(invoice.notes, 50, doc.y, { width: 495 });
    }

    drawFooter(doc, settings, false);
    doc.end();
  } catch (err) {
    console.error('Medicine invoice PDF error:', err);
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
};

// 6. Medicine Return Note (Credit Note)
exports.generateMedicineReturnNote = async (req, res) => {
  try {
    const ret = await MedicineInvoiceReturn.findByPk(req.params.returnId, {
      include: [
        {
          model: MedicineInvoice,
          as: 'invoice',
          include: [
            { model: Hospital, as: 'hospital' },
            { model: Patient, as: 'patient' },
          ],
        },
        { model: User, as: 'createdBy', attributes: ['id', 'name', 'email'] },
        {
          model: MedicineInvoiceReturnItem,
          as: 'items',
          include: [{ model: Medication, as: 'medication' }],
        },
      ],
    });
    if (!ret) return res.status(404).json({ message: 'Medicine return not found' });
    if (!ret.invoice?.hospital) return res.status(400).json({ message: 'Hospital not found for return' });

    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;
    if (!isSuperAdmin(req.user) && ret.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital return note' });
    }

    const settings = await getSettings(ret.invoice.hospital.id);
    const currency = settings.currency || 'Rs ';
    const doc = initDoc(res, `medicine-return-${ret.returnNumber || ret.id}.pdf`);
    drawHeader(doc, ret.invoice.hospital, settings);

    doc.fontSize(13).font('Helvetica-Bold').text('CREDIT NOTE - MEDICINE RETURN', { align: 'center' });
    doc.moveDown(0.3);
    drawHRule(doc);
    doc.moveDown(0.5);

    const metaRows = [
      ['Return No:', ret.returnNumber || '-', 'Date:', fmtDate(ret.returnDate)],
      ['Invoice No:', ret.invoice?.invoiceNumber || '-', 'Invoice Date:', fmtDate(ret.invoice?.invoiceDate)],
      ['Patient:', ret.invoice?.patient?.name || 'Walk-in', 'Patient ID:', ret.invoice?.patient?.patientId || '-'],
      ['Reason:', ret.reason || '-', 'Created By:', ret.createdBy?.name || '-'],
    ];
    doc.fontSize(9);
    metaRows.forEach(([l1, v1, l2, v2]) => {
      doc.font('Helvetica-Bold').text(l1, 50, doc.y, { width: 90, continued: true })
         .font('Helvetica').text(v1, { width: 150, continued: true })
         .font('Helvetica-Bold').text(l2, { width: 95, continued: true })
         .font('Helvetica').text(v2, { width: 160 });
    });

    doc.moveDown(0.4);
    drawHRule(doc);
    doc.moveDown(0.4);

    const cols = [230, 60, 70, 60, 75];
    const x = [50, 280, 340, 410, 470];
    const hy = doc.y;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Medicine', x[0], hy, { width: cols[0] });
    doc.text('Qty', x[1], hy, { width: cols[1], align: 'right' });
    doc.text('Unit', x[2], hy, { width: cols[2], align: 'right' });
    doc.text('Tax', x[3], hy, { width: cols[3], align: 'right' });
    doc.text('Amount', x[4], hy, { width: cols[4], align: 'right' });
    doc.moveDown(0.2);
    drawHRule(doc);
    doc.moveDown(0.3);

    (ret.items || []).forEach((it) => {
      const y = doc.y;
      doc.font('Helvetica').fontSize(9);
      doc.text(it.medication?.name || 'Medicine', x[0], y, { width: cols[0] });
      doc.text(String(it.quantity || 0), x[1], y, { width: cols[1], align: 'right' });
      doc.text(fmtMoney(it.unitPrice, currency), x[2], y, { width: cols[2], align: 'right' });
      doc.text(fmtMoney(it.lineTax, currency), x[3], y, { width: cols[3], align: 'right' });
      doc.text(fmtMoney(it.lineTotal, currency), x[4], y, { width: cols[4], align: 'right' });
      doc.moveDown(0.35);
    });

    doc.moveDown(0.3);
    drawHRule(doc);
    doc.moveDown(0.25);
    doc.fontSize(9).font('Helvetica').text('Subtotal', x[3] - 40, doc.y, { width: 100, align: 'right' });
    doc.text(fmtMoney(ret.subtotal, currency), x[4], doc.y, { width: cols[4], align: 'right' });
    doc.moveDown(0.25);
    doc.fontSize(9).font('Helvetica').text('Tax', x[3] - 40, doc.y, { width: 100, align: 'right' });
    doc.text(fmtMoney(ret.taxAmount, currency), x[4], doc.y, { width: cols[4], align: 'right' });
    doc.moveDown(0.25);
    drawHRule(doc);
    doc.moveDown(0.2);
    doc.fontSize(11).font('Helvetica-Bold').text('TOTAL CREDIT', x[3] - 60, doc.y, { width: 120, align: 'right' });
    doc.text(fmtMoney(ret.totalAmount, currency), x[4], doc.y, { width: cols[4], align: 'right' });

    if (ret.notes) {
      doc.moveDown(0.8);
      doc.fontSize(9).font('Helvetica-Bold').text('Notes:', 50, doc.y, { width: 495 });
      doc.font('Helvetica').text(ret.notes, 50, doc.y, { width: 495 });
    }

    drawFooter(doc, settings, false);
    doc.end();
  } catch (err) {
    console.error('Medicine return PDF error:', err);
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
};

// 7. Purchase Return Note (Debit Note)
exports.generatePurchaseReturnNote = async (req, res) => {
  try {
    const ret = await StockPurchaseReturn.findByPk(req.params.returnId, {
      include: [
        {
          model: StockPurchase,
          as: 'purchase',
          include: [
            { model: Hospital, as: 'hospital' },
            { model: Medication, as: 'medication' },
            { model: Vendor, as: 'vendor' },
          ],
        },
        { model: Medication, as: 'medication' },
        { model: Vendor, as: 'vendor' },
        { model: User, as: 'createdBy', attributes: ['id', 'name', 'email'] },
      ],
    });
    if (!ret) return res.status(404).json({ message: 'Purchase return not found' });
    if (!ret.purchase?.hospital) return res.status(400).json({ message: 'Hospital not found for purchase return' });

    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;
    if (!isSuperAdmin(req.user) && ret.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital return note' });
    }

    const settings = await getSettings(ret.purchase.hospital.id);
    const currency = settings.currency || 'Rs ';
    const doc = initDoc(res, `purchase-return-${ret.returnNumber || ret.id}.pdf`);
    drawHeader(doc, ret.purchase.hospital, settings);

    doc.fontSize(13).font('Helvetica-Bold').text('DEBIT NOTE - PURCHASE RETURN', { align: 'center' });
    doc.moveDown(0.3);
    drawHRule(doc);
    doc.moveDown(0.5);

    const metaRows = [
      ['Return No:', ret.returnNumber || '-', 'Date:', fmtDate(ret.returnDate)],
      ['Purchase Invoice:', ret.purchase?.invoiceNumber || '-', 'Purchase Date:', fmtDate(ret.purchase?.purchaseDate)],
      ['Vendor:', ret.vendor?.name || ret.purchase?.vendor?.name || '-', 'Medication:', ret.medication?.name || ret.purchase?.medication?.name || '-'],
      ['Reason:', ret.reason || '-', 'Created By:', ret.createdBy?.name || '-'],
    ];
    doc.fontSize(9);
    metaRows.forEach(([l1, v1, l2, v2]) => {
      doc.font('Helvetica-Bold').text(l1, 50, doc.y, { width: 95, continued: true })
         .font('Helvetica').text(v1, { width: 145, continued: true })
         .font('Helvetica-Bold').text(l2, { width: 100, continued: true })
         .font('Helvetica').text(v2, { width: 155 });
    });

    doc.moveDown(0.4);
    drawHRule(doc);
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica-Bold').text('Return Summary');
    doc.moveDown(0.3);
    const infoRows = [
      ['Quantity Returned', String(ret.quantity || 0)],
      ['Unit Cost', fmtMoney(ret.unitCost, currency)],
      ['Tax %', `${Number(ret.taxPct || 0).toFixed(2)}%`],
      ['Taxable Value', fmtMoney(ret.taxableAmount, currency)],
      ['Tax Amount', fmtMoney(ret.taxAmount, currency)],
      ['Total Debit', fmtMoney(ret.totalAmount, currency)],
    ];
    infoRows.forEach(([label, value]) => {
      doc.fontSize(9).font('Helvetica-Bold').text(`${label}: `, 50, doc.y, { width: 150, continued: true })
        .font('Helvetica').text(value, { width: 200 });
    });

    if (ret.notes) {
      doc.moveDown(0.6);
      doc.fontSize(9).font('Helvetica-Bold').text('Notes:', 50, doc.y, { width: 495 });
      doc.font('Helvetica').text(ret.notes, 50, doc.y, { width: 495 });
    }

    drawFooter(doc, settings, false);
    doc.end();
  } catch (err) {
    console.error('Purchase return PDF error:', err);
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
};
