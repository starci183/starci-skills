import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { V22_CONTRACT } from './validate-request.mjs';
import { validateSession } from './validate-session.mjs';
import { withSessionLock } from './session-lock.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const digest = async file => hash(await readFile(file));
const slash = value => value.replaceAll('\\', '/');
const within = (parent, child) => { const rel = path.relative(parent, child); return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); };
const stateHash = state => { const { lifecycle, ...proof } = state; return hash(JSON.stringify(proof)); };
const json = async file => JSON.parse(await readFile(file, 'utf8'));
async function atomicWrite(file, bytes) { const temp = `${file}.${randomUUID()}.tmp`; await writeFile(temp, bytes); await rename(temp, file); }

async function confinedFile(base, ref) {
  if (typeof ref !== 'string' || !ref || path.isAbsolute(ref)) throw new Error(`RETENTION_PATH: ${ref}`);
  const file = path.resolve(base, ref);
  if (!within(base, file) || !existsSync(file) || !(await lstat(file)).isFile() || !within(await realpath(base), await realpath(file))) throw new Error(`RETENTION_MISSING: ${ref}`);
  return file;
}

async function retainedFiles(session, state) {
  const retained = new Set();
  const add = async ref => { await confinedFile(session, ref); retained.add(slash(ref)); };
  const walk = async ref => {
    const folder = path.resolve(session, ref);
    if (!within(session, folder) || !within(await realpath(session), await realpath(folder)) || (await lstat(folder)).isSymbolicLink()) throw new Error(`RETENTION_PATH: ${ref}`);
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const child = slash(path.join(ref, entry.name));
      if (entry.isSymbolicLink()) throw new Error(`RETENTION_PATH: symbolic link ${child}`);
      if (entry.isDirectory()) await walk(child); else await add(child);
    }
  };
  const inputRefs = new Set();
  for (const attempt of Object.values(state.attempts ?? {})) {
    await add(attempt.requestRef);
    const requestFile = await confinedFile(session, attempt.requestRef);
    const request = await json(requestFile);
    const branchRef = slash(path.relative(session, path.dirname(path.dirname(requestFile))));
    // Request/response folders retain proof, linked render assets and frozen sidecars.
    // Operational caches live elsewhere and are not archived.
    await walk(`${branchRef}/request`);
    if (!attempt.responseRef) throw new Error(`RETENTION_MISSING: terminal attempt ${attempt.id} has no responseRef`);
    await add(attempt.responseRef);
    await walk(`${branchRef}/response`);
    for (const frozen of request.frozenInputs ?? []) await add(`${branchRef}/${frozen.ref}`);
    for (const ref of Object.values(request.inputs ?? {})) inputRefs.add(ref);
  }
  for (const planned of Object.values(state.planned ?? {})) for (const ref of Object.values(planned.inputs ?? {})) inputRefs.add(ref);
  const copiedImports = new Set();
  for (const ref of inputRefs) {
    await add(ref);
    const cell = /^(step-\d+\/parallel-\d+)(?:\/|$)/.exec(slash(ref))?.[1];
    if (cell && existsSync(path.join(session, cell, 'import.json')) && !copiedImports.has(cell)) { await walk(cell); copiedImports.add(cell); }
  }
  if (existsSync(path.join(session, 'scope-draft.json'))) await add('scope-draft.json');
  return [...retained].sort();
}

function compactText(state) {
  return [`# ${state.id}`, `- Closed: ${state.lifecycle.closedAt}`, `- Host: ${state.hostBinding.kind} ${state.hostBinding.hostId}`, `- Worktree: ${state.hostBinding.worktree}`, `- Goal v${state.mission.version}: ${state.mission.goal}`, `- Target: ${state.mission.target}`, `- Scope: ${state.mission.includes.join('; ')}`, `- Outputs: ${state.mission.outputs.join('; ')}`, `- Proven: ${state.brief.proven.join('; ')}`, `- Verification reach: ${state.mission.verification}`, `- Evidence: ${state.id}/bundle (retention.json records hashes and original input refs)`, `- Close reason: ${state.lifecycle.closeReason}`, ''].join('\n');
}

export async function verifyRetention(doneDir, manifest, sourceState = null) {
  doneDir = path.resolve(doneDir);
  if (manifest.contractVersion !== V22_CONTRACT || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('RETENTION_INVALID: contract or files');
  if (sourceState && (manifest.sessionId !== sourceState.id || manifest.sourceStateHash !== stateHash(sourceState))) throw new Error('RETENTION_CONFLICT: existing archive belongs to different session proof');
  const seen = new Set();
  for (const item of manifest.files) {
    if (seen.has(item.ref)) throw new Error(`RETENTION_INVALID: duplicate ${item.ref}`);
    seen.add(item.ref);
    if (await digest(await confinedFile(doneDir, item.ref)) !== item.sha256) throw new Error(`RETENTION_CHANGED: ${item.ref}`);
  }
  if (!seen.has('bundle/state.json') || !seen.has('compact.md')) throw new Error('RETENTION_MISSING: state or compact');
  const archived = await json(path.join(doneDir, 'bundle', 'state.json'));
  if (archived.id !== manifest.sessionId || stateHash(archived) !== manifest.sourceStateHash || archived.lifecycle?.phase !== 'closed-success') throw new Error('RETENTION_CONFLICT: archived state does not match its manifest');
  return archived;
}

// A non-destructive retention primitive also used to recover an interrupted close.
export async function retainSessionBundle(session, state, reason) {
  session = path.resolve(session);
  const doneRoot = path.join(path.dirname(path.dirname(session)), 'done');
  const doneDir = path.join(doneRoot, state.id);
  const compact = path.join(doneRoot, `${state.id}.md`);
  if (!within(doneRoot, doneDir) || path.dirname(doneDir) !== doneRoot || state.id !== path.basename(session)) throw new Error('RETENTION_PATH: session id must be one path segment');
  await mkdir(doneRoot, { recursive: true });
  let manifest;
  if (existsSync(doneDir)) {
    manifest = await json(path.join(doneDir, 'retention.json'));
    await verifyRetention(doneDir, manifest, state);
    if (manifest.sourceSession !== slash(session)) throw new Error('RETENTION_CONFLICT: source session path differs');
  } else {
    const partial = path.join(doneRoot, `.${state.id}.${randomUUID()}.partial`);
    await mkdir(path.join(partial, 'bundle'), { recursive: true });
    const closedAt = new Date().toISOString();
    const closed = { ...state, lifecycle: { ...state.lifecycle, phase: 'closed-success', closedAt, closeReason: reason, compactRef: `../${state.id}.md` } };
    const files = [];
    for (const ref of await retainedFiles(session, state)) {
      const source = await confinedFile(session, ref);
      const before = await digest(source);
      const target = path.join(partial, 'bundle', ref);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(source, target);
      if (await digest(target) !== before || await digest(source) !== before) throw new Error(`RETENTION_CHANGED: ${ref} while copying; active session retained`);
      files.push({ ref: `bundle/${ref}`, sha256: before });
    }
    await writeFile(path.join(partial, 'bundle', 'state.json'), `${JSON.stringify(closed, null, 2)}\n`);
    await writeFile(path.join(partial, 'compact.md'), compactText(closed));
    for (const ref of ['bundle/state.json', 'compact.md']) files.push({ ref, sha256: await digest(path.join(partial, ref)) });
    manifest = { contractVersion: V22_CONTRACT, sessionId: state.id, sourceSession: slash(session), sourceStateHash: stateHash(state), compactRef: `../${state.id}.md`, files, inputRefs: [...new Set(Object.values(state.planned ?? {}).flatMap(row => Object.values(row.inputs ?? {})))], createdAt: closedAt };
    await writeFile(path.join(partial, 'retention.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    await verifyRetention(partial, manifest, state);
    await rename(partial, doneDir);
  }
  // Recover a crash after archive rename but before the sibling compact was written.
  await atomicWrite(compact, await readFile(path.join(doneDir, 'compact.md')));
  if (await digest(compact) !== manifest.files.find(item => item.ref === 'compact.md').sha256) throw new Error('RETENTION_CHANGED: compact');
  await verifyRetention(doneDir, manifest, state);
  return { doneDir, compact, bundle: path.join(doneDir, 'bundle'), manifest };
}

function closeErrors(session, state) {
  if (state.id !== path.basename(session) || state.contractVersion !== V22_CONTRACT) throw new Error('cleanup target id/contract must match its active session');
  if (state.status !== 'done') throw new Error(`session status is ${state.status}; blocked or failed sessions remain resumable`);
  if (!['active','closing'].includes(state.lifecycle?.phase)) throw new Error(`session lifecycle ${state.lifecycle?.phase} cannot close-success`);
  if ((state.workerSlots ?? []).length || Object.keys(state.leases ?? {}).length) throw new Error('session still has active worker/resource leases');
  if (Object.values(state.attempts ?? {}).some(attempt => ['running','waiting'].includes(attempt.status))) throw new Error('session still has an active or waiting attempt');
  for (let i = 0; i < state.mission.doneWhen.length; i++) if (!(state.brief.proven ?? []).some(line => line.startsWith(`doneWhen:${i} `))) throw new Error(`session cannot close-success: doneWhen:${i} is not proven`);
}

export async function closeSuccessfulSession(session, reason) {
  session = path.resolve(session);
  if (!reason?.trim()) throw new Error('close-success requires an explicit session close reason');
  const sessionsRoot = path.dirname(session);
  if (path.basename(sessionsRoot).toLowerCase() !== 'sessions' || path.basename(path.dirname(sessionsRoot)).toLowerCase() !== '.worktrees') throw new Error('cleanup target must be one direct child of .worktrees/sessions');
  if (path.basename(session).toLowerCase() === 'central-runtime') throw new Error('cleanup never targets sessions/central-runtime');
  if ((await lstat(session)).isSymbolicLink() || path.dirname(await realpath(session)) !== await realpath(sessionsRoot)) throw new Error('cleanup target must be a real directory inside the named sessions root');
  return withSessionLock(session, async () => {
    const state = await json(path.join(session, 'state.json'));
    closeErrors(session, state);
    const checked = await validateSession(root, session);
    if (checked.errors.length) throw new Error(checked.errors.join('\n'));
    state.lifecycle = { ...state.lifecycle, phase: 'closing', closeReason: reason };
    await atomicWrite(path.join(session, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    const retained = await retainSessionBundle(session, state, reason);
    if (stateHash(await json(path.join(session, 'state.json'))) !== retained.manifest.sourceStateHash) throw new Error('RETENTION_CHANGED: active state changed during close');
    for (const item of retained.manifest.files.filter(item => item.ref.startsWith('bundle/') && item.ref !== 'bundle/state.json')) {
      if (await digest(await confinedFile(session, item.ref.slice(7))) !== item.sha256) throw new Error(`RETENTION_CHANGED: ${item.ref}; active session retained`);
    }
    await rm(session, { recursive: true });
    return { status: 'closed-success', sessionId: state.id, compact: retained.compact, bundle: retained.bundle };
  });
}

async function main() {
  const [command, target, ...reason] = process.argv.slice(2);
  if (command !== 'close-success' || !target || !reason.length) throw new Error('usage: node scripts/session-cleanup.mjs close-success <session> <reason>');
  process.stdout.write(`${JSON.stringify(await closeSuccessfulSession(target, reason.join(' ')))}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
