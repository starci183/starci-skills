// ingress-publish.mjs - `starci app stack ingress publish`: puts the app's own routes file (deploy.ingress.routes) into the dynamic directory the
// shared ingress serves, under `publish.file`, and retires the old generic file(s) listed in `publish.supersedes`. The directory is shared with
// tenants that write their own files: those files are NEVER touched; the only remote writes and removals are `publish.file`, its `.tmp` upload
// name and the superseded names.
//   Preconditions (all or nothing): the routes file parses, no router or service name clashes with a tenant file, the ingress service runs, the old
//   edge does not, every service of the app stack is healthy, the age recipient and the backup directory exist.
//   --execute: baseline of every host -> age backup of each superseded file -> upload as <file>.tmp (ignored by the file provider because of its
//   extension) -> ONE remote command swaps it in and removes the superseded files -> every host is verified (declared status exact, otherwise the
//   baseline status class; a new host must answer 2xx-4xx; certificates of known hosts unchanged) -> any failure restores the superseded files from
//   memory and re-verifies the baseline (RESTORED ok / RESTORE FAILED (manual: ...)).
// Route files may carry header values or tokens: they are held in memory only and NEVER printed; lines carry names, hosts and statuses.
import fs from 'node:fs';
import path from 'node:path';
import { isPlainObject as plain } from '../runtime/engine/plain-object.mjs';
import { parseYaml } from '../runtime/engine/yaml.mjs';
import { firstLine } from './context.mjs';
import { refusal } from './errors.mjs';
import { remoteDocker, shellQuote } from './remote.mjs';

const FILE_MARK = /^#@@FILE (.+)$/mu;
const HEALTHY = /^([1-9]\d*)\/\1$/u;
const VERIFY_ATTEMPTS = 6;
const VERIFY_MS = 2000;

const asMap = (value) => (plain(value) ? value : {});
const classOf = (code) => Math.floor(code / 100);
const answers = (code) => code >= 200 && code < 500;
const label = (target) => `${target.host}${target.path}`;
const result = (ok, lines, steps, extra = {}) => ({ ok, lines, data: { ok, steps, ...extra } });
const quote = (value) => shellQuote(value);
const shScript = (script) => `sh -c ${quote(script)}`;

/** The app's own routes file: { text, routers, services } or { error }. */
function readOwn(config, ingress) {
  let text = '';
  let doc = null;
  try {
    text = fs.readFileSync(path.join(config.envDir, ingress.routes), 'utf8');
    doc = parseYaml(text);
  } catch {
    return { error: `${ingress.routes} cannot be read as YAML` };
  }
  const http = doc?.http;
  if (!plain(http) || !plain(http.routers) || !plain(http.services)) return { error: `${ingress.routes} needs http.routers and http.services mappings` };
  return { text, routers: Object.keys(http.routers), services: Object.keys(http.services) };
}

/** The route files of the live directory: Map name -> text (listing only; the contents are never printed). */
function readFiles(run, kit, dir) {
  const listed = run(kit.liveCommand(dir));
  if (listed.status !== 0) return { error: `cannot read ${dir} on the manager: ${firstLine(listed.stderr)}` };
  const parts = String(listed.stdout).split(FILE_MARK);
  const files = new Map();
  for (let index = 1; index < parts.length; index += 2) files.set(parts[index], parts[index + 1]);
  return { files };
}

/** Router and service names of the other files that the own file would collide with (superseded files and the target are ignored). */
function clashes(files, own, ignore) {
  const found = [];
  const unreadable = [];
  for (const [name, body] of files) {
    if (ignore.has(name)) continue;
    let doc = null;
    try { doc = parseYaml(body); } catch { unreadable.push(name); continue; }
    const http = asMap(asMap(doc).http);
    for (const router of Object.keys(asMap(http.routers))) if (own.routers.includes(router)) found.push(`router ${router} (${name})`);
    for (const service of Object.keys(asMap(http.services))) if (own.services.includes(service)) found.push(`service ${service} (${name})`);
  }
  return { found, unreadable };
}

/** Every service of the app stack is N/N with N >= 1. */
function stackHealth(run, stack) {
  const listed = remoteDocker(run, ['stack', 'services', stack, '--format', '{{.Name}} {{.Replicas}}']);
  const rows = String(listed.stdout).split('\n').map((line) => line.trim()).filter(Boolean).map((line) => line.split(' '));
  const unhealthy = rows.filter(([, replicas]) => !HEALTHY.test(replicas ?? '')).map(([name]) => name);
  return { ok: listed.status === 0 && rows.length > 0 && unhealthy.length === 0, unhealthy, count: rows.length };
}

function recipientOf(kit, config) {
  try {
    return { recipient: kit.readRecipient(config.repoRoot) };
  } catch (error) {
    return { error: error.message };
  }
}

const legacyRunning = (run, ingress) => String(remoteDocker(run, ['inspect', '--format', '{{.State.Running}}', ingress.legacy.container]).stdout).trim() === 'true';

function preconditions(run, config, ingress, kit, context) {
  const { own, live, recipient } = context;
  const ignore = new Set([ingress.publish.file, ...ingress.publish.supersedes]);
  const swarm = remoteDocker(run, ['info', '--format', '{{.Swarm.LocalNodeState}} {{.Swarm.ControlAvailable}}']);
  const service = kit.serviceState(run, `${ingress.name}_${ingress.service}`);
  const health = stackHealth(run, config.stack);
  const clash = (own.error || live.error) ? { found: [], unreadable: [] } : clashes(live.files, own, ignore);
  const checks = [
    [`${ingress.routes} parses with routers and services`, !own.error, own.error],
    [`${ingress.legacy.dynamicDir} is readable`, !live.error, live.error],
    ['no router or service name clashes with a file of another tenant', clash.found.length === 0, clash.found.join(', ')],
    ['every other file of the directory can be checked', clash.unreadable.length === 0, `not valid YAML: ${clash.unreadable.join(', ')}`],
    ['swarm active (manager)', swarm.status === 0 && String(swarm.stdout).trim() === 'active true', 'this host is not an active swarm manager'],
    [`ingress service ${ingress.name}_${ingress.service} is running`, service.desired >= 1 && service.running >= 1, 'run the takeover first'],
    [`old edge ${ingress.legacy.container} is not running`, !legacyRunning(run, ingress), 'an old edge watching the same directory would load the new file too'],
    [`every service of the stack ${config.stack} is healthy`, health.ok, health.count === 0 ? 'no service listed' : `not healthy: ${health.unhealthy.join(', ')}`],
    ['age recipient and backup directory declared', recipient.error === undefined && ingress.backup !== null, recipient.error ?? 'declare deploy.ingress.backup'],
  ];
  return checks.map(([name, ok, detail]) => ({ name, ok, detail }));
}

// ---- remote writes: only publish.file, its .tmp and the superseded names ------------------------------------------------------------------

const remoteFile = (ingress, name) => `${ingress.legacy.dynamicDir}/${name}`;

function readRemote(run, ingress, name) {
  const read = run(`cat -- ${quote(remoteFile(ingress, name))}`);
  return read.status === 0 ? String(read.stdout) : null;
}

/** Uploads `content` as <name>.tmp (never a route file name: the file provider ignores it). Returns an error text or null. */
function upload(run, ingress, name, content) {
  const tmp = remoteFile(ingress, `${name}.tmp`);
  const done = run(shScript(`umask 022 && cat > ${quote(tmp)}`), { input: content });
  return done.status === 0 ? null : `uploading ${name}.tmp FAILED: ${firstLine(done.stderr)}`;
}

/** Moves each <name>.tmp over <name> and removes the given files in ONE remote command. */
function swapIn(run, ingress, moves, removals) {
  const steps = moves.map((name) => {
    const tmp = remoteFile(ingress, `${name}.tmp`);
    return `mv -f ${quote(tmp)} ${quote(remoteFile(ingress, name))}`;
  });
  steps.push(`rm -f ${removals.map((name) => quote(remoteFile(ingress, name))).join(' ')}`);
  const done = run(shScript(steps.join(' && ')));
  return done.status === 0 ? null : firstLine(done.stderr);
}

/** Age-encrypted copy of one file into the backup directory, fed through stdin (the content never touches argv). */
function backupOne(ctx, run, ingress, kit, { recipient, name, content }) {
  const dir = ingress.backup.dir;
  const file = `${dir}/${name}-${kit.stampOf(ctx.now())}.age`;
  const script = ['umask 077', `mkdir -p ${quote(dir)}`, `age -r ${quote(recipient)} -o ${quote(file)}`, `test -s ${quote(file)}`].join(' && ');
  const done = run(`bash -c ${quote(script)}`, { input: content });
  return done.status === 0 ? { file } : { error: `backup of ${name} FAILED: ${firstLine(done.stderr)}` };
}

// ---- verification -----------------------------------------------------------------------------------------------------------------------

/** After the swap: a declared status is exact; otherwise the baseline class; a host without a baseline answer must answer 2xx-4xx; known certificates unchanged. */
function forwardOk(entry, seen) {
  let statusOk = answers(seen.code);
  if (entry.target.status !== null) statusOk = seen.code === entry.target.status;
  else if (answers(entry.code)) statusOk = classOf(seen.code) === classOf(entry.code);
  return statusOk && (entry.certificate === null || seen.certificate === entry.certificate);
}

/** After a restore: every host that answered before answers in the same class with the same certificate. */
const restoreOk = (entry, seen) => classOf(seen.code) === classOf(entry.code) && seen.certificate === entry.certificate;

function certificateState(entry, seen) {
  if (entry.certificate === null) return 'new';
  return seen.certificate === entry.certificate ? 'equal' : 'different';
}

function verify(ctx, run, kit, entries, accept) {
  return kit.settle(ctx, VERIFY_ATTEMPTS, VERIFY_MS, () => {
    const rows = entries.map((entry) => {
      const seen = kit.observe(run, entry.target);
      return { entry, code: seen.code, same: certificateState(entry, seen), ok: accept(entry, seen) };
    });
    return { ok: rows.every((row) => row.ok), rows };
  });
}

function rowLine(row) {
  return `${row.ok ? 'ok' : 'MISMATCH'} ${label(row.entry.target)}: status ${row.code} (baseline ${row.entry.code}), certificate serial ${row.same}`;
}

const hostsData = (rows) => rows.map((row) => ({ host: row.entry.target.host, path: row.entry.target.path, status: row.code, certificate: row.same }));

/** Writes the superseded files back from memory (same atomic swap, deleting publish.file) and re-verifies the baseline. */
async function restore(ctx, run, ingress, kit, context) {
  const { contents, base, steps } = context;
  const names = [...contents.keys()];
  const failedUpload = names.map((name) => upload(run, ingress, name, contents.get(name))).find((error) => error !== null);
  const failedSwap = failedUpload ?? swapIn(run, ingress, names, [ingress.publish.file]);
  steps.push('restore');
  const manual = `RESTORE FAILED (manual: encrypted backups in ${ingress.backup.dir})`;
  if (failedSwap) return { ok: false, line: manual };
  const proof = await verify(ctx, run, kit, base.filter((entry) => answers(entry.code)), restoreOk);
  steps.push('restore-verify');
  return proof.ok ? { ok: true, line: 'RESTORED ok: the superseded files are back and every host answers as before' } : { ok: false, line: manual };
}

async function apply(ctx, run, ingress, kit, context) {
  const { own, base, lines, steps, contents, backups } = context;
  const uploadError = upload(run, ingress, ingress.publish.file, own.text);
  steps.push('upload');
  if (uploadError) return result(false, [...lines, uploadError, 'publish refused: nothing was changed'], steps);
  lines.push(`uploaded ${ingress.publish.file}.tmp`);
  const swapError = swapIn(run, ingress, [ingress.publish.file], [...contents.keys()]);
  steps.push('swap');
  const proof = swapError ? { ok: false, rows: [] } : await verify(ctx, run, kit, base, forwardOk);
  steps.push('verify');
  lines.push(...proof.rows.map(rowLine));
  if (!swapError && proof.ok) {
    lines.push(`published ${ingress.publish.file}; retired ${[...contents.keys()].join(', ') || 'nothing'}; ${proof.rows.length} host(s) verified`);
    return result(true, lines, steps, { backups, hosts: hostsData(proof.rows), restored: null });
  }
  lines.push(swapError ? `swap FAILED: ${swapError}` : 'verification FAILED');
  const back = await restore(ctx, run, ingress, kit, { contents, base, steps });
  lines.push(back.line);
  return result(false, lines, steps, { backups, hosts: hostsData(proof.rows), restored: back.ok ? 'ok' : 'failed' });
}

/** Reads and backs up every superseded file that exists; returns { contents, backups } or { error }. */
function retire(ctx, run, ingress, kit, { recipient, names }) {
  const contents = new Map();
  const backups = [];
  for (const name of names) {
    const content = readRemote(run, ingress, name);
    if (content === null) continue;
    const saved = backupOne(ctx, run, ingress, kit, { recipient, name, content });
    if (saved.error) return { error: saved.error };
    contents.set(name, content);
    backups.push(saved.file);
  }
  return { contents, backups };
}

/** `ingress publish`: see the top of the file. `kit` carries the shared probe helpers of ingress.mjs. */
export async function publishIngress(ctx, run, config, ingress, execute, kit) {
  if (ingress.publish === null) throw refusal('STACK_INGRESS_PUBLISH_UNDECLARED', 'deploy.ingress.publish ({ file, supersedes }) is not declared: nothing to publish');
  if (ingress.routes === null) throw refusal('STACK_INGRESS_PUBLISH_NO_ROUTES', 'deploy.ingress.routes is not declared: there is no routes file to publish');
  const steps = ['preconditions'];
  const own = readOwn(config, ingress);
  const live = readFiles(run, kit, ingress.legacy.dynamicDir);
  const { recipient, error } = recipientOf(kit, config);
  const checks = preconditions(run, config, ingress, kit, { own, live, recipient: { error } });
  const lines = checks.map((check) => (check.ok ? `precondition ok: ${check.name}` : `precondition FAILED: ${check.name} (${check.detail})`));
  if (checks.some((check) => !check.ok)) return result(false, [...lines, 'publish refused: nothing was changed'], steps);
  const present = ingress.publish.supersedes.filter((name) => live.files.has(name));
  if (readRemote(run, ingress, ingress.publish.file) === own.text && present.length === 0) return result(true, [...lines, `nothing to do: ${ingress.publish.file} is current and no superseded file exists`], steps, { changed: false });
  const base = kit.baselines(run, kit.targets(config, ingress));
  steps.push('baseline');
  for (const entry of base) lines.push(`baseline ${label(entry.target)}: status ${entry.code}`);
  if (!execute) {
    lines.push(`dry run: would back up ${present.join(', ') || 'no superseded file'} (age) to ${ingress.backup.dir}, upload ${ingress.publish.file}, swap it in, retire ${present.join(', ') || 'nothing'} and verify ${base.length} host(s), restoring on any failure`);
    return result(true, lines, steps, { changed: false });
  }
  const retired = retire(ctx, run, ingress, kit, { recipient, names: present });
  if (retired.error) return result(false, [...lines, retired.error, 'publish refused: nothing was changed'], steps);
  steps.push('backup');
  lines.push(`backups written: ${retired.backups.join(', ') || 'none needed'}`);
  return apply(ctx, run, ingress, kit, { own, base, lines, steps, ...retired });
}
