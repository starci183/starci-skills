// `serve-ask` — renders the one pending owner question of an `outcome: ask`
// op report as a localhost form and lands the answer durably, without any
// model agent ever seeing a secret value. Spawned detached by the Kernel (or
// the launcher chat) when it parks an ask leg; exits after one submission or
// on --ttl. Port: first free in 6969 +0..100 (the owner-facing ask lane).
//
//   node serve-ask.mjs --repo <path> --workflow <id> [--dispatch <id>] [--ttl <ms>] [--json]
//
// Submit flow: custody fields named '*.key|*.txt' in the question text are
// written through <repo>/scripts/stack-secret.mjs set --from-file (the
// canonical encrypted-custody write; values never touch argv or the ledger),
// falling back to a materialized write under .starcistacks|dev/.stacks when the
// tool is absent. UPPER_SNAKE variables are upserted into <repo>/.env.local
// (the provision-script convention). A sanitized receipt (names and custody
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
    if (k === '--json') { a.json = true; continue; }
    const v = argv[++i];
    if (v === undefined) { console.error(`serve-ask: --${k.slice(2)} needs a value`); process.exit(2); }
    a[k.slice(2)] = v;
  }
  return a;
};

// The ask report names its provisions in free text; the form derives the
// entry surface from the same tokens the verifier will check: custody file
// basenames (*.key/*.txt under runtime/files) and UPPER_SNAKE env variables.
const fieldsOf = (text) => {
  const files = [...new Set([...text.matchAll(/([\w-]+\.(?:key|txt|json))/g)].map(m => m[1]))];
  const vars = [...new Set([...text.matchAll(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g)].map(m => m[0]))]
    .filter(v => !/^(JSON|HTTP|URL|API|E2E)$/.test(v));
  return {
    files,
    vars,
    isSecret: (name) => /SECRET|PASSWORD|TOKEN|KEY/i.test(name),
  };
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

// `.env.local` upsert — the same Set-EnvLine contract the provision scripts use.
const writeEnv = (repo, key, value) => {
  const file = path.join(repo, '.env.local');
  let content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const re = new RegExp(`(?m)^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=.*$`);
  content = re.test(content) ? content.replace(re, `${key}=${value}`) : `${content}${content && !content.endsWith('\n') ? '\n' : ''}${key}=${value}\n`;
  fs.writeFileSync(file, content, { mode: 0o600 });
  return { ok: true, via: '.env.local' };
};

const renderForm = ({ nonce, question, fields, repo, workflowId }) => {
  const fileRows = fields.files.map((name) => {
    const present = custodyPresent(repo, name);
    return `<label>custody file <code>runtime/files/${esc(name)}</code>${present ? ' <b style="color:#0a7">— already in custody (leave blank to keep)</b>' : ''}</label>
      <input type="password" name="file:${esc(name)}" autocomplete="off" ${present ? '' : ''}>`;
  }).join('\n');
  const varRows = fields.vars.map((v) => `<label><code>${esc(v)}</code></label>
      <input type="${fields.isSecret(v) ? 'password' : 'text'}" name="env:${esc(v)}" autocomplete="off">`).join('\n');
  const options = (question.options ?? []).map((o, i) => `<label class="opt"><input type="radio" name="option" value="${i}"> ${esc(o)}</label>`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>provision.ask — ${esc(workflowId)}</title>
<style>
 body{font:14px/1.5 system-ui;margin:2rem auto;max-width:720px;padding:0 1rem;color:#222}
 h1{font-size:1.1rem}.q{white-space:pre-wrap;background:#f6f6f6;border:1px solid #ddd;padding:1rem;border-radius:6px}
 label{display:block;margin:.9rem 0 .25rem;font-weight:600}
 input[type=text],input[type=password],textarea{width:100%;padding:.45rem;border:1px solid #bbb;border-radius:4px;box-sizing:border-box}
 .opt{font-weight:400;display:block;margin:.3rem 0}
 button{margin-top:1.2rem;padding:.6rem 1.4rem;font-size:1rem;cursor:pointer}
 .note{color:#666;font-size:.85rem;margin-top:1.5rem}
</style></head><body>
<h1>Owner provision — <code>${esc(workflowId)}</code></h1>
<div class="q">${esc(question.text ?? '')}</div>
<form method="post" action="/${esc(nonce)}/answer">
${options ? `<h3>Choose</h3>${options}` : ''}
<h3>Credentials</h3>
${fileRows}
${varRows}
<label>Note to kernel (optional)</label><textarea name="note" rows="2"></textarea>
<button type="submit">Submit answer</button>
</form>
<p class="note">Values are written to encrypted custody / .env.local on this machine only — they never enter the ledger, the chat, or any log. Submitting wakes the workflow kernel.</p>
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
  if (answered) { console.error(JSON.stringify({ ok: false, error: `ask ${report.dispatch_id} already answered` })); process.exit(1); }

  const rj = parseJson(report.report_json, {});
  const question = rj.question ?? { text: rj.summary ?? '', options: [] };
  const fields = fieldsOf(`${question.text ?? ''}\n${(question.options ?? []).join('\n')}`);
  const nonce = `a-${crypto.randomBytes(9).toString('hex')}`;
  const ttl = Number(args.ttl ?? DEFAULT_TTL_MS);

  let done = false;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === `/${nonce}`) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(renderForm({ nonce, question, fields, repo, workflowId: args.workflow }));
      return;
    }
    if (req.method === 'POST' && url.pathname === `/${nonce}/answer`) {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 256 * 1024) req.destroy(); });
      req.on('end', () => {
        const params = new URLSearchParams(body);
        const custodyWritten = [], envWritten = [], errors = [];
        for (const name of fields.files) {
          const v = params.get(`file:${name}`);
          if (v == null || v === '') continue;
          const r = writeCustody(repo, name, v);
          (r.ok ? custodyWritten : errors).push(r.ok ? `${name} (${r.via})` : `${name}: ${r.error}`);
        }
        for (const v of fields.vars) {
          const val = params.get(`env:${v}`);
          if (val == null || val === '') continue;
          const r = writeEnv(repo, v, val);
          envWritten.push(v);
        }
        const optionIdx = params.get('option');
        const receiptDir = path.join(repo, '.starciwork', 'kernel-evidence', args.workflow, 'serve-ask');
        fs.mkdirSync(receiptDir, { recursive: true });
        const receiptPath = path.join(receiptDir, `answer-${Date.now()}.json`);
        const receipt = {
          schema: 'starci/ask-answer@1',
          workflowId: args.workflow, dispatchId: report.dispatch_id, opId: report.op_id,
          option: optionIdx != null ? (question.options ?? [])[Number(optionIdx)] ?? null : null,
          custodyWritten, envWritten, errors,
          note: params.get('note') || null, at: new Date().toISOString(),
        };
        fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
        ledger.transaction(() => ledger.appendEvent({
          workflowId: args.workflow, entityType: 'report', entityId: report.dispatch_id,
          kind: 'ask-answered', payload: { dispatchId: report.dispatch_id, receiptPath, custodyWritten, envWritten, errors },
        }));
        const wake = wakeKernel(ledger, { workflowId: args.workflow, dispatchId: report.dispatch_id, receiptPath });
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><meta charset="utf-8"><body style="font:14px system-ui;margin:3rem auto;max-width:560px">
<h2>Answer received</h2><p>custody: ${esc(custodyWritten.join(', ') || 'none')} · env: ${esc(envWritten.join(', ') || 'none')} · wake: ${esc(wake.action)}</p>
${errors.length ? `<p style="color:#a33">errors: ${esc(errors.join('; '))}</p>` : ''}
<p>You can close this tab — the workflow kernel has been notified.</p></body>`);
        done = true;
        setTimeout(() => { server.close(); process.exit(0); }, 400).unref();
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
