import jwt from 'jsonwebtoken';
import pool from './db.js';

export async function requireAdmin(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Silakan masuk sebagai admin.' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Sesi tidak valid atau telah berakhir.' });
  }

  if (payload.role !== 'admin') return res.status(403).json({ message: 'Akses hanya untuk admin.' });

  try {
    const [users] = await pool.execute(
      "SELECT user_id FROM users WHERE user_id = ? AND role = 'admin' LIMIT 1",
      [payload.sub]
    );
    if (!users.length) return res.status(401).json({ message: 'Sesi admin sudah tidak aktif.' });
    req.admin = payload;
    next();
  } catch (error) {
    next(error);
  }
}
