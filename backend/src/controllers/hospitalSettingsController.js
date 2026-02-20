const { HospitalSettings, Hospital } = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

const DEFAULTS = {
  gstin: '', pan: '', regNumber: '', tagline: '',
  phone: '', altPhone: '', website: '',
  doctorName: '', doctorQualification: '', doctorRegNumber: '', doctorSpecialization: '',
  receiptHeader: '', receiptFooter: 'Thank you for choosing our hospital. Get well soon!',
  currency: '₹', dateFormat: 'DD/MM/YYYY', timezone: 'Asia/Kolkata',
  showLogoOnReceipt: true, showGSTINOnReceipt: true, showDoctorOnReceipt: true,
  appointmentSlotDuration: 30, workingHoursFrom: '09:00', workingHoursTo: '18:00',
};

exports.getSettings = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;
    if (!isSuperAdmin(req.user) && req.params.id !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital' });
    }

    const hospital = await Hospital.findByPk(req.params.id);
    if (!hospital) return res.status(404).json({ message: 'Hospital not found' });

    const [settings] = await HospitalSettings.findOrCreate({
      where: { hospitalId: req.params.id },
      defaults: { ...DEFAULTS, hospitalId: req.params.id },
    });
    res.json(settings);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateSettings = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;
    if (!isSuperAdmin(req.user) && req.params.id !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital' });
    }

    const hospital = await Hospital.findByPk(req.params.id);
    if (!hospital) return res.status(404).json({ message: 'Hospital not found' });

    const allowed = [
      'gstin','pan','regNumber','tagline','phone','altPhone','website',
      'doctorName','doctorQualification','doctorRegNumber','doctorSpecialization',
      'receiptHeader','receiptFooter','currency','dateFormat','timezone',
      'showLogoOnReceipt','showGSTINOnReceipt','showDoctorOnReceipt',
      'appointmentSlotDuration','workingHoursFrom','workingHoursTo',
    ];
    const data = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k]; });

    const [settings, created] = await HospitalSettings.findOrCreate({
      where: { hospitalId: req.params.id },
      defaults: { ...DEFAULTS, ...data, hospitalId: req.params.id },
    });
    if (!created) await settings.update(data);

    res.json(settings);
  } catch (err) { res.status(400).json({ message: err.message }); }
};
