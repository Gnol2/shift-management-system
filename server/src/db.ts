import ExcelJS from 'exceljs';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(__dirname, '..', 'data'));

export const SCHEMAS = {
  Users: ['id', 'name', 'email', 'passwordHash', 'role', 'active', 'createdAt'],
  Shifts: ['id', 'date', 'startTime', 'endTime', 'maxUsers', 'createdAt'],
  Registrations: ['id', 'shiftId', 'userId', 'createdAt'],
} as const;
export type Table = keyof typeof SCHEMAS;
export type Row = Record<string, any>;

// Single in-process queue: every read-modify-write must run inside withLock().
let chain: Promise<unknown> = Promise.resolve();
export function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(() => fn());
  chain = run.catch(() => undefined);
  return run;
}

const fileOf = (t: Table) => path.join(DATA_DIR, `${t}.xlsx`);

export async function writeAll(t: Table, rows: Row[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(t);
  ws.addRow([...SCHEMAS[t]]);
  rows.forEach((r) => ws.addRow(SCHEMAS[t].map((c) => r[c])));
  const tmp = fileOf(t) + '.tmp';
  await wb.xlsx.writeFile(tmp);
  await fs.rename(tmp, fileOf(t)); // atomic replace: no partial writes
}

export async function readAll(t: Table): Promise<Row[]> {
  const exists = await fs.access(fileOf(t)).then(() => true, () => false);
  if (!exists) { await writeAll(t, []); return []; }
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(fileOf(t));
  } catch (e: any) {
    throw new Error(`Workbook ${t}.xlsx is corrupted or locked (close it in Excel): ${e.message}`);
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error(`Workbook ${t}.xlsx has no worksheet`);
  const rows: Row[] = [];
  ws.eachRow((r, i) => {
    if (i === 1) return;
    const o: Row = {};
    SCHEMAS[t].forEach((c, j) => { o[c] = r.getCell(j + 1).value ?? ''; });
    rows.push(o);
  });
  return rows;
}
