import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LEN = 64;

export const MIN_PASSWORD = 8;
export const SESSION_DAYS = 30;
export const COOKIE = 'iw_session';

/** Formato guardado: `scrypt$<sal hex>$<hash hex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LEN, SCRYPT);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, keyHex] = stored.split('$');
  if (algo !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const key = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length, SCRYPT);
  return timingSafeEqual(key, expected);
}

/** Hash fijo para comparar cuando el usuario no existe y no delatarlo por el tiempo de respuesta. */
export const DUMMY_HASH = `scrypt$${'00'.repeat(16)}$${'00'.repeat(KEY_LEN)}`;

// Sin 0/O, 1/l/I: la contraseña temporal se dicta o se copia a mano.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function tempPassword(length = 10): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** En la base solo se guarda el hash del token: si se filtra la base, las sesiones no sirven. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** "Matías Rojas" → "matias.rojas"; si ya existe, "matias.rojas2". */
export function usernameFor(name: string, taken: (u: string) => boolean): string {
  const parts = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const base = parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0] || 'usuario';
  let name2 = base;
  for (let n = 2; taken(name2); n++) name2 = `${base}${n}`;
  return name2;
}

export function validUsername(u: string): boolean {
  return /^[a-z0-9._-]{3,40}$/i.test(u);
}

/** Intentos de login por IP: 10 cada 15 minutos. */
export function createRateLimiter(max = 10, windowMs = 15 * 60_000) {
  const hits = new Map<string, { count: number; reset: number }>();
  return {
    blocked(key: string): boolean {
      const h = hits.get(key);
      return h !== undefined && h.reset > Date.now() && h.count >= max;
    },
    fail(key: string): void {
      const now = Date.now();
      const h = hits.get(key);
      if (h === undefined || h.reset <= now) hits.set(key, { count: 1, reset: now + windowMs });
      else h.count++;
      if (hits.size > 5000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    },
    clear(key: string): void {
      hits.delete(key);
    },
  };
}
