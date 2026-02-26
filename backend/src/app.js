require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');
const notificationService = require('./utils/notificationService');

const app = express();

// Middleware
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/hospitals', require('./routes/hospitals'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/medications', require('./routes/medications'));
app.use('/api/labs', require('./routes/labs'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/pdf', require('./routes/pdf'));
app.use('/api/bulk', require('./routes/bulk'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/medicine-invoices', require('./routes/medicineInvoices'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/stock-purchases', require('./routes/stockPurchases'));
app.use('/api/corporates', require('./routes/corporates'));
app.use('/api/packages', require('./routes/packages'));
app.use('/api/lab-report-templates', require('./routes/labReportTemplates'));
app.use('/api/doctor-leaves', require('./routes/doctorLeaves'));
app.use('/api/treatment-plans', require('./routes/treatmentPlans'));
app.use('/api/ipd', require('./routes/ipd'));
app.use('/api/ot', require('./routes/ot'));
app.use('/api/nurses', require('./routes/nurses'));
app.use('/api/shifts', require('./routes/shifts'));
app.use('/api/nurse-leaves', require('./routes/nurseLeaves'));
app.use('/api/vitals', require('./routes/vitals'));
app.use('/api/medication-administration', require('./routes/medicationAdministration'));
app.use('/api/nurse-handovers', require('./routes/nurseHandovers'));
app.use('/api/fluid-balance', require('./routes/fluidBalance'));
app.use('/api/search', require('./routes/search'));
app.use('/api/clinical-notes', require('./routes/clinicalNotes'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    const shouldAutoSync = process.env.NODE_ENV !== 'production'
      && String(process.env.DB_AUTO_SYNC_ON_START || 'false').toLowerCase() === 'true';

    if (shouldAutoSync) {
      await sequelize.sync();
      console.log('Models synced (auto-sync enabled).');
    } else {
      console.log('Auto-sync disabled. Run migrations to apply schema changes.');
    }

    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

    if (process.env.NODE_ENV !== 'test') {
      const runExpiryCheck = async () => {
        try {
          await notificationService.notifyExpiringMedications();
        } catch (err) {
          console.error('Expiry notification job failed:', err);
        }
      };
      runExpiryCheck();
      const intervalMs = 6 * 60 * 60 * 1000; // every 6 hours
      setInterval(runExpiryCheck, intervalMs);
    }
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

start();
