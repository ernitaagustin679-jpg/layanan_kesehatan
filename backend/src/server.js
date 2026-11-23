import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import pool from './db.js';
import { requireAdmin } from './auth.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const facilityStatuses = ['Aktif', 'Tidak Aktif', 'Perlu Verifikasi'];
const facilitySchema = z.object({
  facility_name: z.string().trim().min(2).max(150),
  facility_type: z.string().trim().min(2).max(50),
  address: z.string().trim().min(3),
  phone_number: z.string().trim().max(20).nullable().optional(),
  status: z.enum(facilityStatuses),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180)
});
const serviceListSchema = z.array(z.object({
  service_name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(5000).nullable().optional()
})).max(50);
const hourListSchema = z.array(z.object({
  day_of_week: z.number().int().min(1).max(7),
  slot_number: z.number().int().min(1).max(4),
  opens_at: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  closes_at: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  is_closed: z.boolean()
})).max(28);
const exceptionSchema = z.object({
  exception_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const parsed = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
  }, 'Tanggal tidak valid.'),
  slot_number: z.number().int().min(1).max(4).default(1),
  opens_at: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  closes_at: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  is_closed: z.boolean(),
  note: z.string().trim().max(255).nullable().optional()
});

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

function parseOrThrow(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const error = new Error(result.error.issues.map((issue) => issue.message).join(' '));
    error.status = 400;
    throw error;
  }
  return result.data;
}

async function getFacility(id) {
  const [rows] = await pool.execute(
    `SELECT facility_id, facility_name, facility_type, address, phone_number, status,
            created_at, ST_Y(location) AS latitude, ST_X(location) AS longitude
     FROM health_facilities WHERE facility_id = ?`,
    [id]
  );
  if (!rows.length) return null;

  const [services] = await pool.execute(
    'SELECT service_id, service_name, description FROM facility_services WHERE facility_id = ? ORDER BY service_id',
    [id]
  );
  const [hours] = await pool.execute(
    `SELECT operating_hour_id, day_of_week, slot_number, TIME_FORMAT(opens_at, '%H:%i') AS opens_at,
            TIME_FORMAT(closes_at, '%H:%i') AS closes_at, is_closed
     FROM facility_operating_hours WHERE facility_id = ? ORDER BY day_of_week, slot_number`,
    [id]
  );
  const [exceptions] = await pool.execute(
    `SELECT exception_id, DATE_FORMAT(exception_date, '%Y-%m-%d') AS exception_date, slot_number,
            TIME_FORMAT(opens_at, '%H:%i') AS opens_at, TIME_FORMAT(closes_at, '%H:%i') AS closes_at,
            is_closed, note
     FROM facility_operating_exceptions
     WHERE facility_id = ? AND exception_date >= CURRENT_DATE()
     ORDER BY exception_date, slot_number LIMIT 60`,
    [id]
  );
  return { ...rows[0], services, hours, exceptions };
}

app.get('/api/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const body = parseOrThrow(z.object({
      email: z.string().trim().email(),
      password: z.string().min(1)
    }), req.body);
    const [users] = await pool.execute(
      "SELECT user_id, full_name, email, password_hash, role FROM users WHERE email = ? AND role = 'admin' LIMIT 1",
      [body.email]
    );
    if (!users.length || !(await bcrypt.compare(body.password, users[0].password_hash))) {
      return res.status(401).json({ message: 'Email atau kata sandi admin salah.' });
    }
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET harus diatur dengan nilai acak minimal 32 karakter.');
    }
    const user = users[0];
    const token = jwt.sign(
      { sub: user.user_id, role: user.role, name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, user: { id: user.user_id, name: user.full_name, email: user.email } });
  } catch (error) {
    next(error);
  }
});

app.get('/api/facilities', async (req, res, next) => {
  try {
    const conditions = [];
    const params = [];
    if (req.query.q) {
      conditions.push('(f.facility_name LIKE ? OR f.address LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`);
    }
    if (req.query.type) {
      conditions.push('f.facility_type = ?');
      params.push(req.query.type);
    }
    if (facilityStatuses.includes(req.query.status)) {
      conditions.push('f.status = ?');
      params.push(req.query.status);
    }
    if (req.query.service) {
      conditions.push('EXISTS (SELECT 1 FROM facility_services fs WHERE fs.facility_id = f.facility_id AND fs.service_name LIKE ?)');
      params.push(`%${req.query.service}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.execute(
      `SELECT f.facility_id, f.facility_name, f.facility_type, f.address, f.phone_number,
              f.status, ST_Y(f.location) AS latitude, ST_X(f.location) AS longitude
       FROM health_facilities f ${where} ORDER BY f.facility_name LIMIT 200`,
      params
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/facilities/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'ID fasilitas tidak valid.' });
    const facility = await getFacility(id);
    if (!facility) return res.status(404).json({ message: 'Fasilitas tidak ditemukan.' });
    res.json(facility);
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/facilities', requireAdmin, async (req, res, next) => {
  try {
    const body = parseOrThrow(facilitySchema, req.body);
    const [result] = await pool.execute(
      `INSERT INTO health_facilities
       (facility_name, facility_type, address, phone_number, status, location)
       VALUES (?, ?, ?, ?, ?, ST_SRID(POINT(?, ?), 4326))`,
      [body.facility_name, body.facility_type, body.address, body.phone_number || null,
        body.status, body.longitude, body.latitude]
    );
    res.status(201).json(await getFacility(result.insertId));
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/facilities/:id', requireAdmin, async (req, res, next) => {
  try {
    const body = parseOrThrow(facilitySchema, req.body);
    const [result] = await pool.execute(
      `UPDATE health_facilities
       SET facility_name = ?, facility_type = ?, address = ?, phone_number = ?, status = ?,
           location = ST_SRID(POINT(?, ?), 4326)
       WHERE facility_id = ?`,
      [body.facility_name, body.facility_type, body.address, body.phone_number || null,
        body.status, body.longitude, body.latitude, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Fasilitas tidak ditemukan.' });
    res.json(await getFacility(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/facilities/:id', requireAdmin, async (req, res, next) => {
  try {
    const [result] = await pool.execute('DELETE FROM health_facilities WHERE facility_id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Fasilitas tidak ditemukan.' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/facilities/:id/services', requireAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const services = parseOrThrow(serviceListSchema, req.body);
    await connection.beginTransaction();
    const [facility] = await connection.execute('SELECT facility_id FROM health_facilities WHERE facility_id = ?', [req.params.id]);
    if (!facility.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Fasilitas tidak ditemukan.' });
    }
    await connection.execute('DELETE FROM facility_services WHERE facility_id = ?', [req.params.id]);
    for (const service of services) {
      await connection.execute(
        'INSERT INTO facility_services (facility_id, service_name, description) VALUES (?, ?, ?)',
        [req.params.id, service.service_name, service.description || null]
      );
    }
    await connection.commit();
    res.json(await getFacility(req.params.id));
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.put('/api/admin/facilities/:id/hours', requireAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const hours = parseOrThrow(hourListSchema, req.body);
    const keys = new Set(hours.map((hour) => `${hour.day_of_week}-${hour.slot_number}`));
    if (keys.size !== hours.length || hours.some((hour) => !hour.is_closed && (!hour.opens_at || !hour.closes_at))) {
      return res.status(400).json({ message: 'Jadwal harus unik per hari/sesi dan jam buka-tutup harus lengkap.' });
    }
    await connection.beginTransaction();
    const [facility] = await connection.execute('SELECT facility_id FROM health_facilities WHERE facility_id = ?', [req.params.id]);
    if (!facility.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Fasilitas tidak ditemukan.' });
    }
    await connection.execute('DELETE FROM facility_operating_hours WHERE facility_id = ?', [req.params.id]);
    for (const hour of hours) {
      await connection.execute(
        `INSERT INTO facility_operating_hours
         (facility_id, day_of_week, slot_number, opens_at, closes_at, is_closed)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.params.id, hour.day_of_week, hour.slot_number,
          hour.is_closed ? null : hour.opens_at, hour.is_closed ? null : hour.closes_at, hour.is_closed]
      );
    }
    await connection.commit();
    res.json(await getFacility(req.params.id));
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.post('/api/admin/facilities/:id/exceptions', requireAdmin, async (req, res, next) => {
  try {
    const exception = parseOrThrow(exceptionSchema, req.body);
    if (!exception.is_closed && (!exception.opens_at || !exception.closes_at)) {
      return res.status(400).json({ message: 'Jam buka dan tutup wajib diisi untuk jam khusus.' });
    }
    const [facility] = await pool.execute('SELECT facility_id FROM health_facilities WHERE facility_id = ?', [req.params.id]);
    if (!facility.length) return res.status(404).json({ message: 'Fasilitas tidak ditemukan.' });
    await pool.execute(
      `INSERT INTO facility_operating_exceptions
       (facility_id, exception_date, slot_number, opens_at, closes_at, is_closed, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE opens_at = VALUES(opens_at), closes_at = VALUES(closes_at),
         is_closed = VALUES(is_closed), note = VALUES(note)`,
      [req.params.id, exception.exception_date, exception.slot_number,
        exception.is_closed ? null : exception.opens_at, exception.is_closed ? null : exception.closes_at,
        exception.is_closed, exception.note || null]
    );
    res.status(201).json(await getFacility(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/facilities/:id/exceptions/:exceptionId', requireAdmin, async (req, res, next) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM facility_operating_exceptions WHERE exception_id = ? AND facility_id = ?',
      [req.params.exceptionId, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Jadwal khusus tidak ditemukan.' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((_req, res) => res.status(404).json({ message: 'Rute tidak ditemukan.' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'Data bertabrakan dengan data yang sudah ada.' });
  }
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ message: 'Fasilitas yang dipilih tidak ditemukan.' });
  }
  res.status(error.status || 500).json({
    message: error.status ? error.message : 'Terjadi kesalahan pada server.'
  });
});

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET belum disetel atau kurang dari 32 karakter. Periksa file .env.');
  process.exit(1);
}

app.listen(port, () => console.log(`API berjalan di http://localhost:${port}`));
