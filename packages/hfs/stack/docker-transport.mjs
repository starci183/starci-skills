// docker-transport.mjs - lets the verbs that drive the docker CLI (deploy, converge, verify, rollback, prune) reach the manager from an OPERATOR
// machine. In CI `connect` writes the ssh config and DOCKER_HOST; on an operator machine the key lives in the sealed members, so the docker CLI
// is run with a private HOME that holds an ssh config for the sealed session and DOCKER_HOST=ssh://<alias>. Only `docker` children that did not get
// an explicit environment are affected (the minimal environment of `docker stack config` stays exactly as the render built it). The key lives in
// a private temp directory that is overwritten and removed when the verb ends; it is never in argv, a line or an error.
import fs from 'node:fs';
import path from 'node:path';
import { writePrivate } from './private-file.mjs';
import { openSealedSession } from './remote.mjs';

const ALIAS = 'stack-vps';
const forward = (file) => file.replaceAll('\\', '/');

/** True when the operator's docker CLI has to be pointed at the manager by this module. */
function needed(ctx, config, sshCmd) {
  if (sshCmd || ctx.env.DOCKER_HOST || ctx.env.GITHUB_ACTIONS === 'true' || ctx.env.STARCI_STACK_SEALED_SSH === '0') return false;
  const { sealed } = config.remote;
  if (!sealed) return false;
  return [sealed.ops, sealed.sshKey, sealed.knownHosts].every((slug) => fs.existsSync(path.join(config.secretsDir, `${slug}.enc`)));
}

function sshConfig(session) {
  const at = session.account.lastIndexOf('@');
  return [
    `Host ${ALIAS}`, `  HostName ${session.account.slice(at + 1)}`, `  User ${session.account.slice(0, at)}`,
    `  IdentityFile ${forward(session.keyFile)}`, '  IdentitiesOnly yes', `  UserKnownHostsFile ${forward(session.knownFile)}`,
    `  StrictHostKeyChecking ${session.strict}`, '  BatchMode yes', '  ConnectTimeout 20', '',
  ].join('\n');
}

/** The environment of a docker child: a private HOME with the ssh config, DOCKER_HOST, and the operator's docker config (registry logins) kept. */
function dockerEnvironment(ctx, session) {
  const home = path.join(session.dir, 'home');
  fs.mkdirSync(path.join(home, '.ssh'), { recursive: true });
  writePrivate(ctx, path.join(home, '.ssh', 'config'), sshConfig(session));
  const operatorHome = ctx.env.HOME ?? ctx.env.USERPROFILE ?? '';
  const dockerConfig = ctx.env.DOCKER_CONFIG ?? (operatorHome ? path.join(operatorHome, '.docker') : undefined);
  return { ...ctx.env, HOME: home, USERPROFILE: home, DOCKER_HOST: `ssh://${ALIAS}`, ...(dockerConfig ? { DOCKER_CONFIG: dockerConfig } : {}) };
}

/** Runs `body(ctx')` where ctx'.spawn points the docker CLI at the manager when this is an operator machine; otherwise `body(ctx)`. */
export async function withDockerTransport(ctx, config, { sshCmd = null } = {}, body) {
  if (!needed(ctx, config, sshCmd)) return body(ctx);
  const session = openSealedSession(ctx, config);
  const env = dockerEnvironment(ctx, session);
  const spawn = (command, args, options = {}) => (command === 'docker' && options.env === undefined ? ctx.spawn(command, args, { ...options, env }) : ctx.spawn(command, args, options));
  for (const note of session.notes) ctx.stderr(`${note}\n`);
  try {
    return await body(Object.create(ctx, { spawn: { value: spawn } }));
  } finally {
    session.cleanup();
  }
}
