require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');
const notificationService = require('./utils/notificationService');

const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();

// Response Compression (Gzip/Brotli) for high throughput & fast UI loading
// app.use(compression());

// Performance Request Execution Timing Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 200 && process.env.NODE_ENV !== 'test') {
      console.warn(`[SLOW API WARN] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Rate limiting protection against abuse / DOS
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 10000 : 1000, // 1000 requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again later.' },
});

app.use('/api', apiLimiter);

// Middleware
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001')
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Public unauthenticated routes
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api/patient-portal', require('./routes/patientPortal'));

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
app.use('/api/vaccinations', require('./routes/vaccinations'));
app.use('/api/referrals', require('./routes/referrals'));

// Enterprise Phase Routes
app.use('/fhir', require('./routes/fhir'));
app.use('/api/cdss', require('./routes/cdss'));
app.use('/api/search', require('./routes/globalSearch'));
app.use('/api/mdm', require('./routes/mdm'));
app.use('/api/observability', require('./routes/observability'));


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
      await sequelize.sync({ alter: true });
      console.log('Models synced (auto-sync enabled).');
    } else {
      console.log('Auto-sync disabled. Run migrations to apply schema changes.');
    }

    try {
      if (sequelize.getDialect() === 'postgres') {
        await sequelize.query('ALTER TABLE "Doctors" ALTER COLUMN "signatureUrl" TYPE TEXT;');
        await sequelize.query('ALTER TABLE "HospitalSettings" ADD COLUMN IF NOT EXISTS "doctorSignatureUrl" TEXT;');
      }
    } catch (schemaErr) {
      console.log('Startup schema patch note:', schemaErr.message);
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
