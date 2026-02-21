require('dotenv').config();

const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';

const baseConfig = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  dialect: 'postgres',
  logging: false,
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
};

module.exports = {
  development: {
    ...baseConfig,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  },
  test: {
    ...baseConfig,
    database: process.env.DB_NAME_TEST || process.env.DB_NAME,
  },
  production: {
    ...baseConfig,
  },
};
