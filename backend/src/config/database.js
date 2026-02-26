const { Sequelize } = require('sequelize');
require('dotenv').config();

if (process.env.NODE_ENV === 'test') {
  // Use in-memory sqlite for tests
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });
  module.exports = sequelize;
} else {
  const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';

  const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      ...(useSsl
        ? {
            dialectOptions: {
              ssl: {
                require: true,
                rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true',
              },
            },
          }
        : {}),
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    }
  );

  module.exports = sequelize;
}
