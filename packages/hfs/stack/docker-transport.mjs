// docker-transport.mjs - lets the verbs that drive the docker CLI (deploy, converge, verify, rollback, prune) reach the manager from an OPERATOR
// machine or CI. The command shares one POSIX control master (including remote scripts) or one Windows Docker socket tunnel. On an operator
// machine the key lives in the sealed members, so the docker CLI is run with a private HOME that holds the session's ssh config. Only children that did not get
// an explicit environment are affected (the minimal environment of `docker stack config` stays exactly as the render built it). The key lives in
// a private temp directory that is overwritten and removed when the verb ends; it is never in argv, a line or an error.
import fs from 'node:fs';
import path from 'node:path';
import { writePrivate } from './private-file.mjs';
import { openSealedSession } from './remote.mjs';
import { controlSettings, createSshSession, sessionDirectory } from './ssh-session.mjs';
import { failure } from './errors.mjs';

const ALIAS = 'stack-vps';
const forward = (file) => file.replaceAll('\\', '/');
const configPath = (file) => '"' + forward(file).replaceAll('"', '\\"') + '"';
const controlLines = (controlPath) => controlSettings(configPath(controlPath)).map((setting) => `  ${setting.replace('=', ' ')}`);

/** True when the operator's docker CLI has to be pointed at the manager by this module. */
function needed(ctx, config, sshCmd) {
  if (sshCmd || ctx.env.DOCKER_HOST || ctx.env.GITHUB_ACTIONS === 'true' || ctx.env.STARCI_STACK_SEALED_SSH === '0') return false;
  const { sealed } = config.remote;
  if (!sealed) return false;
  return [sealed.ops, sealed.sshKey, sealed.knownHosts].every((slug) => fs.existsSync(path.join(config.secretsDir, `${slug}.enc`)));
}

function sshConfig(session, controlPath, windows) {
  const at = session.account.lastIndexOf('@');
  return [
    `Host ${ALIAS}`, `  HostName ${session.account.slice(at + 1)}`, `  User ${session.account.slice(0, at)}`,
    `  IdentityFile ${configPath(session.keyFile)}`, '  IdentitiesOnly yes', `  UserKnownHostsFile ${configPath(session.knownFile)}`,
    `  StrictHostKeyChecking ${session.strict}`, '  BatchMode yes', '  ConnectTimeout 20',
    ...(windows ? [] : controlLines(controlPath)), '',
  ].join('\n');
}

/** The environment of a docker child: a private HOME with the ssh config, DOCKER_HOST, and the operator's docker config (registry logins) kept. */
function dockerEnvironment(ctx, session, controlPath) {
  const home = path.join(session.dir, 'home');
  fs.mkdirSync(path.join(home, '.ssh'), { recursive: true });
  writePrivate(ctx, path.join(home, '.ssh', 'config'), sshConfig(session, controlPath, (ctx.platform ?? process.platform) === 'win32'));
  const operatorHome = ctx.env.HOME ?? ctx.env.USERPROFILE ?? '';
  const dockerConfig = ctx.env.DOCKER_CONFIG ?? (operatorHome ? path.join(operatorHome, '.docker') : undefined);
  return { ...ctx.env, HOME: home, USERPROFILE: home, DOCKER_HOST: `ssh://${ALIAS}`, ...(dockerConfig ? { DOCKER_CONFIG: dockerConfig } : {}) };
}

/** OpenSSH resolves its default config from the account database, so Docker needs a private PATH entry that supplies -F explicitly. */
function privateSshEnvironment(ctx, env, dir, controlPath) {
  if ((ctx.platform ?? process.platform) === 'win32') return { env, executable: 'ssh' };
  const originalHome = ctx.env.HOME;
  const home = path.join(dir, 'home');
  const config = path.join(home, '.ssh', 'config');
  fs.mkdirSync(path.dirname(config), { recursive: true, mode: 0o700 });
  if (!fs.existsSync(config)) {
    const include = originalHome ? `Include ${configPath(path.join(originalHome, '.ssh', 'config'))}\n` : '';
    writePrivate(ctx, config, ['Host *', ...controlLines(controlPath), 'Host *', include].join('\n'));
  }
  const executable = ctx.sshPath ?? findSsh(ctx.env.PATH ?? process.env.PATH);
  const bin = path.join(home, 'bin');
  fs.mkdirSync(bin, { mode: 0o700 });
  const shim = path.join(bin, 'ssh');
  writePrivate(ctx, shim, `#!/bin/sh\nexec ${posixQuote(executable)} -F ${posixQuote(config)} "$@"\n`);
  fs.chmodSync(shim, 0o700);
  const dockerConfig = env.DOCKER_CONFIG ?? (originalHome ? path.join(originalHome, '.docker') : undefined);
  return { env: { ...env, HOME: home, PATH: `${bin}:${env.PATH ?? process.env.PATH ?? ''}`, ...(dockerConfig ? { DOCKER_CONFIG: dockerConfig } : {}) }, executable };
}

const posixQuote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";

function findSsh(searchPath = '') {
  const executable = searchPath.split(':').map((dir) => path.join(dir, 'ssh')).find((file) => fs.existsSync(file));
  if (!executable) throw failure('STACK_SSH_SESSION', 'cannot locate the SSH executable');
  return path.resolve(executable);
}

/** Runs `body(ctx')` where ctx'.spawn points the docker CLI at the manager when this is an operator machine; otherwise `body(ctx)`. */
export async function withDockerTransport(ctx, config, { sshCmd = null } = {}, body) {
  if (sshCmd) return body(ctx);
  const sealed = needed(ctx, config, sshCmd);
  const alias = sealed ? ALIAS : sshAlias(ctx.env.DOCKER_HOST);
  if (!alias) return body(ctx);
  const session = sealed ? openSealedSession(ctx, config) : null;
  const dir = session?.dir ?? sessionDirectory();
  let connection;
  try {
    const controlPath = forward(path.join(dir, 'home', 'cm'));
    const baseEnv = session ? dockerEnvironment(ctx, session, controlPath) : ctx.env;
    const { env, executable } = privateSshEnvironment(ctx, baseEnv, dir, controlPath);
    const configFile = path.join(env.HOME ?? '', '.ssh', 'config');
    const options = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20'];
    const argv = session || executable !== 'ssh' ? [executable, ...options, '-F', configFile, '--', alias] : ['ssh', ...options, '--', alias];
    connection = createSshSession(ctx, { argv, env, controlPath });
    const spawn = dockerSpawn(ctx, connection, env, alias);
    for (const note of session?.notes ?? []) ctx.stderr(`${note}\n`);
    return await body(Object.create(ctx, { spawn: { value: spawn }, stackSsh: { value: connection } }));
  } finally {
    try { await connection?.close(); } finally {
      if (session) session.cleanup();
      else fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

/** Only SSH Docker endpoints belong to this connection; TCP, unix and explicitly supplied child environments keep their behavior. */
function sshAlias(host) {
  if (!host?.startsWith('ssh://')) return null;
  const endpoint = new URL(host);
  if (endpoint.port || endpoint.pathname && endpoint.pathname !== '/') return null;
  return endpoint.username ? `${decodeURIComponent(endpoint.username)}@${endpoint.hostname}` : endpoint.hostname;
}

function dockerSpawn(ctx, connection, env, alias) {
  return (command, args, options = {}) => {
    if (command !== 'docker' || options.env !== undefined) return ctx.spawn(command, args, options);
    return ctx.spawn(command, args, { ...options, env: { ...env, DOCKER_HOST: connection.dockerHost(alias) } });
  };
}
