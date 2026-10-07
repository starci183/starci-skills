// initial-age.mjs - the real init lifecycle's private identity and attempt custody.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SECRET_ENV_FILE, CREDENTIAL_FILE_MAX_BYTES, secretEnv, readSecretBytes, sopsIdentityEnv } from '../../engine/secrets.mjs';
import { INSTALL_MANIFEST_FILE, INSTALL_PROTOCOL_SCHEMA } from '../lib/install-custody.mjs';
import { samePath } from '../lib/path-key.mjs';
import { redactText } from '../lib/redact.mjs';
import { isLinkLike } from '../api/fs/is-link-like.mjs';
import { publishSecret } from '../api/fs/publish-secret.mjs';
import { withGeneratedAgeIdentity } from '../api/sops/with-generated-age-identity.mjs';
import { resolveRealTool } from '../api/process/resolve-real-tool.mjs';
import { runProgram } from '../api/process/run-program.mjs';
import { acquireHostLock, hostLockOwner, hostLockDir, releaseHostLock } from '../machine/host-lock.mjs';

const SETUP_SCHEMA = 'starci/initial-age-setup@1';
const refuse = reason => { throw Object.assign(new Error('initial age setup refused'), { setupReason: reason }); };
const no = reason => ({ ok: false, outcome: 'held', reason });
/** The cause of an unclassified setup failure: its code and message, secrets blanked (the message comes from path and tool handling, never key bytes by design). */
const causeOf = error => redactText(((error?.code ? error.code + ': ' : '') + (error?.message ?? error)).replace(/AGE-SECRET-KEY-[A-Z0-9]+/g, '[redacted:age-key]')).slice(0, 400);
/** The capture reasons that name the identity tool (scripts/api/sops/lib.mjs withGeneratedAgeIdentity) rather than the install's own custody. */
export const AGE_TOOL_REASONS = Object.freeze({ 'native-tool-unavailable': 'age-keygen was not found on PATH', 'unsupported-tool-profile': 'the age-keygen on PATH is not an accepted version' });
const setupReasons = new Set(['canonical-target', 'foreign-target', 'old-ciphertext', 'private-file-custody',
  'ambiguous-identity', 'disabled-identity', 'prior-attempt', 'prior-install', 'lease-lost', 'manifest-custody', 'identity-reload']);
const sameNode = (a, b) => a.dev === b.dev && a.ino === b.ino;
// Whether `file` is its own canonical entry: the spelling of the parents above it (8.3 short name, symlinked prefix) is not a link.
const ownSpelling = file => samePath(fs.realpathSync(file), path.join(fs.realpathSync(path.dirname(file)), path.basename(file)));

function physicalDirectory(entry, required) {
  const stat = fs.lstatSync(entry, { throwIfNoEntry: false });
  if (!stat) {
    if (required) refuse('canonical-target');
    return null;
  }
  if (!stat.isDirectory() || isLinkLike(entry, { stat }) || !ownSpelling(entry)) refuse('canonical-target');
  return stat;
}

function physicalTarget(repo) {
  if (typeof repo !== 'string' || !path.isAbsolute(repo)) refuse('canonical-target');
  const root = path.resolve(repo), target = path.join(root, '.claude'), nodes = {};
  for (const entry of [root, target]) {
    const stat = physicalDirectory(entry, entry === root);
    if (stat) nodes[entry] = stat;
  }
  return { root, target, nodes };
}

function samePhysicalTarget(expected, current) {
  if (!sameNode(expected.nodes[expected.root], current.nodes[current.root])) refuse('canonical-target');
  const before = expected.nodes[expected.target], after = current.nodes[current.target];
  if (before && (!after || !sameNode(before, after))) refuse('canonical-target');
  return current;
}

const isCiphertextName = name => /\.(?:enc|age|key|pem)$/i.test(name) || name === 'master.identity';

function visitCiphertextDirectory(directory, state) {
  const stat = fs.lstatSync(directory, { throwIfNoEntry: false });
  if (!stat) return false;
  if (!stat.isDirectory() || isLinkLike(directory, { stat })) refuse('old-ciphertext');
  for (const name of fs.readdirSync(directory)) {
    if (++state.entries > 4096) refuse('old-ciphertext');
    const file = path.join(directory, name), child = fs.lstatSync(file);
    if (child.isSymbolicLink() || (child.isDirectory() && isLinkLike(file, { stat: child }))) refuse('old-ciphertext');
    if (isCiphertextName(name)) return true;
    if (child.isDirectory() && visitCiphertextDirectory(file, state)) return true;
    if (!child.isDirectory() && !child.isFile()) refuse('old-ciphertext');
  }
  return false;
}

// Inspect custody names only: encrypted and private payloads are never read here.
function originalCiphertext(root, target) {
  for (const file of [path.join(target, 'master.identity'), path.join(target, '.secrets'),
    path.join(root, '.sops.yaml'), path.join(target, '.sops.yaml')]) {
    if (fs.lstatSync(file, { throwIfNoEntry: false })) return true;
  }
  const state = { entries: 0 };
  return visitCiphertextDirectory(path.join(target, 'ext'), state) || visitCiphertextDirectory(path.join(root, '.starcistacks'), state);
}

function manifestOf(target) {
  const file = path.join(target, INSTALL_MANIFEST_FILE), stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || !ownSpelling(file)
    || stat.size > CREDENTIAL_FILE_MAX_BYTES * 16) refuse('manifest-custody');
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { refuse('manifest-custody'); }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || doc.installProtocol?.schema !== INSTALL_PROTOCOL_SCHEMA) refuse('manifest-custody');
  return doc;
}

function validatePriorSetupMarker(marker) {
  if (marker !== undefined && (marker?.schema !== SETUP_SCHEMA || marker.state !== 'complete'
    || marker.release?.state !== 'released' || marker.release.ok !== true || marker.release.released !== true
    || marker.release.leftover !== null || !['reserved', 'reuse'].includes(marker.attempt)
    || !['none', 'complete'].includes(marker.publication))) refuse('prior-attempt');
}

function readPriorIdentity(file, state) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!stat) return;
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || !ownSpelling(file)) refuse('private-file-custody');
  state.before = readSecretBytes(file);
  const names = state.before.toString('utf8').split(/\r?\n/).flatMap(line => {
    const name = /^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=/.exec(line)?.[1];
    return name?.toUpperCase().startsWith('SOPS_AGE_') ? [process.platform === 'win32' ? name.toUpperCase() : name] : [];
  });
  if (new Set(names).size !== names.length) refuse('ambiguous-identity');
}

function validateNewIdentity(root, target, prior, marker, selectedEnv) {
  if (marker !== undefined) refuse('prior-attempt');
  if (prior !== null || [path.join(root, '.agents/skills/starci'), path.join(root, '.devin/skills/starci')]
    .some(entry => fs.lstatSync(entry, { throwIfNoEntry: false }))) refuse('prior-install');
  if (Object.keys(selectedEnv).some(name => name.toUpperCase().startsWith('SOPS_AGE_'))) refuse('old-ciphertext');
  if (originalCiphertext(root, target)) refuse('old-ciphertext');
  if (fs.existsSync(target) && fs.readdirSync(target).some(name => name !== SECRET_ENV_FILE)) refuse('foreign-target');
}

function identityBefore(root, target, prior, env, force) {
  const marker = prior?.initialAgeSetup, state = { before: null };
  try {
    validatePriorSetupMarker(marker);
    readPriorIdentity(path.join(target, SECRET_ENV_FILE), state);
    const selectedEnv = fs.existsSync(target) ? secretEnv(target, env) : { ...env };
    const selection = sopsIdentityEnv(selectedEnv);
    if (selection.mode === 'file' || selection.error?.identityRefusal === 'inline-context-unqualified') {
      return { before: state.before, selectedEnv, reuse: true, priorMarker: marker };
    }
    if (selection.mode === 'refused') refuse(selection.error?.identityRefusal?.startsWith('disabled-') ? 'disabled-identity' : 'ambiguous-identity');
    validateNewIdentity(root, target, prior, marker, selectedEnv);
    return { before: state.before, selectedEnv, reuse: false };
  } catch (error) { state.before?.fill(0); throw error; }
}

function reserve(target, marker, assertLease, io = fs, expected = null) {
  if (!assertLease()) refuse('lease-lost');
  const file = path.join(target, INSTALL_MANIFEST_FILE), stat = io.lstatSync(file), doc = manifestOf(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) refuse('manifest-custody');
  let fd, parent, text;
  try {
    fd = io.openSync(file, io.constants.O_RDWR | (io.constants.O_NOFOLLOW ?? 0));
    if (!sameNode(stat, io.fstatSync(fd))) refuse('manifest-custody');
    if (expected && (!sameNode(expected.node, stat) || !io.readFileSync(fd).equals(expected.bytes))) refuse('manifest-custody');
    text = Buffer.from(`${JSON.stringify({ ...doc, initialAgeSetup: marker }, null, 2)}\n`);
    if (text.length > CREDENTIAL_FILE_MAX_BYTES * 16) refuse('manifest-custody');
    if (!assertLease()) refuse('lease-lost');
    io.ftruncateSync(fd, 0);
    let offset = 0;
    while (offset < text.length) {
      const written = io.writeSync(fd, text, offset, text.length - offset, offset);
      if (!Number.isSafeInteger(written) || written <= 0) refuse('manifest-custody');
      offset += written;
    }
    io.fsyncSync(fd);
    if (process.platform !== 'win32') {
      parent = io.openSync(target, io.constants.O_RDONLY | (io.constants.O_DIRECTORY ?? 0) | (io.constants.O_NOFOLLOW ?? 0));
      io.fsyncSync(parent);
    }
    if (!assertLease() || !sameNode(stat, io.lstatSync(file))) refuse('lease-lost');
  } finally {
    let failed = false;
    for (const retained of [fd, parent]) {
      if (retained === undefined) continue;
      try { io.closeSync(retained); } catch { failed = true; }
    }
    if (failed) refuse('manifest-custody');
  }
  return { node: stat, bytes: text, marker };
}

const publicRelease = result => ({ ok: result?.ok === true, released: result?.released === true,
  ...(result?.reason === 'not-owner' ? { reason: 'not-owner', ownerPresent: Boolean(result.owner) } : {}),
  leftover: typeof result?.leftover === 'string' ? result.leftover : null });

function finishInitialAgeRelease({ got, locks, lockOptions, env, io, outcome, reservation, physical, repo, target }) {
  let result;
  try {
    result = publicRelease((locks.release ?? releaseHostLock)({ token: got.token, ...lockOptions }));
  } catch { result = { ok: false, released: false, leftover: null, reason: 'release-unknown' }; }
  outcome.release = result;
  const released = result.ok && result.released && !result.leftover;
  if (!released) { outcome.ok = false; outcome.releaseCustody = 'held'; }
  if (!reservation) return;
  const complete = released && outcome.ok === true;
  const marker = { ...reservation.marker, state: complete ? 'complete' : 'held',
    publication: reservation.marker.publication === 'complete' ? 'complete' : outcome.publication ?? reservation.marker.publication,
    capture: reservation.marker.capture === 'generated' ? 'generated' : outcome.capture ?? reservation.marker.capture,
    release: { state: released ? 'released' : 'held', ...result } };
  try {
    // One guarded public preimage write after release; never reacquire the host lock.
    // This records observed release facts, not an atomic cross-process CAS or crash qualification.
    const assertFinalization = () => {
      const current = samePhysicalTarget(physical, physicalTarget(repo));
      if (!current.nodes[target] || !sameNode(physical.nodes[target], current.nodes[target])) return false;
      const owner = (locks.owner ?? hostLockOwner)({ env, fs: lockOptions.fs });
      return owner === null || (!released && owner?.token === got.token && owner.pid === process.pid
        && owner.host === os.hostname() && owner.stale === false && owner.ttlMs === null);
    };
    reserve(target, marker, assertFinalization, io, reservation);
    outcome.finalization = complete ? 'complete' : 'held';
  } catch {
    outcome.ok = false; outcome.finalization = 'unknown'; outcome.releaseCustody = 'held';
  }
}

function completeInitialAgeIdentity({ snapshot, root, target, env, assertLease, io, deps, privateBefore, setReservation }) {
  if (snapshot.reuse) {
    setReservation(reserve(target, { ...snapshot.priorMarker, schema: SETUP_SCHEMA, state: 'reusing',
      producer: 'runtime-install-init', attempt: snapshot.priorMarker?.attempt ?? 'reuse',
      publication: snapshot.priorMarker?.publication ?? 'none',
      capture: snapshot.priorMarker?.capture ?? 'none', release: { state: 'pending' } }, assertLease, io));
    return { ok: true, outcome: 'reused', publication: 'none', selectedIdentityQualified: false };
  }
  const attempted = { schema: SETUP_SCHEMA, state: 'attempted', producer: 'runtime-install-init', attempt: 'reserved',
    publication: 'none', capture: 'pending', release: { state: 'pending' } };
  setReservation(reserve(target, attempted, assertLease, io));
  const result = (deps.capture ?? withGeneratedAgeIdentity)({ env: snapshot.selectedEnv, cwd: root, assertLease,
    invocation: { runProgram: deps.runProgram ?? runProgram, resolveRealTool: deps.resolveRealTool ?? resolveRealTool },
    consume: (identity, recipient) => {
      let addition;
      try {
        const separator = privateBefore?.length && privateBefore.at(-1) !== 10 ? '\n' : '';
        addition = Buffer.concat([Buffer.from(`${separator}SOPS_AGE_KEY=`), identity, Buffer.from('\n')]);
        const published = (deps.publish ?? publishSecret)({ root: target, name: SECRET_ENV_FILE, before: privateBefore,
          addition, maxBytes: CREDENTIAL_FILE_MAX_BYTES, assertLease });
        if (!published?.ok || published.effectState !== 'complete') return published;
        const loaded = secretEnv(target, env), selected = sopsIdentityEnv(loaded);
        if (selected.error?.identityRefusal !== 'inline-context-unqualified'
          || loaded[selected.inlineName]?.trim() !== identity.toString('utf8')) refuse('identity-reload');
        setReservation(reserve(target, { ...attempted, state: 'published', publication: 'complete',
          capture: 'generated', publicRecipient: recipient }, assertLease, io));
        return published;
      } finally { addition?.fill(0); }
    } });
  if (!result?.ok) return { ...no('capture-or-publication-held'), ...(AGE_TOOL_REASONS[result?.reason] ? { toolReason: result.reason } : {}), capture: result?.captureState ?? 'unknown',
    publication: result?.effectState ?? 'unknown' };
  return { ok: true, outcome: 'created', publication: result.effectState, publicRecipient: result.publicRecipient,
    durability: result.durability, reservationDurability: process.platform === 'win32' ? 'file-fsync-namespace-unqualified' : 'file-and-parent-fsync' };
}

/** Original init intent is the producer; projection, update and diagnostics never request this operation. */
export function runInitialAgeInstall({ repo, force = false, project } = {}, deps = {}) {
  const env = deps.env ?? process.env, locks = deps.locks ?? {}, io = deps.fs ?? fs;
  let got, privateBefore, lockOptions, outcome, reservation, physical, target;
  const finish = value => { outcome = value; return outcome; };
  try {
    if (typeof project !== 'function') return finish(no('invalid-request'));
    physical = physicalTarget(repo);
    const { root } = physical;
    target = physical.target;
    const dir = hostLockDir({ env });
    const lockFs = { ...fs, mkdirSync: (...args) => {
      try { return fs.mkdirSync(...args); } catch (error) {
        if (error?.code === 'EEXIST' && samePath(args[0], dir)) throw Object.assign(new Error('initial setup lock held'), { code: 'EAGAIN' });
        throw error;
      }
    } };
    lockOptions = { role: 'coordinator', purpose: 'runtime-install-initial-age', ttlMs: null, env, fs: lockFs };
    try { got = (locks.acquire ?? acquireHostLock)(lockOptions); }
    catch (error) { if (error?.code === 'EAGAIN') { return finish(no('lock-held')); } throw error; }
    if (!got?.ok || got.tookOverFrom) return finish(no('lock-held'));
    const assertLease = () => {
      const current = samePhysicalTarget(physical, physicalTarget(repo));
      if (!physical.nodes[target] && current.nodes[target]) refuse('canonical-target');
      const owner = (locks.owner ?? hostLockOwner)({ env, fs: lockFs });
      return owner?.token === got.token && owner.pid === process.pid && owner.host === os.hostname()
        && owner.stale === false && owner.ttlMs === null;
    };
    if (!assertLease()) refuse('lease-lost');
    const snapshot = identityBefore(root, target, manifestOf(target), env, force);
    privateBefore = snapshot.before;
    if (!assertLease()) refuse('lease-lost');
    const projected = project();
    if (projected?.status !== 0) return finish(no('install-failed'));
    physical = samePhysicalTarget(physical, physicalTarget(repo));
    if (!physical.nodes[target] || !projected.targetNode || !sameNode(projected.targetNode, physical.nodes[target])) refuse('canonical-target');
    if (!assertLease()) refuse('lease-lost');
    return finish(completeInitialAgeIdentity({ snapshot, root, target, env, assertLease, io, deps, privateBefore, setReservation: value => { reservation = value; } }));
  } catch (error) {
    return finish(setupReasons.has(error?.setupReason) ? no(error.setupReason) : { ...no('setup-unknown'), detail: causeOf(error) });
  } finally {
    privateBefore?.fill(0);
    if (got?.ok) {
      finishInitialAgeRelease({ got, locks, lockOptions, env, io, outcome, reservation, physical, repo, target });
    }
  }
}
