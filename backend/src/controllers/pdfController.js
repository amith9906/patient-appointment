const PDFDocument = require('pdfkit');
const { Appointment, Doctor, Patient, Hospital, HospitalSettings, Prescription, Medication, LabTest, Lab } = require('../models');

// ─── Shared defaults ────────────────────────────────────────────────────────
const DEFAULTS = {
  receiptFooter: 'Thank you for choosing our hospital. Get well soon!',
  currency: '₹', showLogoOnReceipt: true, showGSTINOnReceipt: true, showDoctorOnReceipt: true,
};

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
        if (p.instructions) {
          doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#92400e')
             .text(`       Note: ${p.instructions}`, L, doc.y, { width: W });
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

    // Totals
    const gst = subtotal * 0.18;
    const total = subtotal + gst;

    doc.moveDown(0.3);
    drawHRule(doc);
    doc.moveDown(0.3);

    const totals = [
      ['Subtotal', fmtMoney(subtotal, currency)],
      ['GST (18%)', fmtMoney(gst, currency)],
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
