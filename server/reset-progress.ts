/**
 * Reinicia el progreso del equipo para partir de cero (por ejemplo, antes de
 * abrir el juego a todos). Deja intactas las cuentas, contraseñas, nombres,
 * cargos y la apariencia de cada personaje.
 *
 * - Quienes NO son administración vuelven a nivel 1: sin monedas, decoración,
 *   vestuario, logros, misiones ni racha.
 * - Administración conserva todo lo suyo.
 * - Se borra lo de las pruebas que ve todo el equipo: actividad, chat,
 *   notificaciones, reuniones, avisos y el fondo de ampliación.
 *
 * Antes de tocar nada guarda una copia de la base junto a ella.
 * El servidor debe estar detenido: si no, al guardar su próximo cambio
 * sobrescribe el reinicio con lo que tiene en memoria.
 *
 *   npm run reset-progress                              (base de desarrollo)
 *   docker compose stop app
 *   docker compose run --rm app node --import tsx server/reset-progress.ts
 *   docker compose start app
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEmployee } from '../src/data/seed';
import type { Avatar, Employee, GameState } from '../src/data/types';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = process.env.DB_PATH ?? resolve(ROOT, 'server/data/oficina-viva.db');

if (!existsSync(DB_PATH)) {
  console.error(`No existe la base ${DB_PATH}.`);
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);
const row = db.prepare('SELECT rev, state FROM world WHERE id = 1').get();
if (row === undefined) {
  console.error('La base no tiene mundo guardado todavía: no hay nada que reiniciar.');
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const backup = resolve(dirname(DB_PATH), `respaldo-antes-de-reiniciar-${stamp}.db`);
db.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);

const state = JSON.parse(String(row.state)) as GameState;

/** La apariencia se conserva, pero sin adornos del vestuario (eso también se reinicia). */
function plainAvatar(a: Avatar): Avatar {
  const { hat: _hat, face: _face, neck: _neck, ...rest } = a;
  return rest;
}

const employees: Record<string, Employee> = {};
const reset: string[] = [];
const kept: string[] = [];
for (const e of Object.values(state.employees)) {
  if (e.role === 'admin') {
    employees[e.id] = e;
    kept.push(e.name);
    continue;
  }
  const fresh = makeEmployee(e.id, e.name, e.title, e.dept, e.role, e.plot, plainAvatar(e.avatar));
  employees[e.id] = { ...fresh, avatarSet: e.avatarSet };
  reset.push(e.name);
}

const next: GameState = {
  ...state,
  employees,
  feed: [],
  meetings: [],
  announcements: [],
  fund: undefined,
};

db.exec('BEGIN');
try {
  db.prepare('UPDATE world SET rev = ?, state = ? WHERE id = 1').run(Number(row.rev) + 1, JSON.stringify(next));
  for (const table of ['notifications', 'messages', 'dm_reads']) db.exec(`DELETE FROM ${table}`);
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}
db.close();

console.log(`Respaldo: ${backup}`);
console.log(`Reiniciados a nivel 1 (${reset.length}): ${reset.join(', ')}`);
console.log(`Conservan todo (administración): ${kept.join(', ') || 'nadie'}`);
console.log('También se borró la actividad, el chat, las notificaciones, las reuniones, los avisos y el fondo de ampliación.');
