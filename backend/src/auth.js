import jwt from 'jsonwebtoken';

export function requireAdmin(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Silakan masuk sebagai admin.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') {
      return res.status(403).json({ message: 'Akses hanya untuk admin.' });
    }
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Sesi tidak valid atau telah berakhir.' });
  }
}
