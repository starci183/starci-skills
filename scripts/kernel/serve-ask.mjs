// `serve-ask` — renders the one pending owner question of an `outcome: ask`
// op report as a localhost form and lands the answer durably, without any
// model agent ever seeing a secret value. Spawned detached by the Kernel (or
// the launcher chat) when it parks an ask leg; exits after one submission or
// on --ttl. Port: first free in 6969 +0..100 (the owner-facing ask lane).
//
//   node serve-ask.mjs --repo <path> --workflow <id> [--dispatch <id>] [--ttl <ms>] [--json]
//
// Submit flow: custody fields named '*.key|*.txt|*.json' in the question text
// are written through <repo>/scripts/stack-secret.mjs set --from-file (the
// canonical encrypted-custody write; values never touch argv or the ledger),
// and each written file auto-derives its <NAME>_FILE pointer in the canonical
// encrypted app.env — then dev-env.mjs refreshes the .env.local managed
// bridge so the pointer reaches the app's env loader. UPPER_SNAKE variables
// are upserted into BOTH .env.local (the provision-script sink) and app.env
// (the canonical encrypted env store). A sanitized receipt (names and custody
// paths only — never values) lands in kernel-evidence, an `ask-answered`
// event is appended, and the workflow's Kernel is woken through its Orca
// terminal so it can re-verify custody presence and settle the ask.

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalSend } from '../api/orca/terminal-send.mjs';
import { terminalShow } from '../api/orca/terminal-show.mjs';
import { classifyAgentScreen } from './terminal-liveness.mjs';

const PORT_BASE = 6969;
const PORT_SCAN = 100; // 6969..7069 — the owner's "one memorable lane" band
const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000;

const parseJson = (s, fb = null) => { try { return JSON.parse(s); } catch { return fb; } };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const parseArgs = (argv) => {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) { a._.push(k); continue; }
    if (k === '--json' || k === '--review') { a[k.slice(2)] = true; continue; }
    const v = argv[++i];
    if (v === undefined) { console.error(`serve-ask: --${k.slice(2)} needs a value`); process.exit(2); }
    a[k.slice(2)] = v;
  }
  return a;
};

// A custody file becomes reachable through a `<NAME>_FILE` pointer — the same
// convention app.env already carries (keycloak-admin.json → KEYCLOAK_ADMIN_FILE).
const pointerFor = (name) => `${name.replace(/\.[^.]+$/, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_FILE`;

// The ask report names its provisions in free text; the form derives the
// entry surface from the same tokens the verifier will check: custody file
// basenames (*.key/*.txt under runtime/files) and UPPER_SNAKE env variables.
// Two dedup rules keep one value from being asked twice: a var that is the
// bare base of a named custody file (github-oauth-client-secret.key ↔
// GITHUB_OAUTH_CLIENT_SECRET) is the same secret — one merged field; and a
// bare `X_FILE` var is a pointer to be derived, not a value to paste, so it
// becomes a custody field instead of a text input.
const fieldsOf = (text) => {
  const files = [...new Set([...text.matchAll(/([\w-]+\.(?:key|txt|json))/g)].map(m => m[1]))];
  let vars = [...new Set([...text.matchAll(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g)].map(m => m[0]))]
    .filter(v => !/^(JSON|HTTP|URL|API|E2E)$/.test(v));
  const paired = {};
  for (const v of vars.filter((v) => v.endsWith('_FILE'))) {
    const base = v.slice(0, -5).toLowerCase().replace(/_/g, '-');
    if (!files.some((f) => pointerFor(f) === v)) files.push(`${base}.key`);
  }
  vars = vars.filter((v) => !v.endsWith('_FILE'));
  for (const f of files) {
    const base = pointerFor(f).slice(0, -5);
    if (vars.includes(base)) { paired[f] = base; vars = vars.filter((v) => v !== base); }
  }
  return {
    files,
    vars,
    paired,
    isSecret: (name) => /SECRET|PASSWORD|TOKEN|KEY/i.test(name),
  };
};

// An approval ask about produced artifacts is meaningless without showing
// them — extract image paths named in the question and serve them inline.
// Basenames (auth-sign-in-desktop-direction.png) are located by a bounded
// walk under .starciwork, the only tree where workflow evidence lives.
const imagesOf = (text, repo) => {
  const tokens = [...new Set([...text.matchAll(/[\w./\\-]+\.(?:png|jpe?g|webp|gif|svg)\b/gi)].map((m) => m[0]))];
  const root = path.join(repo, '.starciwork');
  const locate = (base) => {
    // BFS — a named artifact lives a few levels under .starciwork, while a
    // DFS stack would burn the whole budget inside kernel-strays archives.
    const queue = [root]; let head = 0, visited = 0;
    while (head < queue.length && visited++ < 20000) {
      const dir = queue[head++];
      let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of ents) {
        if (e.name === base) return path.join(dir, e.name);
        if (e.isDirectory() && !e.name.startsWith('.')) queue.push(path.join(dir, e.name));
      }
    }
    return null;
  };
  const found = [];
  for (const t of tokens) {
    const rel = t.replace(/\\/g, '/');
    const abs = path.join(repo, rel);
    if (rel.includes('/') && fs.existsSync(abs)) { found.push({ label: rel, abs }); continue; }
    const hit = fs.existsSync(root) ? locate(path.basename(rel)) : null;
    if (hit) found.push({ label: rel, abs: hit });
  }
  return found;
};

const custodyDirs = (repo) => ['.starcistacks', '.stacks']
  .map(root => path.join(repo, root, 'dev', 'runtime', 'files'))
  .filter(d => fs.existsSync(path.dirname(d)));

const custodyPresent = (repo, name) => custodyDirs(repo).some(d => fs.existsSync(path.join(d, name)));

// Canonical encrypted-custody write; falls back to the materialized runtime
// path when the repo carries no stack-secret tool. Value travels only through
// a temp file — never argv, never the receipt.
const writeCustody = (repo, name, value) => {
  const tool = path.join(repo, 'scripts', 'stack-secret.mjs');
  const tmp = path.join(os.tmpdir(), `serve-ask-${crypto.randomBytes(8).toString('hex')}`);
  try {
    fs.writeFileSync(tmp, value, { mode: 0o600 });
    if (fs.existsSync(tool)) {
      const r = spawnSync(process.execPath, [tool, 'set', `dev/runtime/files/${name}`, '--from-file', tmp], { cwd: repo });
      if (r.status === 0) return { ok: true, via: 'stack-secret' };
      return { ok: false, error: String(r.stderr || r.stdout || 'stack-secret set failed').slice(0, 300) };
    }
    const dir = custodyDirs(repo)[0];
    if (!dir) return { ok: false, error: 'no custody dir (.starcistacks/.stacks dev/runtime/files)' };
    fs.copyFileSync(tmp, path.join(dir, name));
    return { ok: true, via: 'materialized-file' };
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* best effort */ }
  }
};

// Env vars go to BOTH real sinks: `.env.local` is the generated bridge the
// provision scripts read, and `.starcistacks/dev/runtime/env/app.env` is the
// canonical encrypted store (whole-file set: show → upsert → set back).
const upsertLines = (content, key, value) => {
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=.*$`, 'm');
  return re.test(content) ? content.replace(re, `${key}=${value}`) : `${content}${content && !content.endsWith('\n') ? '\n' : ''}${key}=${value}\n`;
};

const APP_ENV_REL = 'dev/runtime/env/app.env';

// Upsert one KEY=VALUE into the canonical encrypted app.env. Never `set` a
// whole env file we could not read first — an empty base would clobber every
// other key in the encrypted store.
const appEnvUpsert = (repo, key, value) => {
  const tool = path.join(repo, 'scripts', 'stack-secret.mjs');
  if (!fs.existsSync(tool)) return false;
  const tmp = path.join(os.tmpdir(), `serve-ask-env-${crypto.randomBytes(8).toString('hex')}`);
  try {
    spawnSync(process.execPath, [tool, 'show', APP_ENV_REL], { cwd: repo, stdio: 'ignore' });
    const cur = [path.join(repo, '.starcistacks', APP_ENV_REL), path.join(repo, '.stacks', APP_ENV_REL)].find(fs.existsSync);
    if (!cur) return false;
    fs.writeFileSync(tmp, upsertLines(fs.readFileSync(cur, 'utf8'), key, value), { mode: 0o600 });
    return spawnSync(process.execPath, [tool, 'set', APP_ENV_REL, '--from-file', tmp], { cwd: repo }).status === 0;
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* best effort */ }
  }
};

const writeEnv = (repo, key, value) => {
  const via = [];
  const local = path.join(repo, '.env.local');
  fs.writeFileSync(local, upsertLines(fs.existsSync(local) ? fs.readFileSync(local, 'utf8') : '', key, value), { mode: 0o600 });
  via.push('.env.local');
  if (appEnvUpsert(repo, key, value)) via.push('app.env');
  return { ok: true, via: via.join('+') };
};

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };

const renderForm = ({ nonce, question, fields, images, repo, workflowId, readonly }) => {
  const fileRows = fields.files.map((name) => {
    const present = custodyPresent(repo, name);
    const paired = fields.paired[name] ? ` · also sets <code>${esc(fields.paired[name])}</code>` : '';
    return `<label>custody file <code>runtime/files/${esc(name)}</code> → <code>${esc(pointerFor(name))}</code>${paired}${present ? ' <b style="color:#0a7">— already in custody (leave blank to keep)</b>' : ''}</label>
      <input type="password" name="file:${esc(name)}" autocomplete="off" ${readonly ? 'disabled' : ''}>`;
  }).join('\n');
  const varRows = fields.vars.map((v) => `<label><code>${esc(v)}</code></label>
      <input type="${fields.isSecret(v) ? 'password' : 'text'}" name="env:${esc(v)}" autocomplete="off" ${readonly ? 'disabled' : ''}>`).join('\n');
  const options = (question.options ?? []).map((o, i) => `<label class="opt"><input type="radio" name="option" value="${i}" ${readonly ? 'disabled' : ''}> ${esc(o)}</label>`).join('\n');
  const imgRows = (images ?? []).map((img, i) => `<figure><img src="/${esc(nonce)}/img/${i}" alt="${esc(img.label)}"><figcaption><code>${esc(img.label)}</code></figcaption></figure>`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>provision.ask — ${esc(workflowId)}</title>
<style>
 body{font:14px/1.5 system-ui;margin:2rem auto;max-width:720px;padding:0 1rem;color:#222}
 h1{font-size:1.1rem}.q{white-space:pre-wrap;background:#f6f6f6;border:1px solid #ddd;padding:1rem;border-radius:6px}
 label{display:block;margin:.9rem 0 .25rem;font-weight:600}
 input[type=text],input[type=password],textarea{width:100%;padding:.45rem;border:1px solid #bbb;border-radius:4px;box-sizing:border-box}
 figure{margin:1rem 0}figure img{max-width:100%;border:1px solid #ccc;border-radius:6px;display:block}
 figcaption{font-size:.8rem;color:#666;margin-top:.25rem}
 .opt{font-weight:400;display:block;margin:.3rem 0}
 button{margin-top:1.2rem;padding:.6rem 1.4rem;font-size:1rem;cursor:pointer}
 .note{color:#666;font-size:.85rem;margin-top:1.5rem}
</style></head><body>
<h1>Owner provision — <code>${esc(workflowId)}</code></h1>
<div class="q">${esc(question.text ?? '')}</div>
${imgRows ? `<h3>Artifacts under review</h3>${imgRows}` : ''}
${readonly ? '<p><b>This ask is already answered — view only.</b></p>' : ''}
<form method="post" action="/${esc(nonce)}/answer">
${options ? `<h3>Choose</h3>${options}` : ''}
<h3>Credentials</h3>
${fileRows}
${varRows}
<label>Note to kernel (optional)</label><textarea name="note" rows="2" ${readonly ? 'disabled' : ''}></textarea>
<button type="submit" ${readonly ? 'disabled' : ''}>Submit answer</button>
</form>
<p class="note">Secret values land in encrypted stack custody (<code>.starcistacks</code>) and are exposed through <code>*_FILE</code> pointers in <code>app.env</code> / the generated <code>.env.local</code> bridge — never in the ledger, the chat, or any log. Submitting wakes the workflow kernel.</p>
</body></html>`;
};

const wakeKernel = (ledger, { workflowId, dispatchId, receiptPath }) => {
  const db = ledger.db;
  const signal = db.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  const terminal = parseJson(signal?.value_json ?? '')?.terminal ?? null;
  if (!terminal) return { action: 'kernel-signal-absent' };
  try {
    const shown = terminalShow({ terminal });
    if (!shown?.ok || shown.connected !== true || shown.writable !== true) return { action: 'kernel-unavailable', terminal };
    const read = terminalRead({ terminal, screen: true });
    const state = read?.ok ? classifyAgentScreen(read.screen).state : null;
    if (state !== 'turn-idle') return { action: 'kernel-active', terminal, state };
    const prompt = [
      `Durable transition wake for workflow ${workflowId}: ask-answered.`,
      `The owner answered the parked ask for dispatch ${dispatchId}; sanitized receipt at ${receiptPath}.`,
      'Re-read canonical api status and survey now; re-verify custody presence for the named provisions, settle or retry the waiting ask op, then continue the approved frontier.',
      'This wake grants no new scope, path, retry or authority and must not duplicate an existing job or bypass an effect fence.',
    ].join(' ');
    const sent = terminalSend({ terminal, text: prompt, enter: true });
    if (!sent?.ok) return { action: 'kernel-wake-failed', terminal, error: sent?.error ?? null };
    ledger.transaction(() => ledger.appendEvent({
      workflowId, entityType: 'workflow', entityId: workflowId,
      kind: 'kernel-transition-woken', payload: { transition: 'ask-answered', dispatchId, terminal },
    }));
    return { action: 'kernel-woken', terminal };
  } catch (error) {
    return { action: 'kernel-wake-error', terminal, error: String(error?.message ?? error) };
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.repo || !args.workflow) { console.error('serve-ask needs --repo <path> --workflow <id>'); process.exit(2); }
  const repo = path.resolve(args.repo);
  const file = ledgerFileFor(repo);
  if (!fs.existsSync(file)) { console.error(JSON.stringify({ ok: false, error: `ledger-missing: ${file}` })); process.exit(1); }
  const ledger = openLedger({ file });
  const db = ledger.db;

  const report = db.prepare(
    `SELECT * FROM reports WHERE workflow_id=? AND outcome='ask' ${args.dispatch ? 'AND dispatch_id=?' : ''} ORDER BY report_id DESC LIMIT 1`,
  ).get(...(args.dispatch ? [args.workflow, args.dispatch] : [args.workflow]));
  if (!report) { console.error(JSON.stringify({ ok: false, error: `no pending ask report for ${args.workflow}` })); process.exit(1); }
  const answered = db.prepare(
    `SELECT 1 FROM events WHERE workflow_id=? AND kind='ask-answered' AND json_extract(payload_json,'$.dispatchId')=? LIMIT 1`,
  ).get(args.workflow, report.dispatch_id);
  const readonly = Boolean(args.review);
  if (answered && !readonly) { console.error(JSON.stringify({ ok: false, error: `ask ${report.dispatch_id} already answered` })); process.exit(1); }

  const rj = parseJson(report.report_json, {});
  const question = rj.question ?? { text: rj.summary ?? '', options: [] };
  const qText = `${question.text ?? ''}\n${(question.options ?? []).join('\n')}`;
  const fields = fieldsOf(qText);
  const images = imagesOf(qText, repo);
  const nonce = `a-${crypto.randomBytes(9).toString('hex')}`;
  const ttl = Number(args.ttl ?? DEFAULT_TTL_MS);

  let done = false;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === `/${nonce}`) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(renderForm({ nonce, question, fields, images, repo, workflowId: args.workflow, readonly }));
      return;
    }
    const imgMatch = req.method === 'GET' && url.pathname.match(new RegExp(`^/${nonce}/img/(\\d+)$`));
    if (imgMatch) {
      const img = images[Number(imgMatch[1])];
      if (!img) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(img.abs).slice(1).toLowerCase()] ?? 'application/octet-stream' });
      fs.createReadStream(img.abs).pipe(res);
      return;
    }
    if (req.method === 'POST' && url.pathname === `/${nonce}/answer`) {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 256 * 1024) req.destroy(); });
      req.on('end', () => {
        try {
        const already = db.prepare(
          `SELECT 1 FROM events WHERE workflow_id=? AND kind='ask-answered' AND json_extract(payload_json,'$.dispatchId')=? LIMIT 1`,
        ).get(args.workflow, report.dispatch_id);
        if (already) {
          res.writeHead(409, { 'content-type': 'text/html; charset=utf-8' });
          res.end('<!doctype html><meta charset="utf-8"><body style="font:14px system-ui;margin:3rem auto;max-width:560px"><h2>Already answered</h2><p>This ask was already settled — no second submission is recorded.</p></body>');
          return;
        }
        const params = new URLSearchParams(body);
        const custodyWritten = [], envWritten = [], pointersWritten = [], errors = [];
        for (const name of fields.files) {
          const pairedVar = fields.paired[name];
          const v = params.get(`file:${name}`);
          if (v == null || v === '') {
            // Blank keeps existing custody — but a paired env var still needs
            // its raw value for provision scripts, synced from the file.
            if (pairedVar && custodyPresent(repo, name)) {
              const dir = custodyDirs(repo).find((d) => fs.existsSync(path.join(d, name)));
              const val = dir ? fs.readFileSync(path.join(dir, name), 'utf8').trim() : null;
              if (val) { writeEnv(repo, pairedVar, val); envWritten.push(`${pairedVar} (from custody)`); }
            }
            continue;
          }
          const r = writeCustody(repo, name, v);
          if (!r.ok) { errors.push(`${name}: ${r.error}`); continue; }
          custodyWritten.push(`${name} (${r.via})`);
          // The file alone is unreachable — app.env must carry its <NAME>_FILE
          // pointer for the stack env convention to see it.
          const ptr = pointerFor(name);
          if (appEnvUpsert(repo, ptr, `.starcistacks/dev/runtime/files/${name}`)) pointersWritten.push(ptr);
          // The merged env var is the same value — provision scripts read it raw.
          if (pairedVar) { writeEnv(repo, pairedVar, v); envWritten.push(pairedVar); }
        }
        for (const v of fields.vars) {
          const val = params.get(`env:${v}`);
          if (val == null || val === '') continue;
          const r = writeEnv(repo, v, val);
          envWritten.push(v);
        }
        // Regenerate the .env.local managed block so fresh *_FILE pointers in
        // app.env reach the app's env loader without a manual dev:env run.
        let bridge = null;
        const devEnv = path.join(repo, 'scripts', 'dev-env.mjs');
        if (pointersWritten.length && fs.existsSync(devEnv)) {
          const r = spawnSync(process.execPath, [devEnv], { cwd: repo, stdio: 'ignore' });
          bridge = r.status === 0 ? 'refreshed' : 'refresh-failed';
        }
        const optionIdx = params.get('option');
        const receiptDir = path.join(repo, '.starciwork', 'kernel-evidence', args.workflow, 'serve-ask');
        fs.mkdirSync(receiptDir, { recursive: true });
        const receiptPath = path.join(receiptDir, `answer-${Date.now()}.json`);
        const receipt = {
          schema: 'starci/ask-answer@1',
          workflowId: args.workflow, dispatchId: report.dispatch_id, opId: report.op_id,
          option: optionIdx != null ? (question.options ?? [])[Number(optionIdx)] ?? null : null,
          custodyWritten, envWritten, pointersWritten, bridge, errors,
          note: params.get('note') || null, at: new Date().toISOString(),
        };
        fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
        ledger.transaction(() => ledger.appendEvent({
          workflowId: args.workflow, entityType: 'report', entityId: report.dispatch_id,
          kind: 'ask-answered', payload: { dispatchId: report.dispatch_id, receiptPath, custodyWritten, envWritten, pointersWritten, errors },
        }));
        const wake = wakeKernel(ledger, { workflowId: args.workflow, dispatchId: report.dispatch_id, receiptPath });
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><meta charset="utf-8"><body style="font:14px system-ui;margin:3rem auto;max-width:560px">
<h2>Answer received</h2><p>custody: ${esc(custodyWritten.join(', ') || 'none')} · env: ${esc(envWritten.join(', ') || 'none')} · pointers: ${esc(pointersWritten.join(', ') || 'none')} · wake: ${esc(wake.action)}</p>
${errors.length ? `<p style="color:#a33">errors: ${esc(errors.join('; '))}</p>` : ''}
<p>You can close this tab — the workflow kernel has been notified.</p></body>`);
        done = true;
        setTimeout(() => { server.close(); process.exit(0); }, 400).unref();
        } catch (error) {
          // A failed write must not kill the one-shot server before the owner
          // can retry — the ask stays unanswered and the form stays usable.
          res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' });
          res.end(`<!doctype html><meta charset="utf-8"><body style="font:14px system-ui;margin:3rem auto;max-width:560px">
<h2>Write failed — nothing was stored</h2><p style="color:#a33">${esc(String(error?.message ?? error))}</p>
<p>Go back and resubmit — the ask is still open.</p></body>`);
        }
      });
      return;
    }
    res.writeHead(404); res.end('not found');
  });

  server.on('error', () => tryNext());
  let port = PORT_BASE;
  const tryNext = () => {
    if (port >= PORT_BASE + PORT_SCAN) { console.error(JSON.stringify({ ok: false, error: `no free port in ${PORT_BASE}..${PORT_BASE + PORT_SCAN}` })); process.exit(1); }
    server.listen(port++, '127.0.0.1');
  };
  server.once('listening', () => {
    const bound = server.address().port;
    const url = `http://127.0.0.1:${bound}/${nonce}`;
    ledger.appendEvent({
      workflowId: args.workflow, entityType: 'report', entityId: report.dispatch_id,
      kind: 'ask-serving', payload: { dispatchId: report.dispatch_id, url, fields: { files: fields.files, vars: fields.vars }, ttlMs: ttl },
    });
    console.log(JSON.stringify({ ok: true, workflowId: args.workflow, dispatchId: report.dispatch_id, url, port: bound, ttlMs: ttl }));
  });
  tryNext();
  setTimeout(() => {
    if (done) return;
    ledger.appendEvent({ workflowId: args.workflow, entityType: 'report', entityId: report.dispatch_id, kind: 'ask-serving-expired', payload: { dispatchId: report.dispatch_id } });
    process.exit(0);
  }, ttl).unref();
};

main();
