require('dotenv').config();
const { sequelize } = require('../models');

async function syncDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    await sequelize.sync();  // creates missing tables only, never alters existing ones
    console.log('All models were synchronized successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Unable to connect to database:', error);
    process.exit(1);
  }
}

syncDatabase();
