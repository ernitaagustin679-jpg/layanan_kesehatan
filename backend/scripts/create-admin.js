import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../src/db.js';
import { migrateDatabase } from '../src/migrate.js';

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  console.error('Atur ADMIN_NAME, ADMIN_EMAIL, dan ADMIN_PASSWORD (minimal 12 karakter) di .env.');
  process.exitCode = 1;
} else {
  try {
    await migrateDatabase();
    const [existing] = await pool.execute(
      'SELECT user_id FROM users WHERE email = ? LIMIT 1',
      [ADMIN_EMAIL]
    );
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    if (existing.length) {
      await pool.execute(
        'UPDATE users SET full_name = ?, password_hash = ?, role = ? WHERE user_id = ?',
        [ADMIN_NAME, passwordHash, 'admin', existing[0].user_id]
      );
      console.log(`Akun admin ${ADMIN_EMAIL} diperbarui.`);
    } else {
      await pool.execute(
        'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [ADMIN_NAME, ADMIN_EMAIL, passwordHash, 'admin']
      );
      console.log(`Akun admin ${ADMIN_EMAIL} dibuat.`);
    }
  } catch (error) {
    console.error('Gagal membuat akun admin:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
