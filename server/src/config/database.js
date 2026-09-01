import { Sequelize } from 'sequelize';

// Railway / Render menyediakan DATABASE_URL, prioritas utama
const databaseUrl = process.env.DATABASE_URL;

const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: process.env.DB_SSL === 'false' ? false : { require: true, rejectUnauthorized: false }
      },
      logging: process.env.DB_LOGGING === 'true' ? console.log : false,
      pool: {
        max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    })
  : new Sequelize(
      process.env.DB_NAME || process.env.DB_DATABASE || 'lex_integrity',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASSWORD || 'postgres',
      {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        dialect: 'postgres',
        logging: process.env.DB_LOGGING === 'true' ? console.log : false,
        pool: {
          max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      }
    );

export { sequelize };
export default sequelize;
