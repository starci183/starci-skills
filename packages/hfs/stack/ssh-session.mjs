// ssh-session.mjs - one lazy SSH master or loopback Docker tunnel, owned and closed by one stack command; all processes use ctx.spawn.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { failure } from './errors.mjs';

const FREE_PORT = "const net=require('node:net');const s=net.createServer();s.on('error',()=>process.exit(1));s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close();});";
const WAIT_PORT = "const net=require('node:net');const deadline=Date.now()+20000;function probe(){const s=net.connect({host:'127.0.0.1',port:Number(process.argv[1])});s.setTimeout(200);s.on('connect',()=>{s.destroy();process.exit(0);});function retry(){s.destroy();if(Date.now()>=deadline)process.exit(1);else setTimeout(probe,50);}s.on('error',retry);s.on('timeout',retry);}probe();";

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
  let port;
  let closed = false;

  function start() {
    if (closed) throw failure('STACK_SSH_SESSION', 'the command session is already closed');
    if (ready) return;
    if (started) throw failure('STACK_SSH_SESSION', 'the SSH connection failed to open');
    started = true;
    if (windows) {
      port = freePort(ctx);
      child = ctx.spawn(command, ['-N', '-o', 'ExitOnForwardFailure=yes', '-L', `127.0.0.1:${port}:${socket}`, ...head], { env, background: true });
      if (typeof child?.kill !== 'function') {
        child = undefined;
        throw failure('STACK_SSH_SESSION', 'cannot start the Docker SSH tunnel');
      }
      const probe = ctx.spawn(process.execPath, ['-e', WAIT_PORT, String(port)]);
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
    return windows ? `tcp://127.0.0.1:${port}` : `ssh://${alias}`;
  }

  function close() {
    if (closed) return;
    closed = true;
    if (windows && child) return closeTunnel(child, cleanup);
    try {
      if (!windows && started) ctx.spawn(command, ['-O', 'exit', ...controls, ...head], { env });
    } finally {
      cleanup();
    }
  }

  return { remote, dockerHost, close };
}

/** A short private directory for an invocation whose SSH credentials already live in the operator or CI HOME. */
export function sessionDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sc-'));
}
