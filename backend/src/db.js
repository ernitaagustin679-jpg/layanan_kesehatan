import mysql from 'mysql2/promise';

export const databaseName = process.env.DB_NAME || 'bpjs_kesehatan';
export const databaseConnectionOptions = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || ''
};

const pool = mysql.createPool({
  ...databaseConnectionOptions,
  database: databaseName,
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true
});

export default pool;
