// remote.mjs - how the stack verbs reach the Swarm manager: the ssh runner, remote command quoting, the CI transport setup.
//   sshRunner(ctx, config, { sshCmd })  -> run(command, { input }) -> { status, stdout, stderr }   (`.cleanup()`, `.notes`)
//   transports, in this order: --ssh-cmd "ssh vps" (no shell) -> the owner-machine session opened from the sealed members
//   (only when config.remote.sealed is declared and STARCI_STACK_SEALED_SSH=1) -> the ssh alias config.remote.host (CI after `connect`,
//   or the operator's own ssh config).
//   connectCi / disconnectCi            GitHub Actions: write and remove the pinned key, known_hosts, ssh config and DOCKER_HOST.
// A remote command is ONE ssh argument with every carriage return removed (lfOnly: a script that reached a Windows checkout with CRLF made
// `bash -s` fail with `set: pipefail`). Key material lives in memory and in a private temp directory only; it is never in argv (only the key
// FILE path is), in a line, in a result or in an error message.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tool } from './context.mjs';
import { restrictToUser, writePrivate } from './private-file.mjs';
import { refusal } from './errors.mjs';
import { createSshSession, sessionDirectory } from './ssh-session.mjs';

const ACCOUNT = /^[A-Za-z0-9._@-]+$/u;
const CI_VARIABLES = ['VPS_SSH_KEY', 'VPS_KNOWN_HOSTS', 'VPS_HOST', 'VPS_USER'];
const SSH_OPTIONS = ['-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20'];

/** Removes every carriage return. */
export const lfOnly = (text) => String(text).replaceAll('\r', '');

/** POSIX single-quote quoting; NUL and line breaks cannot be quoted safely and are refused. */
export function shellQuote(value) {
  const text = String(value);
  if (text.includes('\0') || /[\r\n]/u.test(text)) throw refusal('STACK_REMOTE_ARGUMENT', 'a remote argument must not contain NUL or a line break');
  return ["'", text.replaceAll("'", String.raw`'\''`), "'"].join('');
}

/** Runs `docker <args>` on the manager through `run` (every argument quoted). */
export const remoteDocker = (run, args) => run(['docker', ...args.map(shellQuote)].join(' '));

const noop = () => {};

function makeRunner(ctx, argv, { cleanup = noop, notes = [], connection } = {}) {
  const [command, ...head] = argv;
  const run = (remote, { input } = {}) => {
    const options = input === undefined ? {} : { input: lfOnly(input) };
    const result = connection ? connection.remote(lfOnly(remote), options) : tool(ctx, command, [...head, lfOnly(remote)], options);
    if (result.error) return { status: 127, stdout: '', stderr: `cannot run ${command}: ${result.error.message}` };
    return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
  };
  return Object.assign(run, { cleanup, notes });
}

function sshCommandArgv(sshCmd) {
  const parts = String(sshCmd).split(/\s+/u).filter(Boolean);
  if (parts.length === 0) throw refusal('STACK_REMOTE_SSH_CMD', '--ssh-cmd is empty');
  return parts;
}

/** A sealed binary member is the file itself; a JSON object around it ({ data | <names> }, the re-sealed shape of `starci app secret rename`) is unwrapped. */
function unwrap(text, names) {
  const body = lfOnly(text);
  const trimmed = body.trim();
  if (!trimmed.startsWith('{')) return body;
  let parsed;
  try { parsed = JSON.parse(trimmed); } catch { return body; }
  for (const name of ['data', ...names]) if (typeof parsed[name] === 'string') return lfOnly(parsed[name]);
  return body;
}

function openMember(slug, read) {
  try { return read(); } catch (error) { throw refusal('STACK_REMOTE_SEALED', `cannot open the sealed member ${slug}: ${error.message}`); }
}

function opsAccount(ctx, config) {
  const slug = config.remote.sealed.ops;
  const map = openMember(slug, () => ctx.sops.decrypt(path.join(config.secretsDir, `${slug}.enc`), 'dotenv'));
  for (const name of ['VPS_HOST', 'VPS_USER']) {
    const value = map[name];
    if (typeof value !== 'string' || !ACCOUNT.test(value) || value.startsWith('-')) throw refusal('STACK_REMOTE_OPS', `${slug} must hold ${name} (letters, digits, . _ @ -)`);
  }
  return `${map.VPS_USER}@${map.VPS_HOST}`;
}

function binaryMember(ctx, config, slug, names) {
  return unwrap(openMember(slug, () => ctx.sops.decryptBinary(path.join(config.secretsDir, `${slug}.enc`))), names);
}

const withNewline = (text) => `${text.trim()}\n`;

/** CI (a Linux runner): the file with exactly this mode. */
function writeWithMode(file, text, mode) {
  fs.writeFileSync(file, text, { mode });
  fs.chmodSync(file, mode);
}

/** The owner-machine session files: key and known_hosts in a private temp directory, removed (key overwritten) by cleanup(). */
export function openSealedSession(ctx, config) {
  const { sealed } = config.remote;
  const account = opsAccount(ctx, config);
  const key = binaryMember(ctx, config, sealed.sshKey, ['privateKey', 'key']);
  if (!key.includes('PRIVATE KEY')) throw refusal('STACK_REMOTE_KEY', `${sealed.sshKey} does not hold a PEM private key`);
  const known = binaryMember(ctx, config, sealed.knownHosts, ['knownHosts', 'known_hosts']).trim();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-ssh-'));
  const keyFile = path.join(dir, 'id');
  const knownFile = path.join(dir, 'known_hosts');
  const cleanup = () => {
    if (fs.existsSync(keyFile)) {
      restrictToUser(ctx, keyFile, 'F');
      fs.writeFileSync(keyFile, '0'.repeat(key.length));
    }
    fs.rmSync(dir, { recursive: true, force: true });
  };
  try {
    writePrivate(ctx, keyFile, withNewline(key));
    writePrivate(ctx, knownFile, known ? withNewline(known) : '');
  } catch (error) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }
  const notes = known ? [] : ['owner-machine session without known_hosts: the host key is accepted on first contact (accept-new); verify it, CI never does this'];
  return { account, dir, keyFile, knownFile, strict: known ? 'yes' : 'accept-new', notes, cleanup };
}

/** The owner-machine runner over that session. */
function sealedRunner(ctx, config) {
  const session = openSealedSession(ctx, config);
  const argv = ['ssh', '-T', '-i', session.keyFile, '-o', 'IdentitiesOnly=yes', '-o', `UserKnownHostsFile=${session.knownFile}`, '-o', `StrictHostKeyChecking=${session.strict}`, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', session.account];
  return sessionRunner(ctx, argv, session.dir, session.cleanup, session.notes);
}

function sessionRunner(ctx, argv, dir, cleanup, notes = []) {
  const connection = createSshSession(ctx, { argv, controlPath: path.join(dir, 'cm').replaceAll('\\', '/'), cleanup });
  return makeRunner(ctx, argv, { connection, cleanup: connection.close, notes });
}

/** The ssh runner of one invocation (see the top of the file). */
function sshRunner(ctx, config, { sshCmd = null } = {}) {
  if (ctx.stackSsh && !sshCmd) return makeRunner(ctx, ['ssh'], { connection: ctx.stackSsh });
  if (sshCmd) return makeRunner(ctx, sshCommandArgv(sshCmd));
  if (config.remote.sealed && ctx.env.STARCI_STACK_SEALED_SSH === '1') return sealedRunner(ctx, config);
  const dir = sessionDirectory();
  return sessionRunner(ctx, ['ssh', ...SSH_OPTIONS, config.remote.host], dir, () => fs.rmSync(dir, { recursive: true, force: true }));
}

/**
 * The context to open the runner with. On an operator machine (not CI, no --ssh-cmd, the sealed members exist, no explicit
 * STARCI_STACK_SEALED_SSH) the sealed session is selected; otherwise the context is returned unchanged.
 */
function withOwnerTransport(ctx, config, { sshCmd = null } = {}) {
  const { sealed } = config.remote;
  if (sshCmd || !sealed || ctx.env.GITHUB_ACTIONS === 'true' || ctx.env.STARCI_STACK_SEALED_SSH !== undefined) return ctx;
  const present = [sealed.ops, sealed.sshKey, sealed.knownHosts].every((slug) => fs.existsSync(path.join(config.secretsDir, `${slug}.enc`)));
  if (!present) return ctx;
  return Object.create(ctx, { env: { value: { ...ctx.env, STARCI_STACK_SEALED_SSH: '1' }, enumerable: true } });
}

/** The runner of a verb that opens it itself (deploy, rollback, accept): the owner-machine session is selected exactly as `withRunner` does. */
export const ownerSshRunner = (ctx, config, options = {}) => sshRunner(withOwnerTransport(ctx, config, options), config, options);

/** Opens the runner (`deps.ssh` wins in specs), calls `body(run, notes)` and always cleans the session up. */
export async function withRunner(ctx, config, options, deps, body) {
  const run = deps.ssh ?? sshRunner(withOwnerTransport(ctx, config, options), config, options);
  try {
    return await body(run, run.notes ?? []);
  } finally {
    await run.cleanup?.();
  }
}

function ciHome(ctx) {
  if (ctx.env.GITHUB_ACTIONS !== 'true') throw refusal('STACK_CONNECT_CI_ONLY', 'connect and disconnect run only in GitHub Actions (GITHUB_ACTIONS=true)');
  if (!ctx.env.HOME) throw refusal('STACK_CONNECT_NO_HOME', 'HOME is not set');
  return path.join(ctx.env.HOME, '.ssh');
}

function ciInputs(ctx) {
  for (const name of CI_VARIABLES) if (!ctx.env[name]) throw refusal('STACK_CONNECT_MISSING', `${name} is not set`);
  for (const name of ['VPS_HOST', 'VPS_USER']) {
    if (!ACCOUNT.test(ctx.env[name]) || ctx.env[name].startsWith('-')) throw refusal('STACK_CONNECT_INVALID', `${name} must match ${ACCOUNT}`);
  }
  const key = lfOnly(ctx.env.VPS_SSH_KEY);
  if (!key.includes('PRIVATE KEY')) throw refusal('STACK_CONNECT_INVALID', 'VPS_SSH_KEY is not a PEM private key');
  if (!ctx.env.GITHUB_ENV) throw refusal('STACK_CONNECT_NO_GITHUB_ENV', 'GITHUB_ENV is not set');
  return { key: withNewline(key), known: withNewline(lfOnly(ctx.env.VPS_KNOWN_HOSTS)), host: ctx.env.VPS_HOST, user: ctx.env.VPS_USER };
}

const sshBlock = (alias, inputs) => [
  '', `Host ${alias}`, `  HostName ${inputs.host}`, `  User ${inputs.user}`, '  IdentityFile ~/.ssh/deploy_key',
  '  StrictHostKeyChecking yes', '  BatchMode yes', '  ConnectTimeout 20', '  ServerAliveInterval 30',
  '  ControlMaster auto', '  ControlPath ~/.ssh/cm-%C', '  ControlPersist 60', '',
].join('\n');

/** CI transport: pinned key, known_hosts, ssh config block and DOCKER_HOST=ssh://<alias> in $GITHUB_ENV. */
export async function connectCi(ctx, config, { execute = false } = {}) {
  const dir = ciHome(ctx);
  const inputs = ciInputs(ctx);
  const alias = config.remote.host;
  const plan = [`${dir}/deploy_key (0600) from VPS_SSH_KEY`, `${dir}/known_hosts (0644) from VPS_KNOWN_HOSTS`, `a Host ${alias} block in ${dir}/config`, `DOCKER_HOST=ssh://${alias} in GITHUB_ENV`];
  const data = { host: alias, files: ['deploy_key', 'known_hosts', 'config'] };
  if (!execute) return { ok: true, lines: plan.map((item) => `dry run: would write ${item}`), data };
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeWithMode(path.join(dir, 'deploy_key'), inputs.key, 0o600);
  writeWithMode(path.join(dir, 'known_hosts'), inputs.known, 0o644);
  fs.appendFileSync(path.join(dir, 'config'), sshBlock(alias, inputs), { mode: 0o600 });
  fs.appendFileSync(ctx.env.GITHUB_ENV, `DOCKER_HOST=ssh://${alias}\n`);
  return { ok: true, lines: plan.map((item) => `wrote ${item}`), data };
}

/** CI cleanup: closes the ssh control master (failure ignored) and removes the deploy key. */
export async function disconnectCi(ctx, config, { execute = false } = {}) {
  const dir = ciHome(ctx);
  const alias = config.remote.host;
  const data = { host: alias };
  if (!execute) return { ok: true, lines: [`dry run: would run ssh -O exit ${alias} and remove ${dir}/deploy_key`], data };
  tool(ctx, 'ssh', ['-O', 'exit', alias]);
  fs.rmSync(path.join(dir, 'deploy_key'), { force: true });
  return { ok: true, lines: [`closed the ssh session to ${alias} and removed ${dir}/deploy_key`], data };
}
