import { createHash } from 'node:crypto';

export function dbMark(db) {
  if (!db) return null;
  const version = db.prepare('PRAGMA data_version').get().data_version;
  const marks = db.prepare('SELECT topic, mark FROM v_live_marks ORDER BY topic').all();
  return { version, marks };
}

export function etagOf(...parts) {
  return `"${createHash('sha256').update(JSON.stringify(parts)).digest('hex')}"`;
}
