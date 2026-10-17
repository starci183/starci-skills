// ssh-session.mjs - one command-owned connection; all processes use ctx.spawn. Windows prefers a Unix socket in private 0700 HOME
// when runtime ssh -V reports OpenSSH >= 6.7 and a local AF_UNIX Docker CLI probe succeeds. Otherwise a fresh ephemeral TCP
// port is asserted to bind only 127.0.0.1 and never reaches files or logs. Finally and SIGINT/SIGTERM close the tunnel.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { failure } from './errors.mjs';
import { restrictToUser } from './private-file.mjs';

const FREE_PORT = "const net=require('node:net');const s=net.createServer();s.on('error',()=>process.exit(1));s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close();});";
const WAIT_PORT = "const net=require('node:net');const deadline=Date.now()+20000;function probe(){const s=net.connect({host:'127.0.0.1',port:Number(process.argv[1])});s.setTimeout(200);s.on('connect',()=>{s.destroy();process.exit(0);});function retry(){s.destroy();if(Date.now()>=deadline)process.exit(1);else setTimeout(probe,50);}s.on('error',retry);s.on('timeout',retry);}probe();";

const WAIT_SOCKET = WAIT_PORT.replace("{host:'127.0.0.1',port:Number(process.argv[1])}", '{path:process.argv[1]}');
const UNIX_PROBE = String.raw`
const http = require('node:http');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const socket = process.argv[1];
let child;
function finish(code) {
  child?.kill();
  server.close();
  try { fs.unlinkSync(socket); } catch {}
  process.exit(code);
}
const server = http.createServer((req, res) => {
  res.setHeader('Api-Version', '1.47');
  res.setHeader('Content-Type', 'application/json');
  res.end(req.url.endsWith('/_ping') ? 'OK' : JSON.stringify({ Version: '27.0.0', ApiVersion: '1.47', MinAPIVersion: '1.24', Os: 'linux', Arch: 'amd64' }));
});
server.on('error', () => finish(1));
server.listen(socket, () => {
  child = spawn('docker', ['--host', 'unix://' + socket.replaceAll('\\', '/'), 'version', '--format', '{{.Server.Version}}'], { stdio: 'ignore', windowsHide: true });
  child.on('error', () => finish(1));
  child.on('exit', code => finish(code === 0 ? 0 : 1));
});
setTimeout(() => finish(1), 5000);
`;

/** TCP Docker forwarding must never expose the manager on a non-loopback interface. */
function loopbackForward(bind, port, socket) {
  if (bind !== '127.0.0.1') throw failure('STACK_SSH_SESSION', 'the Docker tunnel must bind 127.0.0.1');
  return `${bind}:${port}:${socket}`;
}

function unixEndpoint(ctx, command, env) {
  const version = ctx.spawn(command, ['-V'], { env });
  const match = /OpenSSH(?:_for_Windows)?_(\d+)\.(\d+)/u.exec(`${version.stderr ?? ''} ${version.stdout ?? ''}`);
  if (!successful(version) || !match || Number(match[1]) < 6 || Number(match[1]) === 6 && Number(match[2]) < 7) return null;
  if (!env.HOME) return null;
  fs.mkdirSync(env.HOME, { recursive: true, mode: 0o700 });
  fs.chmodSync(env.HOME, 0o700);
  restrictToUser(ctx, env.HOME, '(OI)(CI)F');
  const probe = path.join(env.HOME, 'probe.sock');
  try {
    if (!successful(ctx.spawn(process.execPath, ['-e', UNIX_PROBE, probe], { env, timeout: 7000 }))) return null;
  } finally {
    fs.rmSync(probe, { force: true });
  }
  return path.join(env.HOME, 'docker.sock').replaceAll('\\', '/');
}

/** The same multiplexing settings belong to the master, remote commands and Docker's SSH alias. */
export function controlSettings(controlPath) {
  return ['ControlMaster=auto', `ControlPath=${controlPath}`, 'ControlPersist=60'];
}

function successful(result) {
  return !result.error && result.status === 0;
}

function freePort(ctx) {
  const result = ctx.spawn(process.execPath, ['-e', FREE_PORT]);
  const port = Number(result.stdout?.trim());
  if (!successful(result) || !Number.isInteger(port) || port < 1 || port > 65535) throw failure('STACK_SSH_SESSION', 'cannot allocate a loopback port');
  return port;
}

/** Waits for the tunnel child to exit before any private credentials are removed. */
function stopTunnel(child) {
  if (!child || child.spawnError || child.exitCode !== null && child.exitCode !== undefined || child.signalCode) return;
  if (!child.once) { child.kill(); return; }
  return new Promise((resolve) => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
    child.once('close', () => { clearTimeout(timer); resolve(); });
    child.kill();
  });
}

async function closeTunnel(child, cleanup) {
  try { await stopTunnel(child); } finally { cleanup(); }
}

/** Creates a lazy connection; no SSH is spawned until a Docker query or remote command needs it. */
export function createSshSession(ctx, { argv, env = ctx.env, controlPath, socket = '/var/run/docker.sock', cleanup = () => {} }) {
  const windows = (ctx.platform ?? process.platform) === 'win32';
  const [command, ...head] = argv;
  const controls = windows ? [] : controlSettings(controlPath).flatMap((setting) => ['-o', setting]);
  let started = false;
  let ready = false;
  let child;
  let host;
  let closing;
  const signalHandlers = new Map();
  let closed = false;

  function start() {
    if (closed) throw failure('STACK_SSH_SESSION', 'the command session is already closed');
    if (ready) return;
    if (started) throw failure('STACK_SSH_SESSION', 'the SSH connection failed to open');
    started = true;
    if (windows) {
      const localSocket = unixEndpoint(ctx, command, env);
      const port = localSocket ? null : freePort(ctx);
      const forward = localSocket ? `./docker.sock:${socket}` : loopbackForward('127.0.0.1', port, socket);
      host = localSocket ? `unix://${localSocket}` : `tcp://127.0.0.1:${port}`;
      child = ctx.spawn(command, ['-N', '-o', 'ExitOnForwardFailure=yes', '-o', 'GatewayPorts=no', ...(localSocket ? ['-o', 'StreamLocalBindMask=0177'] : []), '-L', forward, ...head], { env, cwd: localSocket ? env.HOME : undefined, background: true });
      if (typeof child?.kill !== 'function') {
        child = undefined;
        throw failure('STACK_SSH_SESSION', 'cannot start the Docker SSH tunnel');
      }
      installSignals();
      const probeArgs = localSocket ? ['-e', WAIT_SOCKET, localSocket] : ['-e', WAIT_PORT, String(port)];
      const probe = ctx.spawn(process.execPath, probeArgs, { env, timeout: 25000 });
      if (!successful(probe)) throw failure('STACK_SSH_SESSION', 'the Docker SSH tunnel did not become ready');
    } else {
      const result = ctx.spawn(command, ['-MNf', ...controls, ...head], { env });
      if (!successful(result)) throw failure('STACK_SSH_SESSION', 'cannot open the SSH control master');
    }
    ready = true;
  }

  function remote(remoteCommand, options = {}) {
    // Windows cannot multiplex exec channels; Docker queries share the tunnel and remote scripts remain one call per step.
    if (!windows) start();
    return ctx.spawn(command, [...controls, ...head, remoteCommand], { ...options, env });
  }

  function dockerHost(alias) {
    start();
    return windows ? host : `ssh://${alias}`;
  }

  function installSignals() {
    for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
      const handler = () => { Promise.resolve(close()).finally(() => process.exit(code)); };
      signalHandlers.set(signal, handler);
      process.once(signal, handler);
    }
  }

  function finish() {
    for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
    signalHandlers.clear();
    cleanup();
  }

  function close() {
    if (closed) return closing;
    closed = true;
    if (windows && child) {
      closing = closeTunnel(child, finish);
      return closing;
    }
    try {
      if (!windows && started) ctx.spawn(command, ['-O', 'exit', ...controls, ...head], { env });
    } finally {
      finish();
    }
  }

  return { remote, dockerHost, close };
}

/** A short private directory for an invocation whose SSH credentials already live in the operator or CI HOME. */
export function sessionDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sc-'));
}
