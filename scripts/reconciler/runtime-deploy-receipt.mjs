// runtime-deploy-receipt.mjs - the proof that `npm run check` (starci runtime check) exited 0 on one exact commit.
// Two records count, both bound to the commit sha and its tree:
//   - a deploy receipt, <state>/deploy/receipts/<sha>.json, written ONLY by `starci runtime deploy` after it ran the check itself in the clean source clone;
//   - the land note of the host repository (refs/notes/land), whose `Land-Verified: <sha>` and `Check: <pass>/<total>` lines `starci git land` wrote after its own full check.
// A lane cannot claim green: the verb runs the check itself when neither record exists, and a hand-written receipt fails its tree binding or its digest.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { starciLocalRoot } from '../../engine/runtime-root.mjs';
import { notes } from '../api/git/notes.mjs';

const RECEIPT_SCHEMA = 'starci/deploy-receipt@1';

export const receiptFile = (sha, env) => path.join(starciLocalRoot(env), 'deploy', 'receipts', `${sha}.json`);

const digestOf = (r) => crypto.createHash('sha256').update([r.schema, r.sha, r.tree, r.exit, r.at].join('\n')).digest('hex');

/** Writes the receipt of a check that exited `exit` on commit `sha` (tree `tree`); the digest ties the fields together. */
export function writeReceipt({ sha, tree, exit, at = Date.now(), by = null, counts = null }, env) {
  const record = { schema: RECEIPT_SCHEMA, sha, tree, exit, at, by, counts };
  const file = receiptFile(sha, env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ ...record, digest: digestOf(record) }, null, 2)}\n`);
  return file;
}

function readReceipt(sha, tree, env) {
  let record;
  try { record = JSON.parse(fs.readFileSync(receiptFile(sha, env), 'utf8')); } catch { return null; }
  const bound = record?.schema === RECEIPT_SCHEMA && record.sha === sha && record.tree === tree && record.exit === 0 && record.digest === digestOf(record);
  return bound ? { via: 'deploy-receipt', at: record.at } : null;
}

function landNoteReceipt(host, sha) {
  const r = notes(['--ref=land', 'show', sha], { cwd: host });
  if (r.status !== 0) return null;
  const body = String(r.stdout ?? '');
  const check = /^Check: (\d+)\/(\d+)$/m.exec(body);
  const verified = new RegExp(`^Land-Verified: ${sha}$`, 'm').test(body);
  return verified && check && check[1] === check[2] ? { via: 'land-note', counts: `${check[1]}/${check[2]}` } : null;
}

/** The receipt that stands for `sha`: {via, ...} or null. `host` is the host repository, where the land note lives. */
export const receiptFor = ({ sha, tree, host, env }) => readReceipt(sha, tree, env) ?? landNoteReceipt(host, sha);
