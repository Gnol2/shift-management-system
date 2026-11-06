import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { readAll, writeAll, withLock, Row } from './db';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-only-secret-change-me';
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24)) {
  console.error('JWT_SECRET must be set (>= 24 chars) in production'); process.exit(1);
}
const MAX_USERS = 2;

class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }
const h = (fn: (req: any, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });
const pub = ({ passwordHash, ...u }: Row) => ({ ...u, active: u.active === true || u.active === 'TRUE' });
const isActive = (u: Row) => u.active === true || u.active === 'TRUE';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => !isNaN(Date.parse(d)), 'Invalid date');
const pad = (n: number) => String(n).padStart(2, '0');

// ---- seed ----
async function seed() {
  await withLock(async () => {
    const users = await readAll('Users');
    if (users.length) return;
    const now = new Date().toISOString();
    await writeAll('Users', [
      { id: randomUUID(), name: 'Admin', email: 'admin@shift.local', passwordHash: await bcrypt.hash('Admin@123', 10), role: 'admin', active: true, createdAt: now },
      { id: randomUUID(), name: 'Demo User', email: 'user@shift.local', passwordHash: await bcrypt.hash('User@123', 10), role: 'user', active: true, createdAt: now },
    ]);
    await readAll('Shifts'); await readAll('Registrations');
  });
}

// ---- shifts: 12 x 2h per day, generated on demand ----
async function ensureShifts(date: string) {
  await withLock(async () => {
    const shifts = await readAll('Shifts');
    if (shifts.some((s) => s.date === date)) return;
    for (let i = 0; i < 12; i++) {
      shifts.push({ id: `${date}_${pad(i * 2)}00`, date, startTime: `${pad(i * 2)}:00`, endTime: i === 11 ? '24:00' : `${pad(i * 2 + 2)}:00`, maxUsers: MAX_USERS, createdAt: new Date().toISOString() });
    }
    await writeAll('Shifts', shifts);
  });
}

async function shiftsForDate(date: string) {
  await ensureShifts(date);
  const [shifts, regs, users] = await Promise.all([readAll('Shifts'), readAll('Registrations'), readAll('Users')]);
  const name = new Map(users.map((u) => [u.id, u.name]));
  return shifts.filter((s) => s.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime)).map((s) => {
    const r = regs.filter((x) => x.shiftId === s.id);
    return { ...s, registrations: r.map((x) => ({ id: x.id, userId: x.userId, name: name.get(x.userId) })), count: r.length, available: Number(s.maxUsers) - r.length };
  });
}

// ---- auth middleware ----
const adminOnly = (req: any, _res: Response, next: NextFunction) =>
  req.user?.role === 'admin' ? next() : next(new HttpError(403, 'Admin access required'));
const authAsync = (req: any, res: Response, next: NextFunction) => {
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  let payload: any;
  try { payload = jwt.verify(token, JWT_SECRET); } catch { return next(new HttpError(401, 'Unauthorized')); }
  readAll('Users').then((users) => {
    const u = users.find((x) => x.id === payload.sub);
    if (!u || !isActive(u)) return next(new HttpError(401, 'Unauthorized'));
    req.user = u; next();
  }).catch(next);
};

// ---- app ----
const app = express();
app.set('trust proxy', 1); // behind Render's proxy (needed for rate limiting)
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true });

app.post('/api/auth/login', loginLimiter, h(async (req, res) => {
  const { identifier, password } = z.object({ identifier: z.string().trim().min(1), password: z.string().min(1) }).parse(req.body);
  const key = identifier.toLowerCase();
  const all = await readAll('Users');
  const byName = all.filter((u) => String(u.name).trim().toLowerCase() === key);
  const user = all.find((u) => String(u.email).toLowerCase() === key) ?? (byName.length === 1 ? byName[0] : undefined);
  if (!user || !isActive(user) || !(await bcrypt.compare(password, String(user.passwordHash)))) throw new HttpError(401, 'Invalid credentials');
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  ok(res, { token, user: pub(user) });
}));
const registerLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: true });
app.post('/api/auth/register', registerLimiter, h(async (req, res) => {
  const b = z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50).regex(/^[^@]+$/, 'Name cannot contain @'),
    email: z.union([z.literal(''), z.string().trim().email('Email is not valid')]).optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  }).parse(req.body);
  const email = b.email ?? '';
  const hash = await bcrypt.hash(b.password, 10);
  const row = await withLock(async () => {
    const users = await readAll('Users');
    if (users.some((u) => String(u.name).trim().toLowerCase() === b.name.toLowerCase())) throw new HttpError(409, 'Name already exists');
    if (email && users.some((u) => String(u.email).toLowerCase() === email.toLowerCase())) throw new HttpError(409, 'Email already exists');
    const r = { id: randomUUID(), name: b.name, email, passwordHash: hash, role: 'user', active: true, createdAt: new Date().toISOString() };
    users.push(r); await writeAll('Users', users); return r;
  });
  const token = jwt.sign({ sub: row.id, role: row.role }, JWT_SECRET, { expiresIn: '8h' });
  ok(res, { token, user: pub(row) }, 201);
}));
app.post('/api/auth/logout', authAsync, (_req, res) => ok(res, null)); // stateless JWT: client discards token
app.get('/api/auth/me', authAsync, (req: any, res) => ok(res, pub(req.user)));

app.get('/api/shifts', authAsync, h(async (req, res) => ok(res, await shiftsForDate(dateSchema.parse(req.query.date)))));

app.post('/api/shifts/:id/register', authAsync, h(async (req, res) => {
  const uid = req.user.id; const id = req.params.id;
  const reg = await withLock(async () => {
    const shift = (await readAll('Shifts')).find((s) => s.id === id);
    if (!shift) throw new HttpError(404, 'Shift not found');
    const regs = await readAll('Registrations');
    const here = regs.filter((r) => r.shiftId === id);
    if (here.some((r) => r.userId === uid)) throw new HttpError(409, 'Already registered for this shift');
    if (here.length >= Number(shift.maxUsers)) throw new HttpError(409, 'Shift is full');
    const row = { id: randomUUID(), shiftId: id, userId: uid, createdAt: new Date().toISOString() };
    regs.push(row); await writeAll('Registrations', regs);
    return row;
  });
  ok(res, reg, 201);
}));

app.delete('/api/shifts/:id/register', authAsync, h(async (req, res) => {
  await withLock(async () => {
    const regs = await readAll('Registrations');
    const left = regs.filter((r) => !(r.shiftId === req.params.id && r.userId === req.user.id));
    if (left.length === regs.length) throw new HttpError(404, 'Registration not found');
    await writeAll('Registrations', left);
  });
  ok(res, null);
}));

app.get('/api/registrations/mine', authAsync, h(async (req, res) => {
  const [regs, shifts, users] = await Promise.all([readAll('Registrations'), readAll('Shifts'), readAll('Users')]);
  const mine = regs.filter((r) => r.userId === req.user.id);
  ok(res, mine.map((r) => {
    const s = shifts.find((x) => x.id === r.shiftId)!;
    const coworkers = regs.filter((x) => x.shiftId === r.shiftId && x.userId !== req.user.id).map((x) => users.find((u) => u.id === x.userId)?.name);
    return { registrationId: r.id, shiftId: r.shiftId, date: s?.date, startTime: s?.startTime, endTime: s?.endTime, coworkers };
  }).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)));
}));

// ---- admin ----
const admin = express.Router();
admin.use(authAsync, adminOnly);

admin.get('/users', h(async (req, res) => {
  const q = String(req.query.q ?? '').toLowerCase();
  ok(res, (await readAll('Users')).filter((u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q)).map(pub));
}));
const userBody = z.object({ name: z.string().min(1).max(100), email: z.string().email(), password: z.string().min(8), role: z.enum(['admin', 'user']) });
admin.post('/users', h(async (req, res) => {
  const b = userBody.parse(req.body);
  const hash = await bcrypt.hash(b.password, 10);
  const row = await withLock(async () => {
    const users = await readAll('Users');
    if (users.some((u) => String(u.email).toLowerCase() === b.email.toLowerCase())) throw new HttpError(409, 'Email already exists');
    if (users.some((u) => String(u.name).trim().toLowerCase() === b.name.trim().toLowerCase())) throw new HttpError(409, 'Name already exists');
    const r = { id: randomUUID(), name: b.name, email: b.email, passwordHash: hash, role: b.role, active: true, createdAt: new Date().toISOString() };
    users.push(r); await writeAll('Users', users); return r;
  });
  ok(res, pub(row), 201);
}));
admin.patch('/users/:id', h(async (req, res) => {
  const b = userBody.partial().extend({ active: z.boolean().optional() }).parse(req.body);
  const hash = b.password ? await bcrypt.hash(b.password, 10) : undefined;
  const row = await withLock(async () => {
    const users = await readAll('Users');
    const u = users.find((x) => x.id === req.params.id);
    if (!u) throw new HttpError(404, 'User not found');
    if (b.name && users.some((x) => x.id !== u.id && String(x.name).trim().toLowerCase() === b.name!.trim().toLowerCase())) throw new HttpError(409, 'Name already exists');
    if (req.params.id === req.user.id && (b.active === false || (b.role && b.role !== 'admin'))) throw new HttpError(400, 'You cannot demote or deactivate yourself');
    if (b.name) u.name = b.name; if (b.email) u.email = b.email; if (b.role) u.role = b.role;
    if (b.active !== undefined) u.active = b.active; if (hash) u.passwordHash = hash;
    await writeAll('Users', users); return u;
  });
  ok(res, pub(row));
}));

admin.get('/registrations', h(async (req, res) => {
  const { date, userId, shiftId } = req.query as Record<string, string | undefined>;
  const [regs, shifts, users] = await Promise.all([readAll('Registrations'), readAll('Shifts'), readAll('Users')]);
  ok(res, regs.map((r) => { const s = shifts.find((x) => x.id === r.shiftId); const u = users.find((x) => x.id === r.userId);
    return { id: r.id, shiftId: r.shiftId, userId: r.userId, userName: u?.name, date: s?.date, startTime: s?.startTime, endTime: s?.endTime, createdAt: r.createdAt }; })
    .filter((r) => (!date || r.date === date) && (!userId || r.userId === userId) && (!shiftId || r.shiftId === shiftId)));
}));
admin.delete('/registrations/:id', h(async (req, res) => {
  await withLock(async () => {
    const regs = await readAll('Registrations');
    const left = regs.filter((r) => r.id !== req.params.id);
    if (left.length === regs.length) throw new HttpError(404, 'Registration not found');
    await writeAll('Registrations', left);
  });
  ok(res, null);
}));
admin.get('/stats', h(async (_req, res) => {
  const [shifts, regs, users] = await Promise.all([readAll('Shifts'), readAll('Registrations'), readAll('Users')]);
  const per = new Map<string, number>(); regs.forEach((r) => per.set(r.shiftId, (per.get(r.shiftId) ?? 0) + 1));
  const monthly: Record<string, number> = {};
  regs.forEach((r) => { const d = shifts.find((s) => s.id === r.shiftId)?.date; if (d) monthly[d.slice(0, 7)] = (monthly[d.slice(0, 7)] ?? 0) + 1; });
  ok(res, { totalShifts: shifts.length, filledShifts: per.size, fullShifts: [...per.values()].filter((c) => c >= MAX_USERS).length,
    totalRegistrations: regs.length, activeUsers: users.filter(isActive).length, monthly });
}));
app.use('/api/admin', admin);

// ---- serve built frontend (single-service deploy) ----
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// ---- errors ----
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues.map((i) => i.message).join(', '), details: err.issues.map((i) => i.message) });
  if (err instanceof HttpError) return res.status(err.status).json({ success: false, error: err.message });
  console.error(err); // log server-side only; never leak stack traces
  res.status(500).json({ success: false, error: 'Internal server error' });
});

seed().then(() => app.listen(Number(process.env.PORT ?? 4000), () => console.log('API on :' + (process.env.PORT ?? 4000))));
