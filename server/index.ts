import express, { type NextFunction, type Request, type Response } from 'express';
import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addEmployee,
  applyAction,
  editEmployee,
  recordActivity,
  removeEmployee,
  tickMeetings,
  type Fx,
  type NotifyReq,
  type Outcome,
} from '../src/data/logic';
import { spanishText } from '../src/data/messages';
import { createSeedState, newUid } from '../src/data/seed';
import { L, parseLang, setLangProvider, type Lang } from '../src/i18n';
import type { AppNotification, ChatMessage, GameState } from '../src/data/types';
import type { Weather } from '../src/data/weather';
import {
  COOKIE,
  DUMMY_HASH,
  MIN_PASSWORD,
  SESSION_DAYS,
  createRateLimiter,
  hashPassword,
  hashToken,
  newSessionToken,
  tempPassword,
  usernameFor,
  validUsername,
  verifyPassword,
} from './auth';
import { openDb, type Account } from './db';
import { parseAction, parseChatText, parseEmployeeEdit, parseId, parseNewEmployee } from './validate';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROD = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
const PORT = Number(process.env.PORT ?? 4460);
const HOST = process.env.HOST ?? 'localhost';
const DB_PATH = process.env.DB_PATH ?? resolve(ROOT, 'server/data/oficina-viva.db');

// ---------------------------------------------------------------------------
// Mundo
// ---------------------------------------------------------------------------

const db = openDb(DB_PATH);

/** Primera vez: equipo de ejemplo con contraseñas temporales que se piden cambiar al entrar. */
async function firstRun(): Promise<{ rev: number; state: GameState }> {
  const state = createSeedState();
  const lines: string[] = [];
  const created: [string, string, string][] = [];
  for (const e of Object.values(state.employees)) {
    const username = usernameFor(e.name, (u) => created.some(([, name]) => name === u));
    const password = tempPassword();
    created.push([e.id, username, await hashPassword(password)]);
    lines.push(`${e.name.padEnd(20)} ${e.role.padEnd(12)} ${username.padEnd(22)} ${password}`);
  }
  db.transaction(() => {
    for (const [id, username, hash] of created) db.createAccount(id, username, hash, true);
    db.saveWorld(1, state);
  });
  const file = resolve(dirname(DB_PATH), 'credenciales-iniciales.txt');
  const table = ['Nombre               Rol          Usuario                Contraseña temporal', ...lines].join('\n');
  writeFileSync(file, `${table}\n\nSe pide cambiar la contraseña al primer ingreso. Borra este archivo cuando las hayas entregado.\n`);
  console.log(`\nMundo nuevo creado. Cuentas iniciales (también en ${file}):\n\n${table}\n`);
  return { rev: 1, state };
}

let { rev, state } = db.loadWorld() ?? (await firstRun());
// Mundos anteriores guardaban los avisos dentro de cada colaborador; ahora van en su propia tabla.
for (const e of Object.values(state.employees) as (GameState['employees'][string] & { notices?: unknown })[]) delete e.notices;
db.purgeSessions();
db.prune();

/** Conexiones en vivo (Server-Sent Events): cada cambio del mundo se reparte a todos. */
const streams = new Set<{ res: Response; employeeId: string }>();

function send(res: Response, event: string, data: string): void {
  res.write(`event: ${event}\ndata: ${data}\n\n`);
}

function sendTo(ids: Iterable<string>, event: string, payload: unknown): void {
  const set = new Set(ids);
  const data = JSON.stringify(payload);
  for (const s of streams) if (set.has(s.employeeId)) send(s.res, event, data);
}

function sendAll(event: string, payload: unknown): void {
  const data = JSON.stringify(payload);
  for (const s of streams) send(s.res, event, data);
}

function online(): Set<string> {
  return new Set([...streams].map((s) => s.employeeId));
}

/** Guarda y entrega los avisos personales que produjo una acción. */
function deliver(reqs: NotifyReq[]): void {
  for (const r of reqs) {
    const to = r.to === 'all' ? Object.keys(state.employees) : r.to.filter((id) => state.employees[id] !== undefined);
    for (const id of to) {
      // El texto en español queda de respaldo; cada cliente lo muestra en su idioma con `msg`.
      const n: AppNotification = { id: newUid('n'), ts: Date.now(), kind: r.kind, title: spanishText(r.title), read: false };
      if (r.body) n.body = spanishText(r.body);
      n.msg = r.body ? { title: r.title, body: r.body } : { title: r.title };
      if (r.data) n.data = r.data;
      db.addNotification(id, n);
      sendTo([id], 'notify', n);
    }
  }
}

function commitWorld(next: GameState, extra: { fx?: Fx[]; actionId?: string; notify?: NotifyReq[] } = {}): number {
  rev++;
  state = next;
  db.saveWorld(rev, state);
  const data = JSON.stringify({ rev, state, fx: extra.fx ?? [], actionId: extra.actionId });
  for (const s of streams) send(s.res, 'update', data);
  if (extra.notify?.length) deliver(extra.notify);
  return rev;
}

function commitOutcome(out: Outcome, actionId?: string): number {
  return commitWorld(out.state, { fx: out.fx, actionId, notify: out.notify });
}

function dropStreamsOf(employeeId: string): void {
  for (const s of streams) if (s.employeeId === employeeId) s.res.end();
}

/** Quién está conectado: se avisa a todos cuando cambia (con un respiro para no repetir). */
let presenceTimer: NodeJS.Timeout | undefined;
function presenceChanged(): void {
  clearTimeout(presenceTimer);
  presenceTimer = setTimeout(() => sendAll('presence', { online: [...online()] }), 400);
}

// Reloj de reuniones: recordatorios, inicio automático y asistencia.
setInterval(() => {
  const out = tickMeetings(state, online());
  if (out !== null) commitOutcome(out);
}, 10_000).unref();

// Limpieza diaria de avisos y mensajes antiguos.
setInterval(() => db.prune(), 24 * 3_600_000).unref();

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const app = express();
const http = createServer(app);
const loginLimiter = createRateLimiter();

app.disable('x-powered-by');
// Detrás de un proxy (Nginx, Render, Railway…) para ver la IP real y saber si es https.
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
// Idioma de cada petición: los mensajes de respuesta salen en el de quien pregunta.
const requestLang = new AsyncLocalStorage<Lang>();
setLangProvider(() => requestLang.getStore() ?? 'es');
app.use((req, _res, next) => {
  requestLang.run(parseLang(req.get('X-Lang')) ?? parseLang(req.get('Accept-Language')) ?? 'es', next);
});

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

const api = express.Router();
api.use(express.json({ limit: '16kb' }));

// Toda escritura exige un encabezado propio: un sitio ajeno no puede mandarlo
// sin permiso CORS, así que no puede actuar con la cookie de otra persona.
api.use((req, res, next) => {
  if (req.method !== 'GET' && req.get('X-Oficina-Viva') !== '1') {
    res.status(403).json({ ok: false, message: L('Solicitud no permitida.', 'Request not allowed.') });
    return;
  }
  next();
});

interface Auth {
  account: Account;
  tokenHash: string;
}

function readToken(req: Request): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

function authOf(req: Request): Auth | undefined {
  const token = readToken(req);
  if (!token) return undefined;
  const tokenHash = hashToken(token);
  const id = db.sessionUser(tokenHash);
  const account = id === undefined ? undefined : db.accountById(id);
  return account && state.employees[account.employeeId] ? { account, tokenHash } : undefined;
}

/** Exige sesión; con `ready`, además que ya haya cambiado su contraseña temporal. */
function requireAuth(ready: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = authOf(req);
    if (auth === undefined) {
      res.status(401).json({ ok: false, message: L('Tu sesión expiró. Vuelve a entrar.', 'Your session expired. Please log in again.') });
      return;
    }
    if (ready && auth.account.mustChange) {
      res.status(403).json({ ok: false, message: L('Primero cambia tu contraseña temporal.', 'Change your temporary password first.'), mustChange: true });
      return;
    }
    res.locals.auth = auth;
    next();
  };
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(true)(req, res, () => {
    if (state.employees[(res.locals.auth as Auth).account.employeeId]?.role !== 'admin') {
      res.status(403).json({ ok: false, message: L('Solo administradores.', 'Admins only.') });
      return;
    }
    next();
  });
}

const me = (res: Response) => (res.locals.auth as Auth).account.employeeId;

function sessionInfo(a: Account) {
  return { id: a.employeeId, username: a.username, mustChange: a.mustChange };
}

function startSession(req: Request, res: Response, employeeId: string): void {
  const token = newSessionToken();
  const maxAge = SESSION_DAYS * 86_400_000;
  db.createSession(hashToken(token), employeeId, Date.now() + maxAge);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge, path: '/' });
}

// --- Clima de Santiago ------------------------------------------------------

// Open-Meteo: gratis y sin clave. Se consulta a lo más cada 10 minutos y se
// reparte a todos desde aquí, así el navegador no depende de un servicio externo.
const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=-33.45&longitude=-70.66' +
  '&current=temperature_2m,weather_code,wind_speed_10m&daily=sunrise,sunset&forecast_days=1&timezone=America%2FSantiago';
let weather: Weather | null = null;
let weatherPending: Promise<void> | null = null;
let weatherTried = 0;

const minutesOf = (iso: string) => {
  const [h, m] = iso.slice(11, 16).split(':').map(Number);
  return h * 60 + m;
};

async function refreshWeather(): Promise<void> {
  try {
    const r = await fetch(WEATHER_URL, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as {
      current: { temperature_2m: number; weather_code: number; wind_speed_10m: number };
      daily: { sunrise: string[]; sunset: string[] };
    };
    weather = {
      temp: Math.round(j.current.temperature_2m),
      code: j.current.weather_code,
      wind: Math.round(j.current.wind_speed_10m),
      sunrise: minutesOf(j.daily.sunrise[0]),
      sunset: minutesOf(j.daily.sunset[0]),
      updated: Date.now(),
    };
  } catch (err) {
    // Sin internet o servicio caído: se queda con el último dato (o ninguno).
    console.warn('[clima] no se pudo actualizar:', err instanceof Error ? err.message : err);
  }
}

api.get('/weather', async (_req, res) => {
  if (Date.now() - weatherTried > 10 * 60_000) {
    weatherTried = Date.now();
    weatherPending ??= refreshWeather().finally(() => (weatherPending = null));
    await weatherPending;
  }
  res.json({ ok: true, weather });
});

// --- Sesión -----------------------------------------------------------------

api.get('/session', (req, res) => {
  const auth = authOf(req);
  res.json({ user: auth ? sessionInfo(auth.account) : null });
});

api.post('/login', async (req, res) => {
  const ip = req.ip ?? 'unknown';
  if (loginLimiter.blocked(ip)) {
    res.status(429).json({ ok: false, message: L('Demasiados intentos. Espera unos minutos.', 'Too many attempts. Wait a few minutes.') });
    return;
  }
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().slice(0, 60) : '';
  const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 200) : '';
  const account = username ? db.accountByName(username) : undefined;
  // Siempre se calcula un hash, exista o no la cuenta, para no delatar usuarios por el tiempo.
  const valid = await verifyPassword(password, account?.passHash ?? DUMMY_HASH);
  if (account === undefined || !valid || state.employees[account.employeeId] === undefined) {
    loginLimiter.fail(ip);
    res.status(401).json({ ok: false, message: L('Usuario o contraseña incorrectos.', 'Wrong username or password.') });
    return;
  }
  loginLimiter.clear(ip);
  startSession(req, res, account.employeeId);
  res.json({ ok: true, user: sessionInfo(account) });
});

api.post('/logout', (req, res) => {
  const token = readToken(req);
  if (token) db.deleteSession(hashToken(token));
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

api.post('/password', requireAuth(false), async (req, res) => {
  const { account, tokenHash } = res.locals.auth as Auth;
  const current = typeof req.body?.current === 'string' ? req.body.current : '';
  const next = typeof req.body?.next === 'string' ? req.body.next : '';
  if (!(await verifyPassword(current, account.passHash))) {
    res.status(400).json({ ok: false, message: L('La contraseña actual no coincide.', "The current password doesn't match.") });
    return;
  }
  if (next.length < MIN_PASSWORD || next.length > 200) {
    res.status(400).json({ ok: false, message: L(`La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`, `The new password must be at least ${MIN_PASSWORD} characters long.`) });
    return;
  }
  if (next === current) {
    res.status(400).json({ ok: false, message: L('Elige una contraseña distinta a la actual.', 'Choose a password different from the current one.') });
    return;
  }
  db.setPassword(account.employeeId, await hashPassword(next), false);
  db.deleteOtherSessions(account.employeeId, tokenHash);
  res.json({ ok: true, message: L('Contraseña actualizada.', 'Password updated.'), user: sessionInfo({ ...account, mustChange: false }) });
});

// --- Mundo ------------------------------------------------------------------

api.get('/events', requireAuth(true), (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const stream = { res, employeeId: me(res) };
  streams.add(stream);
  send(res, 'snapshot', JSON.stringify({ rev, state }));
  send(res, 'presence', JSON.stringify({ online: [...online()] }));
  presenceChanged();
  req.on('close', () => {
    streams.delete(stream);
    presenceChanged();
  });
});

// Comentario cada 25 s para que proxies y navegadores no corten la conexión.
setInterval(() => {
  for (const s of streams) s.res.write(': ping\n\n');
}, 25_000).unref();

api.post('/action', requireAuth(true), (req, res) => {
  const action = parseAction(req.body?.action);
  const actionId = typeof req.body?.id === 'string' ? req.body.id.slice(0, 40) : undefined;
  if (action === null) {
    res.status(400).json({ ok: false, message: L('Acción no válida.', 'Invalid action.') });
    return;
  }
  const out = applyAction(state, me(res), action);
  if (!out.result.ok) {
    res.status(409).json({ ...out.result, rev });
    return;
  }
  const r = commitOutcome(out, actionId);
  res.json({ ...out.result, rev: r });
});

// --- Notificaciones ---------------------------------------------------------

api.get('/notifications', requireAuth(true), (_req, res) => {
  res.json(db.notifications(me(res)));
});

api.post('/notifications/read', requireAuth(true), (req, res) => {
  const ids = req.body?.ids;
  if (ids === 'all') db.readNotifications(me(res), 'all');
  else if (Array.isArray(ids) && ids.length <= 200) db.readNotifications(me(res), ids.map(parseId).filter((x): x is string => x !== null));
  else {
    res.status(400).json({ ok: false, message: L('Solicitud no válida.', 'Invalid request.') });
    return;
  }
  res.json({ ok: true });
});

// --- Chat -------------------------------------------------------------------

/** Ráfagas: hasta 8 mensajes cada 10 s por persona. */
const chatHits = new Map<string, number[]>();
function chatAllowed(id: string): boolean {
  const now = Date.now();
  const recent = (chatHits.get(id) ?? []).filter((t) => now - t < 10_000);
  if (recent.length >= 8) return false;
  recent.push(now);
  chatHits.set(id, recent);
  return true;
}

const PAGE = 60;
const beforeOf = (v: unknown) => (typeof v === 'string' && /^\d{1,15}$/.test(v) ? Number(v) : Date.now() + 1);

api.get('/chat/general', requireAuth(true), (req, res) => {
  res.json(db.general(beforeOf(req.query.before), PAGE));
});

api.get('/chat/dm/:other', requireAuth(true), (req, res) => {
  const other = parseId(req.params.other);
  if (other === null || state.employees[other] === undefined) {
    res.status(404).json({ ok: false, message: L('Colaborador no encontrado.', 'Team member not found.') });
    return;
  }
  res.json(db.conversation(me(res), other, beforeOf(req.query.before), PAGE));
});

api.get('/chat/summary', requireAuth(true), (_req, res) => {
  res.json(db.dmSummary(me(res)));
});

api.post('/chat/read', requireAuth(true), (req, res) => {
  const other = parseId(req.body?.with);
  if (other === null) {
    res.status(400).json({ ok: false, message: L('Solicitud no válida.', 'Invalid request.') });
    return;
  }
  db.markDmRead(me(res), other, Date.now());
  res.json({ ok: true });
});

api.post('/chat', requireAuth(true), (req, res) => {
  const from = me(res);
  const text = parseChatText(req.body?.text);
  const to = req.body?.to === undefined || req.body?.to === null ? undefined : parseId(req.body.to);
  if (text === null || to === null || (to !== undefined && (state.employees[to] === undefined || to === from))) {
    res.status(400).json({ ok: false, message: L('Mensaje no válido.', 'Invalid message.') });
    return;
  }
  if (!chatAllowed(from)) {
    res.status(429).json({ ok: false, message: L('Vas muy rápido: espera un momento.', "You're going too fast: wait a moment.") });
    return;
  }
  const msg: ChatMessage = { id: newUid('m'), ts: Date.now(), from, text, ...(to ? { to } : {}) };
  db.addMessage(msg);
  if (to) {
    db.markDmRead(from, to, msg.ts);
    sendTo([from, to], 'dm', msg);
  } else {
    sendAll('chat', msg);
  }
  // Cuenta para misiones y logros (solo reescribe el mundo si todavía aporta algo).
  const out = recordActivity(state, from, to ? 'dm' : 'chat');
  if (out !== null) commitOutcome(out);
  res.json({ ok: true, message: msg });
});

// --- Administración ---------------------------------------------------------

api.get('/admin/accounts', requireAdmin, (_req, res) => {
  res.json(db.accounts().map((a) => ({ employeeId: a.employeeId, username: a.username, mustChange: a.mustChange })));
});

api.post('/admin/employees', requireAdmin, async (req, res) => {
  const input = parseNewEmployee(req.body);
  if (input === null) {
    res.status(400).json({ ok: false, message: L('Datos incompletos.', 'Missing data.') });
    return;
  }
  if (input.username !== undefined && (!validUsername(input.username) || db.accountByName(input.username))) {
    res.status(400).json({ ok: false, message: L('Ese usuario no es válido o ya existe (letras, números, punto o guion; 3 a 40).', 'That username is invalid or already taken (letters, numbers, dot or hyphen; 3 to 40).') });
    return;
  }
  const out = addEmployee(state, me(res), input.name, input.title, input.dept, input.role, input.body);
  if (!out.result.ok || out.id === undefined) {
    res.status(400).json(out.result);
    return;
  }
  const username = input.username ?? usernameFor(input.name, (u) => db.accountByName(u) !== undefined);
  const password = tempPassword();
  const hash = await hashPassword(password);
  db.transaction(() => {
    db.createAccount(out.id!, username, hash, true);
    commitWorld(out.state);
  });
  res.json({ ...out.result, username, password });
});

api.post('/admin/employees/:id', requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const input = parseEmployeeEdit(req.body);
  const account = db.accountById(id);
  if (input === null || account === undefined) {
    res.status(400).json({ ok: false, message: L('Datos incompletos.', 'Missing data.') });
    return;
  }
  const other = db.accountByName(input.username);
  if (!validUsername(input.username) || (other && other.employeeId !== id)) {
    res.status(400).json({ ok: false, message: L('Ese usuario no es válido o ya existe.', 'That username is invalid or already taken.') });
    return;
  }
  const out = editEmployee(state, me(res), id, input);
  if (!out.result.ok) {
    res.status(400).json(out.result);
    return;
  }
  db.transaction(() => {
    if (input.username !== account.username) db.renameAccount(id, input.username);
    commitWorld(out.state);
  });
  res.json(out.result);
});

api.post('/admin/employees/:id/delete', requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const out = removeEmployee(state, me(res), id);
  if (!out.result.ok) {
    res.status(400).json(out.result);
    return;
  }
  db.transaction(() => {
    db.deleteAccount(id);
    db.forgetEmployee(id);
    commitWorld(out.state);
  });
  dropStreamsOf(id);
  res.json(out.result);
});

api.post('/admin/employees/:id/password', requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  const account = db.accountById(id);
  if (account === undefined) {
    res.status(404).json({ ok: false, message: L('Cuenta no encontrada.', 'Account not found.') });
    return;
  }
  const password = tempPassword();
  db.setPassword(id, await hashPassword(password), true);
  db.deleteOtherSessions(id);
  dropStreamsOf(id);
  res.json({ ok: true, message: L('Contraseña restablecida.', 'Password reset.'), username: account.username, password });
});

api.use((_req, res) => {
  res.status(404).json({ ok: false, message: L('No encontrado.', 'Not found.') });
});

app.use('/api', api);

// --- Frontend ---------------------------------------------------------------

if (PROD) {
  const dist = resolve(ROOT, 'dist');
  if (!existsSync(resolve(dist, 'index.html'))) throw new Error('Falta dist/: corre "npm run build" antes de "npm start".');
  app.use(express.static(dist, { index: false, maxAge: '7d', setHeaders: (res, path) => path.endsWith('.html') && res.setHeader('Cache-Control', 'no-cache') }));
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(resolve(dist, 'index.html')) : next()));
} else {
  // En desarrollo Vite corre dentro de este mismo proceso: un solo puerto, un solo proceso que detener.
  const { createServer: createVite } = await import('vite');
  const vite = await createVite({ root: ROOT, server: { middlewareMode: true, hmr: { server: http } }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  if (!res.headersSent) res.status(500).json({ ok: false, message: L('Error del servidor.', 'Server error.') });
});

http.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code !== 'EADDRINUSE') throw err;
  console.error(
    `\nEl puerto ${PORT} ya está en uso. ¿Quedó corriendo otra copia o el contenedor de Docker?\n` +
      `  · Detén el contenedor:  docker compose down\n` +
      `  · O usa otro puerto:    PORT=4470 npm run dev   (PowerShell: $env:PORT=4470; npm run dev)\n`,
  );
  process.exit(1);
});

http.listen(PORT, HOST, () => {
  const url = process.env.PUBLIC_URL ?? `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`;
  console.log(`Oficina Viva en ${url} (${PROD ? 'producción' : 'desarrollo'})`);
});

function shutdown(): void {
  for (const s of streams) s.res.end();
  http.close();
  db.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
