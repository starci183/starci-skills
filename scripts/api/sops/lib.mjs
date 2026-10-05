// scripts/api/sops/lib.mjs — shared file formats, identity admission and SOPS child capture.
// Custody members are committed as `<name>.<fmt>.enc`; sops infers a format from the LAST extension, so `.enc` reads as
// binary and every read states the format (--input-type). The call files (decrypt.mjs, encrypt.mjs, exec-env.mjs) each
// name one sops use.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readSecretBytes, CREDENTIAL_FILE_MAX_BYTES, sopsIdentityEnv } from '../../../engine/secrets.mjs';
import { selectedAgeEnvelope } from '../../lib/sops-envelope.mjs';

const FORMATS = { yaml: 'yaml', yml: 'yaml', json: 'json', env: 'dotenv', dotenv: 'dotenv' };

/** The sops input type `<name>.<format>.enc` states, or the explicit override. Throws when neither names one. */
export function custodyInputType(file, override) {
  if (override) {
    if (!Object.values(FORMATS).includes(override)) throw new Error(`unsupported --input-type ${override}`);
    return override;
  }
  const match = /\.([a-z]+)\.enc$/iu.exec(String(file));
  const type = match ? FORMATS[match[1].toLowerCase()] : undefined;
  if (!type) throw new Error(`${file}: name it <name>.<yaml|json|env>.enc or pass --input-type`);
  return type;
}

/** Resolve SOPS from PATH and WinGet. Consumers select PATHEXT names and the full package tree for their launcher. */
export function resolveSops(env = process.env, { platform = process.platform, pathext = false, wingetPackageTree = false, filesystem = fs } = {}) {
  const win = platform === 'win32';
  const paths = win ? path.win32 : path.posix;
  const names = win
    ? (pathext ? String(env.PATHEXT || '.EXE;.CMD;.BAT').split(';').filter(Boolean).map((ext) => `sops${ext}`) : ['sops.exe', 'sops'])
    : ['sops'];
  const dirs = String(env.PATH ?? '').split(win ? ';' : ':').filter(Boolean);
  if (win && env.LOCALAPPDATA) {
    const winget = paths.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet');
    dirs.push(paths.join(winget, 'Links'));
    const packages = paths.join(winget, 'Packages');
    try {
      for (const entry of filesystem.readdirSync(packages)) {
        if (!wingetPackageTree && !/sops/i.test(entry)) continue;
        const directory = paths.join(packages, entry);
        dirs.push(directory);
        if (wingetPackageTree) {
          try {
            for (const nested of filesystem.readdirSync(directory, { withFileTypes: true })) {
              if (nested.isDirectory()) dirs.push(paths.join(directory, nested.name));
            }
          } catch { /* unreadable package */ }
        }
      }
    } catch { /* no WinGet packages */ }
  }
  for (const directory of dirs) for (const name of names) {
    const file = paths.join(directory, name);
    try { if (filesystem.statSync(file).isFile()) return file; } catch { /* next candidate */ }
  }
  return null;
}

/**
 * Select the caller's identity once, then run the encrypt/decrypt file action through its admitted SOPS path.
 * Inline selection delegates the unchanged request to runSelectedSops; original FILE and recipient-only modes retain their existing child transport.
 * @param {string|null} bin Explicit SOPS executable, or null to resolve it from the selected environment.
 * @param {string[]} args The caller's SOPS argument array; no private identity is added to it.
 * @param {'encrypt'|'decrypt'} operation The public file action, which owns identity requirements and capture defaults.
 * @param {object} options Original identity, selected invocation ports, environment, cwd, timeout and maxBuffer.
 * @returns {{status: number|null, stdout: string|null, stderr: string|null, error: Error|null}} The unchanged child result or typed prelaunch refusal.
 */
export function runSopsFile(bin, args, operation, options = {}) {
  const { identity = null, invocation = null, env = process.env, cwd = undefined } = options;
  let maxBuffer, timeout;
  if (operation === 'decrypt') ({ maxBuffer = 16 * 1024 * 1024, timeout = undefined } = options);
  else ({ timeout = undefined, maxBuffer = 1024 * 1024 } = options);
  const selected = sopsIdentityEnv(env, operation === 'decrypt' ? { identity, required: true } : { identity });
  if (selected.error?.identityRefusal === 'inline-context-unqualified') return runSelectedSops(bin, { operation, args }, { selection: selected, invocation, env, cwd, maxBuffer, timeout });
  if (selected.error) return { status: null, stdout: '', stderr: '', error: selected.error };
  const exe = bin ?? resolveSops(selected.env);
  if (!exe) return { status: null, stdout: '', stderr: '', error: Object.assign(new Error('sops is not installed (Windows: winget install Mozilla.SOPS)'), { code: 'SOPS_MISSING' }) };
  const r = spawnSync(exe, args, {
    encoding: 'utf8', windowsHide: true, maxBuffer, timeout, env: selected.env,
    ...(operation === 'decrypt' ? { cwd } : { stdio: ['ignore', 'pipe', 'pipe'] }),
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, error: r.error ?? null };
}

const SELECTED_SOPS_VERSIONS = new Set(['3.13.2', '3.13.3']);
const SELECTED_AGE_VERSIONS = new Set(['1.2.1', '1.3.1']);
const IDENTITY_TIMEOUT_MS = 20_000;
const CONTROLLED_ENV = new Set(['SOPS_AGE_KEY', 'SOPS_AGE_KEY_FILE', 'SOPS_AGE_KEY_CMD', 'SOPS_AGE_SSH_PRIVATE_KEY_FILE', 'SOPS_AGE_SSH_PRIVATE_KEY_CMD', 'SOPS_AGE_RECIPIENT', 'SOPS_KEYSERVICE', 'SOPS_ENABLE_LOCAL_KEYSERVICE', 'SOPS_DECRYPTION_ORDER', 'SOPS_KMS_ARN', 'SOPS_GCP_KMS_IDS', 'SOPS_HUAWEICLOUD_KMS_IDS', 'SOPS_AZURE_KEYVAULT_URLS', 'SOPS_VAULT_URIS', 'SOPS_PGP_FP', 'SOPS_AGE_RECIPIENTS', 'HOME', 'USERPROFILE', 'APPDATA', 'XDG_CONFIG_HOME']);

/** Construct only the child map; empty desktop roots make Go return directory errors, not fallback paths. */
export function isolatedSopsEnv(env, inlineName = 'SOPS_AGE_KEY') {
  const out = Object.fromEntries(Object.entries(env).filter(([name]) => !CONTROLLED_ENV.has(name.toUpperCase())));
  out.HOME = ''; out.USERPROFILE = ''; out.APPDATA = ''; out.XDG_CONFIG_HOME = '';
  if (inlineName !== null) out.SOPS_AGE_KEY = env[inlineName];
  return out;
}

const held = reason => ({ status: null, stdout: '', stderr: '', error: Object.assign(new Error(`SOPS selected identity [${reason}]: the selected invocation was not qualified`), { name: 'SopsIdentityRefusal', identityRefusal: reason }) });
const nativeFile = file => {
  if (typeof file !== 'string' || !path.isAbsolute(file) || /\.(?:[cm]?js|cmd|bat|ps1|sh)$/i.test(file)) return false;
  let fd;
  try {
    const before = fs.lstatSync(file);
    if (!before.isFile() || before.isSymbolicLink()) return false;
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const stat = fs.fstatSync(fd), head = Buffer.alloc(64);
    if (!stat.isFile() || before.dev !== stat.dev || before.ino !== stat.ino || fs.readSync(fd, head, 0, head.length, 0) < 20) return false;
    if (process.platform === 'win32' && head.toString('ascii', 0, 2) === 'MZ') {
      const offset = head.readUInt32LE(60), pe = Buffer.alloc(6);
      return offset >= 64 && offset + pe.length <= stat.size && fs.readSync(fd, pe, 0, pe.length, offset) === pe.length && pe.toString('ascii', 0, 4) === 'PE\0\0';
    }
    if (process.platform === 'linux') return head.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
    if (process.platform === 'darwin') return new Set([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca, 0xcafebabf, 0xbfbafeca]).has(head.readUInt32BE(0));
    return false;
  } catch { return false; }
  finally { if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* no private result or success credit */ } } }
};
const auditAbsent = cwd => {
  try { fs.lstatSync(path.resolve(cwd ?? process.cwd(), '/etc/sops/audit.yaml')); return false; }
  catch (error) { return error.code === 'ENOENT'; }
};
const captured = r => r && r.status === 0 && r.signal == null && !r.error && Buffer.isBuffer(r.stdout) && Buffer.isBuffer(r.stderr);
const decoded = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const ownedRequest = request => {
  if (request.operation === 'seal') {
    const p = request.params;
    if (!p || !Array.isArray(p.recipients) || p.recipients.length !== 1 || typeof p.filenameOverride !== 'string' || !p.filenameOverride || (typeof p.plaintext !== 'string' && !Buffer.isBuffer(p.plaintext)) || Buffer.byteLength(p.plaintext) > CREDENTIAL_FILE_MAX_BYTES) return null;
    return { inputType: p.inputType, outputType: p.inputType, file: p.filenameOverride, recipient: p.recipients[0], plaintext: p.plaintext };
  }
  const args = request.args;
  if (!Array.isArray(args) || !['decrypt', '--decrypt', 'encrypt', '--encrypt'].includes(args[0]) || args.some(value => typeof value !== 'string')) return null;
  if (!args.at(-1) || args.at(-1).startsWith('-')) return null;
  const flags = {};
  for (let i = 1; i < args.length - 1; i += 2) {
    const flag = args[i];
    if (!['--input-type', '--output-type', '--age'].includes(flag) || Object.hasOwn(flags, flag) || i + 1 >= args.length - 1) return null;
    flags[flag] = args[i + 1];
  }
  if (request.operation === 'decrypt' && (args[0] !== 'decrypt' && args[0] !== '--decrypt' || Object.hasOwn(flags, '--age'))) return null;
  if (request.operation === 'encrypt' && (args[0] !== 'encrypt' && args[0] !== '--encrypt' || !flags['--age'] || flags['--age'].includes(','))) return null;
  return { inputType: flags['--input-type'], outputType: flags['--output-type'], file: args.at(-1), recipient: flags['--age'] };
};

/** The domain composes the existing process owner: invocation={runProgram(file,args,options),resolveRealTool(program,{env})}. No API imports another system. */
export function runSelectedSops(bin, request, { selection, invocation, env, cwd, maxBuffer, timeout } = {}) {
  if (selection?.error?.identityRefusal !== 'inline-context-unqualified' || typeof selection.inlineName !== 'string' || !env || typeof env !== 'object') return held('selected-context-missing');
  const spec = ownedRequest(request);
  if (!spec || !['binary', 'json', 'yaml', 'dotenv'].includes(spec.inputType) || !['binary', 'json', 'yaml', 'dotenv'].includes(spec.outputType)) return { status: null, stdout: '', stderr: '', error: selection.error };
  if (!invocation || typeof invocation.runProgram !== 'function' || typeof invocation.resolveRealTool !== 'function') return { status: null, stdout: '', stderr: '', error: selection.error };
  if (!['win32', 'linux', 'darwin'].includes(process.platform)) return held('unsupported-platform');
  const key = env[selection.inlineName];
  if (typeof key !== 'string' || !/^AGE-SECRET-KEY-1[0-9A-Z]+$/.test(key.trim())) return { status: null, stdout: '', stderr: '', error: selection.error };
  let input, identity, selectedEnv;
  const captures = [];
  try {
    const file = path.resolve(cwd ?? process.cwd(), spec.file);
    try { input = request.operation === 'seal' ? Buffer.from(spec.plaintext) : readSecretBytes(file); } catch { return held('actual-document-unavailable'); }
    if (input.length > CREDENTIAL_FILE_MAX_BYTES) return held('document-over-budget');
    const exe = bin ?? resolveSops(env), age = invocation.resolveRealTool('age-keygen', { env });
    if (!nativeFile(exe) || !nativeFile(age)) return held('native-tool-unavailable');
    if (!auditAbsent(cwd)) return held('unsupported-audit-context');
    const deadline = timeout ?? IDENTITY_TIMEOUT_MS;
    if (!Number.isInteger(deadline) || deadline < 1 || deadline > 2_147_483_647 || !Number.isInteger(maxBuffer) || maxBuffer < 1) return held('invalid-capture-budget');
    selectedEnv = isolatedSopsEnv(env, selection.inlineName);
    const publicEnv = isolatedSopsEnv(env, null);
    const options = { cwd, env: selectedEnv, shell: false, encoding: 'buffer', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], timeout: deadline, maxBuffer };
    const run = (program, args, bytes, childEnv = selectedEnv) => {
      const result = invocation.runProgram(program, args, { ...options, env: childEnv, input: bytes });
      captures.push(result); return result;
    };
    const version = run(exe, ['--disable-version-check', '--version'], undefined, publicEnv);
    const ageVersion = run(age, ['--version'], undefined, publicEnv);
    if (!captured(version) || !captured(ageVersion) || !SELECTED_SOPS_VERSIONS.has(/^sops\s+([0-9]+\.[0-9]+\.[0-9]+)/.exec(decoded(version.stdout))?.[1]) || !SELECTED_AGE_VERSIONS.has(/^v?([0-9]+\.[0-9]+\.[0-9]+)/.exec(decoded(ageVersion.stdout))?.[1])) return held('unsupported-tool-profile');
    identity = Buffer.from(key.trim(), 'utf8');
    const derived = run(age, ['-y'], identity, publicEnv);
    if (!captured(derived)) return held('recipient-unproven');
    const recipients = decoded(derived.stdout).trim().split(/\r?\n/);
    if (recipients.length !== 1 || !/^age1[ac-hj-np-z02-9]+$/.test(recipients[0])) return held('recipient-unproven');
    const recipient = recipients[0];
    const decryptArgs = (inputType, outputType) => ['decrypt', '--input-type', inputType, '--output-type', outputType, '--filename-override', file, '--enable-local-keyservice=true', '--decryption-order', 'age'];
    if (request.operation === 'decrypt') {
      const envelope = selectedAgeEnvelope(decoded(input), spec.inputType, recipient);
      if (!envelope.ok) return held(envelope.reason);
      const result = run(exe, decryptArgs(spec.inputType, spec.outputType), input);
      if (!captured(result)) return held('selected-decryption-failed');
      return { status: 0, stdout: decoded(result.stdout), stderr: '', error: null };
    }
    if (spec.recipient !== recipient) return held('recipient-mismatch');
    const args = ['encrypt', '--input-type', spec.inputType, '--output-type', spec.outputType, '--filename-override', file, '--enable-local-keyservice=true', '--age', recipient];
    const result = run(exe, args, input);
    if (!captured(result)) return held('selected-encryption-failed');
    if (result.stdout.length > CREDENTIAL_FILE_MAX_BYTES) return held('document-over-budget');
    const text = decoded(result.stdout);
    const envelope = selectedAgeEnvelope(text, spec.outputType, recipient);
    if (!envelope.ok) return held(envelope.reason);
    const readback = run(exe, decryptArgs(spec.outputType, spec.inputType), result.stdout);
    if (!captured(readback)) return held('selected-readback-failed');
    return { status: 0, stdout: text, stderr: '', error: null };
  } catch { return held('selected-native-refused'); }
  finally {
    identity?.fill(0); input?.fill(0);
    for (const result of captures) { if (Buffer.isBuffer(result?.stdout)) result.stdout.fill(0); if (Buffer.isBuffer(result?.stderr)) result.stderr.fill(0); }
    if (selectedEnv) delete selectedEnv.SOPS_AGE_KEY;
  }
}

/** One real private capture for an admitted initial request; the installer owns its durable attempt. */
export function withGeneratedAgeIdentity({ env, cwd, invocation, assertLease, consume } = {}) {
  const failure = (reason, generated) => ({ ok: false, reason, captureState: generated ? 'unknown' : 'none', effectState: generated ? 'unknown' : 'none' });
  if (!env || typeof env !== 'object' || !path.isAbsolute(cwd ?? '') || typeof consume !== 'function'
    || typeof assertLease !== 'function' || typeof invocation?.runProgram !== 'function'
    || typeof invocation?.resolveRealTool !== 'function') return failure('invalid-request', false);
  const captures = [];
  let generated = false, identity;
  try {
    const age = invocation.resolveRealTool('age-keygen', { env });
    if (!nativeFile(age)) return failure('native-tool-unavailable', false);
    const options = { cwd, env: isolatedSopsEnv(env, null), shell: false, encoding: 'buffer', windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'], timeout: IDENTITY_TIMEOUT_MS, maxBuffer: CREDENTIAL_FILE_MAX_BYTES };
    const run = (args, input) => {
      if (assertLease() !== true) throw new Error('initial age lease lost');
      const result = invocation.runProgram(age, args, { ...options, input });
      captures.push(result);
      if (!captured(result) || result.stdout.length > options.maxBuffer || result.stderr.length > options.maxBuffer) throw new Error('initial age capture incomplete');
      return result;
    };
    const version = run(['--version']);
    if (!SELECTED_AGE_VERSIONS.has(/^v?([0-9]+\.[0-9]+\.[0-9]+)/.exec(decoded(version.stdout))?.[1])) return failure('unsupported-tool-profile', false);
    if (assertLease() !== true) return failure('lease-lost', false);
    generated = true;
    const made = run([]), lines = decoded(made.stdout).trim().split(/\r?\n/);
    const identities = lines.filter(line => line && !line.startsWith('#'));
    if (identities.length !== 1 || !/^AGE-SECRET-KEY-1[0-9A-Z]+$/.test(identities[0])
      || lines.some(line => line.startsWith('#') && !/^# (?:created:|public key:)/.test(line))) return failure('capture-incomplete', true);
    identity = Buffer.from(identities[0], 'utf8');
    const derived = run(['-y'], identity), recipients = decoded(derived.stdout).trim().split(/\r?\n/);
    if (recipients.length !== 1 || !/^age1[ac-hj-np-z02-9]+$/.test(recipients[0])) return failure('recipient-unproven', true);
    const recipient = recipients[0], declared = lines.filter(line => line.startsWith('# public key:'));
    if (declared.length !== 1 || declared[0].slice('# public key:'.length).trim() !== recipient || assertLease() !== true) return failure('recipient-unproven', true);
    const publication = consume(identity, recipient);
    if (!publication || typeof publication.ok !== 'boolean' || !['none', 'unknown', 'complete'].includes(publication.effectState)) return failure('publication-unknown', true);
    if (!publication.ok || publication.effectState !== 'complete') return { ok: false, captureState: 'generated', effectState: publication.effectState,
      reason: 'publication-held' };
    if (![true, false].includes(publication.created) || !['file-fsync', 'file-and-parent-fsync', 'file-fsync-namespace-unqualified'].includes(publication.durability)) return failure('publication-unknown', true);
    return { ok: true, captureState: 'generated', effectState: 'complete', created: publication.created,
      durability: publication.durability, publicRecipient: recipient };
  } catch { return failure('capture-or-publication-unknown', generated); }
  finally {
    identity?.fill(0);
    for (const result of captures) {
      if (Buffer.isBuffer(result?.stdout)) result.stdout.fill(0);
      if (Buffer.isBuffer(result?.stderr)) result.stderr.fill(0);
    }
  }
}
