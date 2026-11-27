import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import pool, { databaseConnectionOptions, databaseName } from './db.js';

const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));

function splitStatements(sql) {
  return sql.split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement
      && !/^CREATE\s+DATABASE\b/i.test(statement)
      && !/^USE\s+/i.test(statement));
}

async function ensureDatabaseExists() {
  try {
    const connection = await pool.getConnection();
    try {
      await connection.ping();
    } finally {
      connection.release();
    }
  } catch (error) {
    if (error.code !== 'ER_BAD_DB_ERROR') throw error;
    const serverConnection = await mysql.createConnection(databaseConnectionOptions);
    try {
      await serverConnection.query(
        'CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci',
        [databaseName]
      );
    } finally {
      await serverConnection.end();
    }
  }
}

export async function migrateDatabase() {
  if (!databaseName || databaseName.length > 64) {
    throw new Error('DB_NAME harus berisi nama database MySQL yang valid (maksimal 64 karakter).');
  }
  await ensureDatabaseExists();

  const connection = await pool.getConnection();
  let lockAcquired = false;
  try {
    const [lockRows] = await connection.query(
      "SELECT GET_LOCK('layanan-kesehatan-schema-migrations', 30) AS acquired"
    );
    if (Number(lockRows[0].acquired) !== 1) {
      throw new Error('Tidak berhasil memperoleh kunci migrasi database.');
    }
    lockAcquired = true;

    await connection.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (migration_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`
    );

    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((name) => /^\d+_.+\.sql$/.test(name))
      .sort();

    for (const migrationName of migrationFiles) {
      const [appliedRows] = await connection.execute(
        'SELECT migration_name FROM schema_migrations WHERE migration_name = ?',
        [migrationName]
      );
      if (appliedRows.length) continue;

      const sql = await readFile(new URL(`../migrations/${migrationName}`, import.meta.url), 'utf8');
      for (const statement of splitStatements(sql)) {
        await connection.query(statement);
      }
      await connection.execute(
        'INSERT INTO schema_migrations (migration_name) VALUES (?)',
        [migrationName]
      );
      console.log(`Migrasi database diterapkan: ${migrationName}`);
    }
  } finally {
    if (lockAcquired) {
      await connection.query("SELECT RELEASE_LOCK('layanan-kesehatan-schema-migrations')");
    }
    connection.release();
  }
}
