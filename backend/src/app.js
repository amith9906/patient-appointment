require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');

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
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

start();
