# Shift Management System (backend core)

Express + TypeScript API using Excel (.xlsx) as the database (`server/data/`, auto-created).

## Run
    cp .env.example server/.env   # set JWT_SECRET
    cd server && npm install && npm run dev

Seed accounts (created on first start; CHANGE before production, along with JWT_SECRET):
- admin@shift.local / Admin@123
- user@shift.local / User@123

## Excel schema
Users: id, name, email, passwordHash, role, active, createdAt
Shifts: id (`YYYY-MM-DD_HH00`), date, startTime, endTime, maxUsers, createdAt
Registrations: id, shiftId, userId, createdAt

## API (all JSON `{success,data|error}`; Bearer JWT)
POST /api/auth/register {name, email?, password} · POST /api/auth/login {identifier: name or email, password} · POST /api/auth/logout · GET /api/auth/me
GET /api/shifts?date=YYYY-MM-DD (auto-generates 12 shifts)
POST|DELETE /api/shifts/:id/register · GET /api/registrations/mine
Admin: GET|POST /api/admin/users · PATCH /api/admin/users/:id · GET /api/admin/registrations?date&userId&shiftId · DELETE /api/admin/registrations/:id · GET /api/admin/stats

## Limitations
- Excel is not a real database: run ONE backend instance only. Writes are serialized by an in-process queue and replaced atomically (temp file + rename), which does not protect multiple processes.
- Whole-file rewrite per change: fine for small teams, slow at scale.
- Logout is stateless (client discards token).

## Frontend (client/)
    cd client && npm install && npm run dev     # http://localhost:5173, proxies /api -> :4000
    npm run build                               # tsc + vite build
Pages: Login, Dashboard, Duty calendar (week grid), My shifts, Admin (overview, users, registrations).
