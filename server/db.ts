import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AppNotification, ChatMessage, GameState } from '../src/data/types';

/**
 * Persistencia en un archivo SQLite. El mundo es un solo documento JSON (una
 * empresa son decenas de personas, no miles) y se reescribe completo en cada
 * cambio; las cuentas y sesiones van en sus propias tablas.
 */

export interface Account {
  employeeId: string;
  username: string;
  passHash: string;
  mustChange: boolean;
}

export function openDb(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS world (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      rev INTEGER NOT NULL,
      state TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS accounts (
      employee_id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      pass_hash TEXT NOT NULL,
      must_change INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES accounts(employee_id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      data TEXT,
      read INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS notifications_by_user ON notifications (employee_id, ts DESC);
    -- to_id NULL = chat general.
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      ts INTEGER NOT NULL,
      from_id TEXT NOT NULL,
      to_id TEXT,
      text TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_general ON messages (to_id, ts DESC);
    CREATE INDEX IF NOT EXISTS messages_pair ON messages (from_id, to_id, ts DESC);
    CREATE TABLE IF NOT EXISTS dm_reads (
      employee_id TEXT NOT NULL,
      other_id TEXT NOT NULL,
      last_ts INTEGER NOT NULL,
      PRIMARY KEY (employee_id, other_id)
    );
  `);
  // Bases anteriores a la traducción: título y cuerpo para mostrar en cada idioma.
  const notificationCols = db.prepare('PRAGMA table_info(notifications)').all().map((c) => String(c.name));
  if (!notificationCols.includes('msg')) db.exec('ALTER TABLE notifications ADD COLUMN msg TEXT');

  const q = {
    getWorld: db.prepare('SELECT rev, state FROM world WHERE id = 1'),
    putWorld: db.prepare('INSERT INTO world (id, rev, state) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET rev = excluded.rev, state = excluded.state'),
    accountByName: db.prepare('SELECT * FROM accounts WHERE username = ?'),
    accountById: db.prepare('SELECT * FROM accounts WHERE employee_id = ?'),
    allAccounts: db.prepare('SELECT * FROM accounts ORDER BY username'),
    insertAccount: db.prepare('INSERT INTO accounts (employee_id, username, pass_hash, must_change) VALUES (?, ?, ?, ?)'),
    setPassword: db.prepare('UPDATE accounts SET pass_hash = ?, must_change = ? WHERE employee_id = ?'),
    renameAccount: db.prepare('UPDATE accounts SET username = ? WHERE employee_id = ?'),
    deleteAccount: db.prepare('DELETE FROM accounts WHERE employee_id = ?'),
    insertSession: db.prepare('INSERT INTO sessions (token_hash, employee_id, expires) VALUES (?, ?, ?)'),
    session: db.prepare('SELECT employee_id, expires FROM sessions WHERE token_hash = ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    deleteSessionsOf: db.prepare('DELETE FROM sessions WHERE employee_id = ? AND token_hash <> ?'),
    purgeSessions: db.prepare('DELETE FROM sessions WHERE expires < ?'),

    insertNotification: db.prepare('INSERT INTO notifications (id, employee_id, ts, kind, title, body, data, msg, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)'),
    notifications: db.prepare('SELECT * FROM notifications WHERE employee_id = ? ORDER BY ts DESC LIMIT ?'),
    readNotification: db.prepare('UPDATE notifications SET read = 1 WHERE employee_id = ? AND id = ?'),
    readAllNotifications: db.prepare('UPDATE notifications SET read = 1 WHERE employee_id = ?'),
    pruneNotifications: db.prepare('DELETE FROM notifications WHERE ts < ?'),
    deleteNotificationsOf: db.prepare('DELETE FROM notifications WHERE employee_id = ?'),

    insertMessage: db.prepare('INSERT INTO messages (id, ts, from_id, to_id, text) VALUES (?, ?, ?, ?, ?)'),
    general: db.prepare('SELECT * FROM messages WHERE to_id IS NULL AND ts < ? ORDER BY ts DESC LIMIT ?'),
    conversation: db.prepare(
      'SELECT * FROM messages WHERE ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)) AND ts < ? ORDER BY ts DESC LIMIT ?',
    ),
    dmUnread: db.prepare(`
      SELECT m.from_id AS other, COUNT(*) AS n, MAX(m.ts) AS last
      FROM messages m LEFT JOIN dm_reads r ON r.employee_id = m.to_id AND r.other_id = m.from_id
      WHERE m.to_id = ? AND m.ts > COALESCE(r.last_ts, 0)
      GROUP BY m.from_id
    `),
    dmLast: db.prepare(`
      SELECT CASE WHEN from_id = ? THEN to_id ELSE from_id END AS other, MAX(ts) AS last
      FROM messages WHERE to_id IS NOT NULL AND (from_id = ? OR to_id = ?)
      GROUP BY other
    `),
    markRead: db.prepare(
      'INSERT INTO dm_reads (employee_id, other_id, last_ts) VALUES (?, ?, ?) ON CONFLICT(employee_id, other_id) DO UPDATE SET last_ts = MAX(last_ts, excluded.last_ts)',
    ),
    pruneMessages: db.prepare('DELETE FROM messages WHERE ts < ?'),
    deleteMessagesOf: db.prepare('DELETE FROM messages WHERE from_id = ? OR to_id = ?'),
  };

  const toNotification = (r: Record<string, unknown>): AppNotification => ({
    id: String(r.id),
    ts: Number(r.ts),
    kind: String(r.kind) as AppNotification['kind'],
    title: String(r.title),
    ...(r.body != null ? { body: String(r.body) } : {}),
    ...(r.data != null ? { data: JSON.parse(String(r.data)) as AppNotification['data'] } : {}),
    ...(r.msg != null ? { msg: JSON.parse(String(r.msg)) as AppNotification['msg'] } : {}),
    read: Number(r.read) === 1,
  });

  const toMessage = (r: Record<string, unknown>): ChatMessage => ({
    id: String(r.id),
    ts: Number(r.ts),
    from: String(r.from_id),
    ...(r.to_id != null ? { to: String(r.to_id) } : {}),
    text: String(r.text),
  });

  const toAccount = (row: Record<string, unknown> | undefined): Account | undefined =>
    row === undefined
      ? undefined
      : {
          employeeId: String(row.employee_id),
          username: String(row.username),
          passHash: String(row.pass_hash),
          mustChange: Number(row.must_change) === 1,
        };

  return {
    loadWorld(): { rev: number; state: GameState } | undefined {
      const row = q.getWorld.get();
      if (row === undefined) return undefined;
      return { rev: Number(row.rev), state: JSON.parse(String(row.state)) as GameState };
    },
    saveWorld(rev: number, state: GameState): void {
      q.putWorld.run(rev, JSON.stringify(state));
    },

    accountByName: (username: string) => toAccount(q.accountByName.get(username)),
    accountById: (id: string) => toAccount(q.accountById.get(id)),
    accounts: (): Account[] => q.allAccounts.all().map((r) => toAccount(r)!),
    createAccount(employeeId: string, username: string, passHash: string, mustChange: boolean): void {
      q.insertAccount.run(employeeId, username, passHash, mustChange ? 1 : 0);
    },
    setPassword(employeeId: string, passHash: string, mustChange: boolean): void {
      q.setPassword.run(passHash, mustChange ? 1 : 0, employeeId);
    },
    renameAccount(employeeId: string, username: string): void {
      q.renameAccount.run(username, employeeId);
    },
    deleteAccount(employeeId: string): void {
      q.deleteAccount.run(employeeId);
    },

    createSession(tokenHash: string, employeeId: string, expires: number): void {
      q.insertSession.run(tokenHash, employeeId, expires);
    },
    sessionUser(tokenHash: string): string | undefined {
      const row = q.session.get(tokenHash);
      if (row === undefined) return undefined;
      if (Number(row.expires) < Date.now()) {
        q.deleteSession.run(tokenHash);
        return undefined;
      }
      return String(row.employee_id);
    },
    deleteSession(tokenHash: string): void {
      q.deleteSession.run(tokenHash);
    },
    /** Cierra las demás sesiones de alguien (al cambiar o restablecer su contraseña). */
    deleteOtherSessions(employeeId: string, keepTokenHash = ''): void {
      q.deleteSessionsOf.run(employeeId, keepTokenHash);
    },
    purgeSessions(): void {
      q.purgeSessions.run(Date.now());
    },

    addNotification(employeeId: string, n: AppNotification): void {
      q.insertNotification.run(n.id, employeeId, n.ts, n.kind, n.title, n.body ?? null, n.data ? JSON.stringify(n.data) : null, n.msg ? JSON.stringify(n.msg) : null);
    },
    notifications: (employeeId: string, limit = 60): AppNotification[] => q.notifications.all(employeeId, limit).map(toNotification),
    readNotifications(employeeId: string, ids: string[] | 'all'): void {
      if (ids === 'all') q.readAllNotifications.run(employeeId);
      else for (const id of ids) q.readNotification.run(employeeId, id);
    },

    addMessage(m: ChatMessage): void {
      q.insertMessage.run(m.id, m.ts, m.from, m.to ?? null, m.text);
    },
    /** Mensajes del chat general anteriores a `before`, del más antiguo al más nuevo. */
    general: (before: number, limit: number): ChatMessage[] => q.general.all(before, limit).map(toMessage).reverse(),
    conversation: (a: string, b: string, before: number, limit: number): ChatMessage[] =>
      q.conversation.all(a, b, b, a, before, limit).map(toMessage).reverse(),
    /** Por cada contacto: mensajes privados sin leer y hora del último mensaje (en cualquier sentido). */
    dmSummary(employeeId: string): Record<string, { unread: number; last: number }> {
      const out: Record<string, { unread: number; last: number }> = {};
      for (const r of q.dmLast.all(employeeId, employeeId, employeeId)) out[String(r.other)] = { unread: 0, last: Number(r.last) };
      for (const r of q.dmUnread.all(employeeId)) {
        const other = String(r.other);
        out[other] = { unread: Number(r.n), last: Math.max(out[other]?.last ?? 0, Number(r.last)) };
      }
      return out;
    },
    markDmRead(employeeId: string, otherId: string, ts: number): void {
      q.markRead.run(employeeId, otherId, ts);
    },
    /** Limpieza: notificaciones de más de 60 días y mensajes de más de 180. */
    prune(): void {
      q.pruneNotifications.run(Date.now() - 60 * 86_400_000);
      q.pruneMessages.run(Date.now() - 180 * 86_400_000);
    },
    forgetEmployee(employeeId: string): void {
      q.deleteNotificationsOf.run(employeeId);
      q.deleteMessagesOf.run(employeeId, employeeId);
    },

    transaction<T>(fn: () => T): T {
      db.exec('BEGIN IMMEDIATE');
      try {
        const out = fn();
        db.exec('COMMIT');
        return out;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    close: () => db.close(),
  };
}

export type Db = ReturnType<typeof openDb>;
