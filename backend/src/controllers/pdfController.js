const PDFDocument = require('pdfkit');
const {
  Appointment,
  Doctor,
  Patient,
  Hospital,
  HospitalSettings,
  Prescription,
  Medication,
  MedicineCatalog,
  LabTest,
  LabReportTemplate,
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

function drawHeader(doc, hospital, settings, doctor = null) {
  const startY = doc.y;
  const name = hospital.name || 'Hospital';
  const addrParts = [hospital.address, hospital.city, hospital.state, hospital.zipCode].filter(Boolean);
  const addr = addrParts.join(', ');
  const phone = settings.phone || hospital.phone || '';
  const email = hospital.email || '';

  const docName = doctor?.name
    ? (doctor.name.startsWith('Dr.') ? doctor.name : `Dr. ${doctor.name}`)
    : (settings.doctorName ? (settings.doctorName.startsWith('Dr.') ? settings.doctorName : `Dr. ${settings.doctorName}`) : '');
  const docQual = doctor?.qualification || settings.doctorQualification || '';
  const docSpec = doctor?.specialization || settings.doctorSpecialization || '';
  const docReg = doctor?.licenseNumber || settings.doctorRegNumber || '';

  const hasDoctor = Boolean(docName);

  if (hasDoctor) {
    // 2-Column Professional Header
    doc.fontSize(15).font('Helvetica-Bold').text(name, 50, startY, { width: 310 });
    if (settings.tagline) doc.fontSize(8.5).font('Helvetica-Oblique').text(settings.tagline, 50, doc.y, { width: 310 });
    if (addr) doc.fontSize(8).font('Helvetica').text(addr, 50, doc.y, { width: 310 });
    const contactLine = [phone && `Ph: ${phone}`, email].filter(Boolean).join(' | ');
    if (contactLine) doc.fontSize(8).text(contactLine, 50, doc.y, { width: 310 });
    if (settings.showGSTINOnReceipt && settings.gstin) {
      const taxLine = [`GSTIN: ${settings.gstin}`, settings.pan && `PAN: ${settings.pan}`].filter(Boolean).join(' | ');
      doc.fontSize(7.5).text(taxLine, 50, doc.y, { width: 310 });
    }

    // Right side: Doctor Info
    let rightY = startY;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text(docName, 360, rightY, { width: 185, align: 'right' });
    rightY = doc.y;
    if (docQual) {
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#334155').text(docQual, 360, rightY, { width: 185, align: 'right' });
      rightY = doc.y;
    }
    if (docSpec) {
      doc.fontSize(8).font('Helvetica').fillColor('#475569').text(docSpec, 360, rightY, { width: 185, align: 'right' });
      rightY = doc.y;
    }
    if (docReg) {
      doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text(`Reg / Lic No: ${docReg}`, 360, rightY, { width: 185, align: 'right' });
      rightY = doc.y;
    }
    doc.fillColor('#000000');
    doc.y = Math.max(doc.y, rightY) + 6;
  } else {
    // Single Centered Header
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
  }

  doc.moveDown(0.5);
  drawHRule(doc);
  doc.moveDown(0.5);
}

function drawFooter(doc, settings, showSignature, appointmentOrDoctor) {
  doc.moveDown(1.5);
  if (showSignature && settings.showDoctorOnReceipt) {
    const dName = appointmentOrDoctor?.doctor?.name ? `Dr. ${appointmentOrDoctor.doctor.name}` : settings.doctorName;
    const dQual = appointmentOrDoctor?.doctor?.qualification || settings.doctorQualification;
    const dReg = appointmentOrDoctor?.doctor?.licenseNumber || settings.doctorRegNumber;
    if (dName) {
      const sigX = 370;
      doc.moveTo(sigX, doc.y).lineTo(545, doc.y).lineWidth(0.5).strokeColor('#555').stroke().strokeColor('#000');
      doc.fontSize(10).font('Helvetica-Bold').text(dName, sigX, doc.y + 2, { width: 175 });
      if (dQual) doc.fontSize(8.5).font('Helvetica').text(dQual, sigX, doc.y, { width: 175 });
      if (dReg) doc.fontSize(8).text(`Reg / Lic No: ${dReg}`, sigX, doc.y, { width: 175 });
      doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#64748b').text('Digitally Signed / Verified', sigX, doc.y, { width: 175 }).fillColor('#000');
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

function cleanCurrency(curr) {
  if (!curr || curr === '₹' || curr.includes('₹')) return 'Rs. ';
  return curr.endsWith(' ') ? curr : `${curr} `;
}

function fmtMoney(val, currency) {
  const n = parseFloat(val) || 0;
  const c = cleanCurrency(currency);
  return `${c}${n.toFixed(2)}`;
}

function draw2ColMetaRows(doc, metaRows) {
  doc.fontSize(9);
  metaRows.forEach(([l1, v1, l2, v2]) => {
    const curY = doc.y;
    const h1 = doc.font('Helvetica').heightOfString(String(v1 || '—'), { width: 165 });
    const h2 = doc.font('Helvetica').heightOfString(String(v2 || '—'), { width: 150 });
    const rowH = Math.max(h1, h2, 12);

    doc.font('Helvetica-Bold').text(String(l1 || ''), 50, curY, { width: 85 });
    doc.font('Helvetica').text(String(v1 || '—'), 135, curY, { width: 165 });

    if (l2) {
      doc.font('Helvetica-Bold').text(String(l2 || ''), 310, curY, { width: 85 });
      doc.font('Helvetica').text(String(v2 || '—'), 395, curY, { width: 150 });
    }

    doc.y = curY + rowH + 3;
  });
  doc.x = 50;
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
          include: [{
            model: Medication, as: 'medication',
            include: [{ model: MedicineCatalog, as: 'catalog' }],
          }],
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
    drawHeader(doc, hospital, settings, doctor);

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
        const namePart = med?.catalog?.name || med?.name || '—';
        const itemType = med?.catalog?.defaultItemType || med?.itemType || med?.category;
        const dosagePart = med?.dosage ? `  ${med.dosage}` : '';
        const catPart = itemType ? `  (${itemType})` : '';
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000')
           .text(`${idx + 1}.  ${namePart}${dosagePart}${catPart}`, L, doc.y, { width: W });

        // ── Line 2: composition (blue italic)
        const comp = med?.catalog?.composition || med?.composition;
        if (comp) {
          doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#1d4ed8')
             .text(`       Composition: ${comp}`, L, doc.y, { width: W });
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
    drawHeader(doc, hospital, settings, appointment.doctor);

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
    drawHeader(doc, hospital, settings, appointment.doctor);

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
        { model: LabReportTemplate, as: 'template' },
      ],
    });
    if (!labTest) return res.status(404).json({ message: 'Lab test not found' });
    if (!(await ensureLabReportAccess(req, res, labTest))) return;

    const hospital = labTest.lab?.hospital;
    if (!hospital) return res.status(400).json({ message: 'Hospital not found for lab test' });
    const settings = await getSettings(hospital.id);

    const doc = initDoc(res, `lab-report-${labTest.testNumber}.pdf`);
    drawHeader(doc, hospital, settings, labTest.appointment?.doctor);

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
    draw2ColMetaRows(doc, metaRows);

    doc.moveDown(0.3);
    drawHRule(doc);
    doc.moveDown(0.5);

    // Results section
    doc.fontSize(11).font('Helvetica-Bold').text('Test Results', 50, doc.y);
    doc.moveDown(0.3);

    // Result table setup with border lines & grid
    const rCols = [170, 100, 110, 60, 55];
    const colX = [50, 220, 320, 430, 490, 545];
    const rHeaders = ['Parameter', 'Result', 'Normal Range', 'Unit', 'Flag'];

    let tableStartY = doc.y;

    const drawTableBorders = (startY, endY) => {
      // Outer border box
      doc.rect(50, startY, 495, endY - startY).lineWidth(0.75).strokeColor('#cbd5e1').stroke();
      // Vertical column dividers
      colX.slice(1, -1).forEach(x => {
        doc.moveTo(x, startY).lineTo(x, endY).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
      });
      doc.strokeColor('#000000');
    };

    const renderTableHeaders = () => {
      tableStartY = doc.y;
      const headerH = 22;
      // Header background rectangle with border
      doc.rect(50, tableStartY, 495, headerH).fillAndStroke('#f1f5f9', '#cbd5e1');
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);

      let rx = 50;
      rHeaders.forEach((h, i) => {
        doc.text(h, rx + 5, tableStartY + 6, { width: rCols[i] - 10, align: i === 4 ? 'center' : 'left' });
        rx += rCols[i];
      });

      doc.fillColor('#000000');
      doc.y = tableStartY + headerH;
    };

    renderTableHeaders();

    const renderRow = (paramName, val, normalRange, unit, flag) => {
      const h1 = doc.font('Helvetica').heightOfString(paramName, { width: rCols[0] - 10 });
      const h2 = doc.font('Helvetica').heightOfString(val, { width: rCols[1] - 10 });
      const rowH = Math.max(h1, h2, 14) + 6;

      if (doc.y + rowH > 720) {
        drawTableBorders(tableStartY, doc.y);
        doc.addPage();
        drawHeader(doc, hospital, settings, labTest.appointment?.doctor);
        doc.fontSize(11).font('Helvetica-Bold').text('Test Results (Cont.)', 50, doc.y);
        doc.moveDown(0.3);
        renderTableHeaders();
      }

      const rowY = doc.y;
      doc.font('Helvetica').fontSize(9).fillColor('#1e293b');

      // Cell 0: Parameter
      doc.text(paramName, 55, rowY + 4, { width: rCols[0] - 10 });
      // Cell 1: Result
      doc.text(val, 55 + rCols[0], rowY + 4, { width: rCols[1] - 10 });
      // Cell 2: Normal Range
      doc.text(normalRange, 55 + rCols[0] + rCols[1], rowY + 4, { width: rCols[2] - 10 });
      // Cell 3: Unit
      doc.text(unit, 55 + rCols[0] + rCols[1] + rCols[2], rowY + 4, { width: rCols[3] - 10 });
      // Cell 4: Flag
      if (flag === 'HIGH' || flag === 'LOW' || flag === 'ABN') {
        doc.font('Helvetica-Bold').fillColor('#dc2626').text(flag, 55 + rCols[0] + rCols[1] + rCols[2] + rCols[3], rowY + 4, { width: rCols[4] - 10, align: 'center' }).fillColor('#000000');
      } else {
        doc.text(flag, 55 + rCols[0] + rCols[1] + rCols[2] + rCols[3], rowY + 4, { width: rCols[4] - 10, align: 'center' });
      }

      doc.fillColor('#000000');
      const nextY = rowY + rowH;
      // Draw horizontal line below row
      doc.moveTo(50, nextY).lineTo(545, nextY).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
      doc.y = nextY;
    };

    let resultsRendered = false;
    const template = labTest.template;
    const templateValues = labTest.templateValues || {};

    if (template && Array.isArray(template.fields) && template.fields.length > 0) {
      template.fields.forEach(field => {
        if (!field) return;
        const valRaw = templateValues[field.key];
        const val = (valRaw !== undefined && valRaw !== null && String(valRaw).trim() !== '')
          ? String(valRaw)
          : '—';
        const normalRange = field.normalRange || (field.normalMin != null && field.normalMax != null ? `${field.normalMin} - ${field.normalMax}` : '—');
        const unit = field.unit || '—';

        let flag = 'N';
        if (val !== '—') {
          const numVal = parseFloat(val);
          if (!isNaN(numVal)) {
            if (field.normalMin != null && numVal < field.normalMin) flag = 'LOW';
            else if (field.normalMax != null && numVal > field.normalMax) flag = 'HIGH';
          }
        }

        const paramName = field.label || field.key || '—';
        renderRow(paramName, val, normalRange, unit, flag);
      });
      resultsRendered = true;
    } else if (labTest.result) {
      try {
        const parsed = JSON.parse(labTest.result);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach(row => {
            const flag = row.flag || (labTest.isAbnormal ? 'ABN' : 'N');
            renderRow(row.parameter || '—', String(row.result || '—'), row.normalRange || labTest.normalRange || '—', row.unit || labTest.unit || '—', flag);
          });
          resultsRendered = true;
        }
      } catch (_) { /* not JSON */ }
    }

    if (!resultsRendered) {
      // Single result fallback
      const flag = labTest.isAbnormal ? 'ABN' : 'N';
      renderRow(labTest.testName, String(labTest.resultValue || labTest.result || '—'), labTest.normalRange || '—', labTest.unit || '—', flag);
    }

    // Finish table borders
    drawTableBorders(tableStartY, doc.y);

    // Status
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica-Bold').text('Status: ', 50, doc.y, { continued: true })
       .font('Helvetica').text(labTest.status?.replace(/_/g, ' ').toUpperCase() || '—');
    if (labTest.isAbnormal) {
      doc.fontSize(9).font('Helvetica-Bold').fillColor('red').text('⚠ ABNORMAL RESULT — Please consult your doctor', 50, doc.y).fillColor('black');
    }

    // Technician notes
    if (labTest.technicianNotes) {
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica-Bold').text('Technician Notes: ', 50, doc.y, { continued: true })
         .font('Helvetica').text(labTest.technicianNotes);
    }

    if (doc.y > 680) {
      doc.addPage();
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

// ─── 4b. Lab Test Billing Receipt PDF ─────────────────────────────────────────
exports.generateLabReceipt = async (req, res) => {
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
    const currency = cleanCurrency(settings.currency);

    const doc = initDoc(res, `lab-receipt-${labTest.testNumber}.pdf`);
    drawHeader(doc, hospital, settings, labTest.appointment?.doctor);

    doc.fontSize(13).font('Helvetica-Bold').text('LAB TEST RECEIPT / TAX INVOICE', { align: 'center' });
    doc.moveDown(0.3);
    drawHRule(doc);
    doc.moveDown(0.5);

    const patient = labTest.patient;
    const metaRows = [
      ['Receipt No:', `REC-${labTest.testNumber}`, 'Date:', fmtDate(labTest.orderedDate || labTest.createdAt)],
      ['Patient Name:', patient?.name || '—', 'Patient ID:', patient?.patientId || '—'],
      ['Phone:', patient?.phone || '—', 'Gender:', patient?.gender || '—'],
      ['Lab Name:', labTest.lab?.name || '—', 'Status:', labTest.status?.replace(/_/g, ' ').toUpperCase() || 'PAID'],
    ];

    draw2ColMetaRows(doc, metaRows);

    doc.moveDown(0.3);
    drawHRule(doc);
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica-Bold').text('Billed Test Items', 50, doc.y);
    doc.moveDown(0.3);

    const rCols = [240, 90, 80, 85];
    const colX = [50, 290, 380, 460, 545];
    const rHeaders = ['Item Description', 'Category', 'Code', 'Amount'];
    const tableStartY = doc.y;
    const headerH = 22;

    doc.rect(50, tableStartY, 495, headerH).fillAndStroke('#f1f5f9', '#cbd5e1');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);

    let rx = 50;
    rHeaders.forEach((h, i) => {
      doc.text(h, rx + 5, tableStartY + 6, { width: rCols[i] - 10, align: i === 3 ? 'right' : 'left' });
      rx += rCols[i];
    });

    doc.fillColor('#000000');
    const rowY = tableStartY + headerH;
    const price = parseFloat(labTest.price || 0);

    doc.font('Helvetica').fontSize(9).fillColor('#1e293b');
    doc.text(labTest.testName, 55, rowY + 5, { width: rCols[0] - 10 });
    doc.text(labTest.category || 'Laboratory', 55 + rCols[0], rowY + 5, { width: rCols[1] - 10 });
    doc.text(labTest.testCode || 'LAB-01', 55 + rCols[0] + rCols[1], rowY + 5, { width: rCols[2] - 10 });
    doc.text(`${currency}${price.toFixed(2)}`, 55 + rCols[0] + rCols[1] + rCols[2], rowY + 5, { width: rCols[3] - 10, align: 'right' });

    const endY = rowY + 24;
    doc.moveTo(50, endY).lineTo(545, endY).lineWidth(0.5).strokeColor('#e2e8f0').stroke();

    // Draw borders & grid
    doc.rect(50, tableStartY, 495, endY - tableStartY).lineWidth(0.75).strokeColor('#cbd5e1').stroke();
    colX.slice(1, -1).forEach(x => {
      doc.moveTo(x, tableStartY).lineTo(x, endY).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
    });
    doc.strokeColor('#000000');

    doc.y = endY + 10;
    const totY = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
    doc.text('TOTAL AMOUNT PAID:', 280, totY, { width: 160, align: 'right' });
    doc.text(`${currency}${price.toFixed(2)}`, 445, totY, { width: 100, align: 'right' });

    doc.moveDown(1.5);
    drawFooter(doc, settings, true);
    doc.end();
  } catch (err) {
    console.error('Lab receipt PDF error:', err);
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
      const hsnCode = med?.hsnCode || item.hsnCode || '—';
      const itemType = item.itemType || med?.itemType || med?.category || 'tablet';
      const unit = item.unit || med?.unit || 'pcs';
      const typeBadge = itemType && itemType !== 'tablet' ? ` (${itemType.replace(/_/g, ' ')})` : '';
      const displayName = `${medName}${typeBadge}`;

      doc.font('Helvetica').fontSize(9);
      doc.text(displayName, colX[0], y, { width: cols[0] });
      doc.font('Helvetica').fontSize(8).fillColor('#475569')
         .text(hsnCode, colX[1], y + 1, { width: cols[1] });
      doc.fillColor('#000').fontSize(9);
      doc.text(`${item.quantity || 0} ${unit}`, colX[2], y, { width: cols[2], align: 'right' });
      doc.text(fmtMoney(item.unitPrice, currency), colX[3], y, { width: cols[3], align: 'right' });
      doc.text(`${Number(item.discountPct || 0).toFixed(1)}%`, colX[4], y, { width: cols[4], align: 'right' });
      doc.text(`${Number(item.taxPct || 0).toFixed(1)}%`, colX[5], y, { width: cols[5], align: 'right' });
      doc.text(fmtMoney(item.lineTotal, currency), colX[6], y, { width: cols[6], align: 'right' });
      doc.moveDown(0.4);
    });

    doc.moveDown(0.3);
    drawHRule(doc);
    doc.moveDown(0.3);

    const cgstVal = parseFloat(invoice.cgstAmount || (invoice.taxAmount ? invoice.taxAmount / 2 : 0));
    const sgstVal = parseFloat(invoice.sgstAmount || (invoice.taxAmount ? invoice.taxAmount / 2 : 0));
    const igstVal = parseFloat(invoice.igstAmount || 0);

    const sumRows = [
      ['Subtotal', invoice.subtotal],
      ['Discount', invoice.discountAmount],
      invoice.isInterstate ? ['IGST Tax', igstVal] : ['CGST Tax', cgstVal],
      ...(invoice.isInterstate ? [] : [['SGST Tax', sgstVal]]),
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

// ─── 8. Discharge Summary PDF ─────────────────────────────────────────────────
exports.dischargeSummary = async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.appointmentId, {
      include: [
        { model: Doctor, as: 'doctor', include: [{ model: Hospital, as: 'hospital' }] },
        { model: Patient, as: 'patient' },
        { model: Prescription, as: 'prescriptions', include: [{ model: Medication, as: 'medication' }] },
      ],
    });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
    if (!(await ensureAppointmentPdfAccess(req, res, appointment))) return;

    const hospital = appointment.doctor?.hospital;
    if (!hospital) return res.status(400).json({ message: 'Hospital not found' });
    const settings = await getSettings(hospital.id);
    const patient = appointment.patient;
    const doctor = appointment.doctor;

    // Extra params from query
    const conditionAtDischarge = req.query.conditionAtDischarge || 'Stable';
    const dischargeDate = req.query.dischargeDate || new Date().toISOString().split('T')[0];
    const dischargeNotes = req.query.dischargeNotes || '';

    const doc = initDoc(res, `discharge-summary-${appointment.appointmentNumber}.pdf`);
    drawHeader(doc, hospital, settings);

    // Title
    doc.fontSize(14).font('Helvetica-Bold').text('DISCHARGE SUMMARY', { align: 'center' });
    doc.moveDown(0.3);
    drawHRule(doc);
    doc.moveDown(0.6);

    // Patient info box
    const leftX = 50, rightX = 310, colW = 230;
    const startY = doc.y;
    doc.fontSize(9).font('Helvetica-Bold');
    const leftRows = [
      ['Patient Name:', patient?.name || '—'],
      ['Patient ID:', patient?.patientId || '—'],
      ['Age / Gender:', `${patientAge(patient?.dateOfBirth)} / ${(patient?.gender || '—').toUpperCase()}`],
      ['Blood Group:', patient?.bloodGroup || '—'],
      ['Contact:', patient?.phone || '—'],
    ];
    const rightRows = [
      ['Appointment #:', appointment.appointmentNumber],
      ['Admission Date:', fmtDate(appointment.appointmentDate)],
      ['Discharge Date:', fmtDate(dischargeDate)],
      ['Attending Doctor:', `Dr. ${doctor?.name || '—'}`],
      ['Specialization:', doctor?.specialization || '—'],
    ];
    leftRows.forEach(([label, val]) => {
      doc.font('Helvetica-Bold').text(label, leftX, doc.y, { width: 110, continued: true });
      doc.font('Helvetica').text(val, { width: colW - 110 });
    });
    const afterLeft = doc.y;
    doc.y = startY;
    rightRows.forEach(([label, val]) => {
      doc.font('Helvetica-Bold').text(label, rightX, doc.y, { width: 110, continued: true });
      doc.font('Helvetica').text(val, { width: colW - 110 });
    });
    doc.y = Math.max(afterLeft, doc.y);
    doc.moveDown(0.5);
    drawHRule(doc);
    doc.moveDown(0.5);

    // Clinical sections helper
    const section = (title, content) => {
      if (!content) return;
      doc.fontSize(10).font('Helvetica-Bold').text(title, 50, doc.y, { width: 495 });
      doc.moveDown(0.1);
      doc.fontSize(9).font('Helvetica').text(content, 60, doc.y, { width: 480 });
      doc.moveDown(0.6);
    };

    section('Chief Complaint / Reason for Visit:', appointment.reason);
    section('Examination Findings:', appointment.examinationFindings);
    section('Diagnosis:', appointment.diagnosis);
    section('Treatment Given:', appointment.treatmentDone);

    // Medicines prescribed
    if (appointment.prescriptions?.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').text('Medicines Prescribed:', 50, doc.y, { width: 495 });
      doc.moveDown(0.2);
      // Table header
      const cols = [50, 220, 310, 390, 460];
      doc.fontSize(8).font('Helvetica-Bold');
      ['Medicine', 'Dosage', 'Duration', 'Qty', 'Instructions'].forEach((h, i) => {
        doc.text(h, cols[i], doc.y, { width: cols[i + 1] ? cols[i + 1] - cols[i] - 4 : 85 });
      });
      doc.moveDown(0.15);
      drawHRule(doc);
      doc.moveDown(0.15);
      appointment.prescriptions.forEach(p => {
        const med = p.medication;
        const rowY = doc.y;
        doc.fontSize(8).font('Helvetica');
        doc.text(med?.name || p.medicationName || '—', cols[0], rowY, { width: 165 });
        doc.text(p.frequency || '—', cols[1], rowY, { width: 85 });
        doc.text(p.duration || '—', cols[2], rowY, { width: 75 });
        doc.text(String(p.quantity || '—'), cols[3], rowY, { width: 65 });
        doc.text(p.instructions || '—', cols[4], rowY, { width: 85 });
        doc.moveDown(0.3);
      });
      doc.moveDown(0.3);
    }

    section('Advice / Discharge Instructions:', appointment.advice);

    if (appointment.treatmentPlan) {
      section('Follow-up Treatment Plan:', appointment.treatmentPlan);
    }

    if (dischargeNotes) {
      section('Additional Discharge Notes:', dischargeNotes);
    }

    // Follow-up and condition
    doc.moveDown(0.2);
    drawHRule(doc);
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Follow-up Date: `, 50, doc.y, { continued: true });
    doc.font('Helvetica').text(appointment.followUpDate ? fmtDate(appointment.followUpDate) : 'As needed');
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').text(`Condition at Discharge: `, 50, doc.y, { continued: true });
    doc.font('Helvetica').text(conditionAtDischarge);

    if (patient?.allergies) {
      doc.moveDown(0.2);
      doc.font('Helvetica-Bold').text(`Known Allergies: `, 50, doc.y, { continued: true });
      doc.font('Helvetica').text(patient.allergies);
    }

    drawFooter(doc, settings, true, appointment);
    doc.end();
  } catch (err) {
    console.error('Discharge summary PDF error:', err);
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
};
