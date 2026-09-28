#!/usr/bin/env node
// contract-capture.mjs — capture the harness data contract's fixtures (ui/fixtures/*.json) from a running status API,
// read-only (GET only), and validate every response against the contract shapes (ui/contract-shapes.mjs).
//
//   node ui/contract-capture.mjs --base http://127.0.0.1:4546 [--base2 <url> [--prefer2 <name,...>]] [--project nivo]
//        [--workflow <wf>] [--out ui/fixtures] [--check] [--json]
//
// --base2 names a second server (e.g. this checkout's ui/server.mjs on a spare port, started with
// STARCI_STATUS_OFFLINE=1 STARCI_STATUS_LOG_SYNC=0 so it writes nothing) asked for the endpoints --base does not
// serve (404); --prefer2 asks it first for the named fixtures (a newer server's fields). --check validates only and writes nothing. Every string is redacted with the runtime's secret patterns
// (scripts/kernel/typed-logs.mjs redactData) and long arrays are trimmed to a few items, so a fixture shows the shape,
// never bulk data. A fixture file is {endpoint, capturedAt, source, status, contentType, body} (a stream: events[]).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECRET_KEY, redactData } from '../scripts/kernel/typed-logs.mjs';
import { ENDPOINTS, validateEndpoint } from './contract-shapes.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const argsOf = (argv) => { const a = {}; for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (!k.startsWith('--')) continue; const n = k.slice(2); if (['check', 'json'].includes(n)) a[n] = true; else a[n] = argv[++i]; } return a; };
const ARRAY_KEEP = 4;

/**
 * `value` with every string redacted (the runtime's secret patterns) and a secret-named key's string value blanked;
 * numbers and booleans are data, never secrets (a verdict count keyed `pass` stays a number).
 */
export function redactFixture(value, key = null, depth = 0) {
  if (depth > 40) return value;
  if (typeof value === 'string') return key && SECRET_KEY.test(key) ? '[redacted]' : redactData(value, key);
  if (Array.isArray(value)) return value.map((v) => redactFixture(v, null, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactFixture(v, k, depth + 1)]));
  return value;
}

/** `value` with arrays trimmed to `keep` items (deep), keeping the first ones: a fixture shows shape, not volume. */
export function trimDeep(value, keep = ARRAY_KEEP, depth = 0) {
  if (Array.isArray(value)) return value.slice(0, keep).map((v) => trimDeep(v, keep, depth + 1));
  if (value && typeof value === 'object' && depth < 40) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, trimDeep(v, k === 'lines' || k === 'hunks' ? 2 : keep, depth + 1)]));
  if (typeof value === 'string' && value.length > 600) return `${value.slice(0, 600)}…`;
  return value;
}

async function getJson(base, url) {
  const res = await fetch(new URL(url, base), { signal: AbortSignal.timeout(90_000) });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
  return { status: res.status, contentType: res.headers.get('content-type'), body };
}

/** The first events of an SSE stream within `ms`: [{id, data}]. */
async function getStream(base, url, ms = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const events = [];
  let status = 0, contentType = null;
  try {
    const res = await fetch(new URL(url, base), { signal: controller.signal });
    status = res.status; contentType = res.headers.get('content-type');
    const reader = res.body.getReader();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += Buffer.from(value).toString('utf8');
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const id = /^id: (.*)$/m.exec(block)?.[1] ?? null, data = /^data: (.*)$/m.exec(block)?.[1];
        if (data) events.push({ id, data: JSON.parse(data) });
      }
      if (events.length >= 6) break;
    }
  } catch (error) { if (error?.name !== 'AbortError') throw error; }
  finally { clearTimeout(timer); controller.abort(); }
  return { status, contentType, events };
}

async function main() {
  const a = argsOf(process.argv.slice(2));
  if (!a.base) { console.error('use: node ui/contract-capture.mjs --base <url> [--base2 <url>] [--project <id>] [--workflow <wf>] [--out <dir>] [--check] [--json]'); process.exit(2); }
  const out = path.resolve(a.out ?? path.join(root, 'fixtures'));
  const snap = await getJson(a.base, '/api/snapshot');
  const project = snap.body.projects.find((p) => p.id === (a.project ?? 'nivo')) ?? snap.body.projects[0];
  const wf = project.workflows.find((w) => w.id === a.workflow) ?? project.workflows.find((w) => w.recentVerdicts.length) ?? project.workflows[0];
  if (!wf) throw new Error(`project ${project.id} has no running workflow to capture`);
  const q = (o) => new URLSearchParams(o).toString();
  const arts = await getJson(a.base, `/api/artifacts?${q({ project: project.id, workflow: wf.id })}`);
  const patchJob = arts.body?.jobs?.find((j) => j.byKind?.patch)?.jobId ?? wf.recentVerdicts[0]?.jobId;
  const proofOp = wf.recentVerdicts[0]?.op ?? wf.legs[0]?.op;
  const agents = await getJson(a.base, '/api/agents');
  const opAgent = agents.body?.agents?.find((x) => x.role === 'op' && x.terminal);
  const history = await getJson(a.base, `/api/history?${q({ project: project.id })}`);
  const commit = history.body?.commits?.find((c) => c.hasCode) ?? history.body?.commits?.[0];
  const requests = [
    ['snapshot', '/api/snapshot'],
    ['contract', '/api/contract'],
    ['agents', '/api/agents'],
    ...(opAgent ? [['agent-log', `/api/agents/${opAgent.terminal}/log`], ['agent-changes', `/api/agents/${opAgent.id}/changes`]] : []),
    ['evidence', '/api/evidence?limit=6'],
    ['history', `/api/history?${q({ project: project.id })}`],
    ...(commit ? [['history-commit', `/api/history/${project.id}/${commit.repository}/${commit.sha}`]] : []),
    ['proofs', `/api/proofs?${q({ project: project.id, workflow: wf.id, op: proofOp })}`],
    ['artifacts', `/api/artifacts?${q({ project: project.id, workflow: wf.id })}`],
    ['workflow-events', `/api/workflow-events?${q({ project: project.id, workflow: wf.id })}`],
    ['logs', `/api/logs?${q({ project: project.id, workflow: wf.id, limit: 400 })}`],
    ...(patchJob ? [['diff', `/api/diff?${q({ project: project.id, job: patchJob })}`]] : []),
    ['coverage', `/api/coverage?${q({ project: project.id, workflow: wf.id })}`],
    ['verify-proofs', `/api/verify-proofs?${q({ project: project.id, workflow: wf.id })}`],
    ['supervisor-state', '/api/supervisor/state'],
    ['supervisor-logs', '/api/supervisor/logs?limit=400'],
    ['workflow', `/api/workflow?${q({ id: wf.id, project: project.id })}`],
    ['system', '/api/system'],
  ];
  const streams = [
    ['workflow-events-stream', `/api/workflow-events/stream?${q({ project: project.id, workflow: wf.id })}`],
    ['logs-stream', `/api/logs/stream?${q({ project: project.id, workflow: wf.id, limit: 5 })}`],
    ['supervisor-logs-stream', '/api/supervisor/logs/stream?limit=5'],
  ];
  const results = [];
  let currentName = null;
  const fetchBoth = async (fn, url) => {
    const prefer2 = Boolean(a.base2) && String(a.prefer2 ?? '').split(',').includes(currentName);
    let r = await fn(prefer2 ? a.base2 : a.base, url), source = prefer2 ? a.base2 : a.base;
    if ((r.status === 404 || r.status === 0 || r.status >= 500) && a.base2) { r = await fn(a.base2, url); source = a.base2; }
    return { ...r, source };
  };
  for (const [name, url] of requests) {
    currentName = name;
    const r = await fetchBoth(getJson, url);
    const errors = r.status === 200 ? validateEndpoint(name, r.body) : [`HTTP ${r.status}`];
    results.push({ name, url, status: r.status, source: r.source, errors });
    if (!a.check && r.status === 200) write(out, name, { endpoint: url, capturedAt: new Date().toISOString(), source: new URL(r.source).host, status: r.status, contentType: r.contentType, body: trimDeep(redactFixture(r.body)) });
  }
  for (const [name, url] of streams) {
    currentName = name;
    const r = await fetchBoth(getStream, url);
    const item = name === 'logs-stream' || name === 'supervisor-logs-stream' ? 'log-row' : 'workflow-event';
    const errors = r.status === 200 ? r.events.flatMap((e, i) => validateEndpoint(item, e.data).map((m) => `event ${i}: ${m}`)) : [`HTTP ${r.status}`];
    results.push({ name, url, status: r.status, source: r.source, events: r.events.length, errors });
    if (!a.check && r.status === 200) write(out, name, { endpoint: url, capturedAt: new Date().toISOString(), source: new URL(r.source).host, status: r.status, contentType: r.contentType, events: r.events.map((e) => ({ id: e.id, data: trimDeep(redactFixture(e.data)) })) });
  }
  const bad = results.filter((r) => r.errors.length);
  if (a.json) console.log(JSON.stringify({ ok: !bad.length, project: project.id, workflow: wf.id, out: a.check ? null : out, results }, null, 2));
  else for (const r of results) console.log(`${r.errors.length ? 'FAIL' : 'ok  '} ${r.name.padEnd(24)} ${r.status} ${r.source}${r.errors.length ? `\n     ${r.errors.slice(0, 12).join('\n     ')}` : ''}`);
  if (bad.length) process.exitCode = 1;
}

function write(out, name, doc) {
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `${name}.json`), `${JSON.stringify(doc, null, 2)}\n`);
}

export { ENDPOINTS };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error?.stack ?? error); process.exit(1); });
