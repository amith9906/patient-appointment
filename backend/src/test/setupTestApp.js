const express = require('express');
const path = require('path');
const { sequelize } = require('../models');

// build app similar to src/app.js but without starting server
function buildApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

  // mount routes (same as app.js)
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/hospitals', require('../routes/hospitals'));
  app.use('/api/departments', require('../routes/departments'));
  app.use('/api/doctors', require('../routes/doctors'));
  app.use('/api/patients', require('../routes/patients'));
  app.use('/api/appointments', require('../routes/appointments'));
  app.use('/api/medications', require('../routes/medications'));
  app.use('/api/labs', require('../routes/labs'));
  app.use('/api/reports', require('../routes/reports'));
  app.use('/api/users', require('../routes/users'));
  app.use('/api/prescriptions', require('../routes/prescriptions'));
  app.use('/api/pdf', require('../routes/pdf'));
  app.use('/api/bulk', require('../routes/bulk'));
  app.use('/api/expenses', require('../routes/expenses'));
  app.use('/api/medicine-invoices', require('../routes/medicineInvoices'));
  app.use('/api/vendors', require('../routes/vendors'));
  app.use('/api/stock-purchases', require('../routes/stockPurchases'));
  app.use('/api/corporates', require('../routes/corporates'));
  app.use('/api/packages', require('../routes/packages'));
  app.use('/api/lab-report-templates', require('../routes/labReportTemplates'));
  app.use('/api/doctor-leaves', require('../routes/doctorLeaves'));
  app.use('/api/treatment-plans', require('../routes/treatmentPlans'));
  app.use('/api/ipd', require('../routes/ipd'));
  app.use('/api/ot', require('../routes/ot'));
  app.use('/api/nurses', require('../routes/nurses'));
  app.use('/api/shifts', require('../routes/shifts'));
  app.use('/api/nurse-leaves', require('../routes/nurseLeaves'));
  app.use('/api/vitals', require('../routes/vitals'));
  app.use('/api/medication-administration', require('../routes/medicationAdministration'));
  app.use('/api/nurse-handovers', require('../routes/nurseHandovers'));
  app.use('/api/fluid-balance', require('../routes/fluidBalance'));
  app.use('/api/search', require('../routes/search'));
  app.use('/api/clinical-notes', require('../routes/clinicalNotes'));
  app.use('/api/vaccinations', require('../routes/vaccinations'));

  // Enterprise Phase Routes
  app.use('/fhir', require('../routes/fhir'));
  app.use('/api/cdss', require('../routes/cdss'));
  app.use('/api/search', require('../routes/globalSearch'));
  app.use('/api/mdm', require('../routes/mdm'));
  app.use('/api/observability', require('../routes/observability'));

  // health

  app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

  return app;
}

async function initTestDatabase() {
  await sequelize.sync({ force: true });
}

module.exports = { buildApp, initTestDatabase };
