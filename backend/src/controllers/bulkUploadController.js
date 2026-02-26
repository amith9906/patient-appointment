const XLSX = require('xlsx');
const { Medication, Patient } = require('../models');

// ─── Medication template ───────────────────────────────────────────────────

const MED_HEADERS = [
  'name', 'genericName', 'composition', 'category', 'dosage', 'manufacturer',
  'description', 'sideEffects', 'contraindications', 'stockQuantity', 'unitPrice',
  'expiryDate', 'requiresPrescription', 'scheduleCategory', 'isRestrictedDrug',
];

const MED_SAMPLE = [
  {
    name: 'Paracetamol 500mg', genericName: 'Paracetamol',
    composition: 'Paracetamol 500mg', category: 'tablet', dosage: '500mg',
    manufacturer: 'Generic Pharma', description: 'Pain reliever and fever reducer',
    sideEffects: 'Nausea, stomach upset', contraindications: 'Liver disease',
    stockQuantity: 100, unitPrice: 2.50, expiryDate: '2026-12-31', requiresPrescription: 'no',
    scheduleCategory: 'otc', isRestrictedDrug: 'no',
  },
  {
    name: 'Amoxicillin 250mg', genericName: 'Amoxicillin',
    composition: 'Amoxicillin trihydrate 250mg', category: 'capsule', dosage: '250mg',
    manufacturer: 'MediCorp', description: 'Broad-spectrum antibiotic',
    sideEffects: 'Diarrhea, nausea, rash', contraindications: 'Penicillin allergy',
    stockQuantity: 50, unitPrice: 5.00, expiryDate: '2026-06-30', requiresPrescription: 'yes',
    scheduleCategory: 'otc', isRestrictedDrug: 'no',
  },
  {
    name: 'Metformin 500mg', genericName: 'Metformin HCl',
    composition: 'Metformin hydrochloride 500mg', category: 'tablet', dosage: '500mg',
    manufacturer: 'DiaPharma', description: 'Type 2 diabetes management',
    sideEffects: 'GI upset, metallic taste', contraindications: 'Renal impairment',
    stockQuantity: 200, unitPrice: 1.20, expiryDate: '2027-03-31', requiresPrescription: 'yes',
    scheduleCategory: 'otc', isRestrictedDrug: 'no',
  },
];

const MED_NOTES = [
  { Field: 'name', Required: 'YES', AllowedValues: '', Notes: 'Medication brand/trade name' },
  { Field: 'genericName', Required: 'no', AllowedValues: '', Notes: 'Generic / INN name' },
  { Field: 'composition', Required: 'no', AllowedValues: '', Notes: 'e.g. Paracetamol 500mg + Caffeine 65mg' },
  { Field: 'category', Required: 'no', AllowedValues: 'tablet | capsule | syrup | injection | cream | drops | inhaler | patch | suppository | other', Notes: 'Default: tablet' },
  { Field: 'dosage', Required: 'no', AllowedValues: '', Notes: 'e.g. 500mg, 10ml, 5mg/5ml' },
  { Field: 'manufacturer', Required: 'no', AllowedValues: '', Notes: 'Manufacturer company name' },
  { Field: 'description', Required: 'no', AllowedValues: '', Notes: 'Brief description of use' },
  { Field: 'sideEffects', Required: 'no', AllowedValues: '', Notes: 'Known side effects (comma-separated)' },
  { Field: 'contraindications', Required: 'no', AllowedValues: '', Notes: 'When NOT to use this medication' },
  { Field: 'stockQuantity', Required: 'no', AllowedValues: '', Notes: 'Integer. Default: 0' },
  { Field: 'unitPrice', Required: 'no', AllowedValues: '', Notes: 'Decimal. Default: 0' },
  { Field: 'expiryDate', Required: 'no', AllowedValues: '', Notes: 'YYYY-MM-DD format' },
  { Field: 'requiresPrescription', Required: 'no', AllowedValues: 'yes | no', Notes: 'Default: yes' },
  { Field: 'scheduleCategory', Required: 'no', AllowedValues: 'otc | schedule_h | schedule_h1', Notes: 'Regulatory schedule category (Default: otc)' },
  { Field: 'isRestrictedDrug', Required: 'no', AllowedValues: 'yes | no', Notes: 'If yes, prescriber details are required at sale. If scheduleCategory starts with schedule_h, this will be inferred.' },
];

// ─── Patient template ──────────────────────────────────────────────────────

const PAT_HEADERS = [
  'name', 'dateOfBirth', 'gender', 'bloodGroup', 'phone', 'email',
  'address', 'city', 'state', 'emergencyContactName', 'emergencyContactPhone',
  'allergies', 'medicalHistory', 'insuranceProvider', 'insuranceNumber',
];

const PAT_SAMPLE = [
  {
    name: 'Ravi Kumar', dateOfBirth: '1985-07-20', gender: 'male', bloodGroup: 'B+',
    phone: '9876543210', email: 'ravi@example.com', address: '12 MG Road',
    city: 'Bengaluru', state: 'Karnataka', emergencyContactName: 'Sunita Kumar',
    emergencyContactPhone: '9876543211', allergies: 'Penicillin',
    medicalHistory: 'Hypertension', insuranceProvider: 'Star Health', insuranceNumber: 'SH-00123',
  },
  {
    name: 'Priya Sharma', dateOfBirth: '1992-03-14', gender: 'female', bloodGroup: 'O+',
    phone: '9123456789', email: 'priya@example.com', address: '45 Indiranagar',
    city: 'Bengaluru', state: 'Karnataka', emergencyContactName: 'Ajay Sharma',
    emergencyContactPhone: '9123456780', allergies: '',
    medicalHistory: 'Type 2 Diabetes', insuranceProvider: 'HDFC Ergo', insuranceNumber: 'HE-00456',
  },
];

const PAT_NOTES = [
  { Field: 'name', Required: 'YES', AllowedValues: '', Notes: 'Full patient name' },
  { Field: 'dateOfBirth', Required: 'no', AllowedValues: '', Notes: 'YYYY-MM-DD format' },
  { Field: 'gender', Required: 'no', AllowedValues: 'male | female | other', Notes: 'Default: male' },
  { Field: 'bloodGroup', Required: 'no', AllowedValues: 'A+ | A- | B+ | B- | AB+ | AB- | O+ | O-', Notes: 'Leave blank if unknown' },
  { Field: 'phone', Required: 'no', AllowedValues: '', Notes: 'Primary contact number' },
  { Field: 'email', Required: 'no', AllowedValues: '', Notes: 'Valid email address' },
  { Field: 'address', Required: 'no', AllowedValues: '', Notes: 'Street / house address' },
  { Field: 'city', Required: 'no', AllowedValues: '', Notes: 'City name' },
  { Field: 'state', Required: 'no', AllowedValues: '', Notes: 'State name' },
  { Field: 'emergencyContactName', Required: 'no', AllowedValues: '', Notes: 'Emergency contact person' },
  { Field: 'emergencyContactPhone', Required: 'no', AllowedValues: '', Notes: 'Emergency contact phone' },
  { Field: 'allergies', Required: 'no', AllowedValues: '', Notes: 'Known drug/food allergies' },
  { Field: 'medicalHistory', Required: 'no', AllowedValues: '', Notes: 'Past diagnoses, surgeries, conditions' },
  { Field: 'insuranceProvider', Required: 'no', AllowedValues: '', Notes: 'Insurance company name' },
  { Field: 'insuranceNumber', Required: 'no', AllowedValues: '', Notes: 'Policy / member number' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildWorkbook(dataRows, headers, notesRows, sheetName) {
  const wb = XLSX.utils.book_new();
  const wsData = XLSX.utils.json_to_sheet(dataRows, { header: headers });
  XLSX.utils.book_append_sheet(wb, wsData, sheetName);
  const wsNotes = XLSX.utils.json_to_sheet(notesRows);
  XLSX.utils.book_append_sheet(wb, wsNotes, 'Instructions');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ─── Controllers ──────────────────────────────────────────────────────────

exports.downloadMedicationTemplate = (req, res) => {
  const buf = buildWorkbook(MED_SAMPLE, MED_HEADERS, MED_NOTES, 'Medications');
  res.setHeader('Content-Disposition', 'attachment; filename="medications_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
};

exports.downloadPatientTemplate = (req, res) => {
  const buf = buildWorkbook(PAT_SAMPLE, PAT_HEADERS, PAT_NOTES, 'Patients');
  res.setHeader('Content-Disposition', 'attachment; filename="patients_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
};

const VALID_CATS = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'patch', 'suppository', 'other'];
const VALID_GENDERS = ['male', 'female', 'other'];
const VALID_BG = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

exports.uploadMedications = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const { hospitalId } = req.body;

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rows.length) return res.status(400).json({ message: 'No data rows found in the file' });

    const results = { created: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2; // row 1 = headers, data starts at row 2

      if (!r.name || !String(r.name).trim()) {
        results.errors.push({ row: rowNum, error: '"name" is required' });
        continue;
      }

      const category = VALID_CATS.includes(String(r.category || '').toLowerCase())
        ? String(r.category).toLowerCase() : 'tablet';
      const requiresPrescription = String(r.requiresPrescription || '').toLowerCase() !== 'no';
      const scheduleCategory = r.scheduleCategory ? String(r.scheduleCategory).trim().toLowerCase() : 'otc';
      const isRestrictedFromCol = String(r.isRestrictedDrug || '').toLowerCase() === 'yes';
      const isRestrictedDrug = isRestrictedFromCol || (scheduleCategory && scheduleCategory.startsWith('schedule_h'));

      try {
        await Medication.create({
          name: String(r.name).trim(),
          genericName: r.genericName ? String(r.genericName).trim() : null,
          composition: r.composition ? String(r.composition).trim() : null,
          category,
          dosage: r.dosage ? String(r.dosage).trim() : null,
          manufacturer: r.manufacturer ? String(r.manufacturer).trim() : null,
          description: r.description ? String(r.description).trim() : null,
          sideEffects: r.sideEffects ? String(r.sideEffects).trim() : null,
          contraindications: r.contraindications ? String(r.contraindications).trim() : null,
          stockQuantity: parseInt(r.stockQuantity) || 0,
          unitPrice: parseFloat(r.unitPrice) || 0,
          expiryDate: r.expiryDate || null,
          requiresPrescription,
          scheduleCategory: scheduleCategory || null,
          isRestrictedDrug: Boolean(isRestrictedDrug),
          hospitalId: hospitalId || null,
        });
        results.created++;
      } catch (err) {
        results.errors.push({ row: rowNum, error: err.message });
      }
    }

    res.json({
      message: `Upload complete. ${results.created} medication(s) created, ${results.errors.length} error(s).`,
      created: results.created,
      errors: results.errors,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.uploadPatients = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const { hospitalId } = req.body;
    if (!hospitalId) return res.status(400).json({ message: 'hospitalId is required' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rows.length) return res.status(400).json({ message: 'No data rows found in the file' });

    const results = { created: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2;

      if (!r.name || !String(r.name).trim()) {
        results.errors.push({ row: rowNum, error: '"name" is required' });
        continue;
      }

      const gender = VALID_GENDERS.includes(String(r.gender || '').toLowerCase())
        ? String(r.gender).toLowerCase() : 'male';
      const bloodGroup = VALID_BG.includes(String(r.bloodGroup || '')) ? String(r.bloodGroup) : null;

      try {
        await Patient.create({
          name: String(r.name).trim(),
          dateOfBirth: r.dateOfBirth || null,
          gender,
          bloodGroup,
          phone: r.phone ? String(r.phone).trim() : null,
          email: r.email ? String(r.email).trim() : null,
          address: r.address ? String(r.address).trim() : null,
          city: r.city ? String(r.city).trim() : null,
          state: r.state ? String(r.state).trim() : null,
          emergencyContactName: r.emergencyContactName ? String(r.emergencyContactName).trim() : null,
          emergencyContactPhone: r.emergencyContactPhone ? String(r.emergencyContactPhone).trim() : null,
          allergies: r.allergies ? String(r.allergies).trim() : null,
          medicalHistory: r.medicalHistory ? String(r.medicalHistory).trim() : null,
          insuranceProvider: r.insuranceProvider ? String(r.insuranceProvider).trim() : null,
          insuranceNumber: r.insuranceNumber ? String(r.insuranceNumber).trim() : null,
          hospitalId,
        });
        results.created++;
      } catch (err) {
        results.errors.push({ row: rowNum, error: err.message });
      }
    }

    res.json({
      message: `Upload complete. ${results.created} patient(s) created, ${results.errors.length} error(s).`,
      created: results.created,
      errors: results.errors,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
