#!/usr/bin/env node
// tunnel.mjs — keeps one cloudflared tunnel pointed at the ask gateway
// (scripts/connectors/ask-gateway.mjs) and records the public base URL the
// Telegram notifier links to (docs/connectors.md).
//
//   node scripts/connectors/tunnel.mjs start       launch the manager detached
//   node scripts/connectors/tunnel.mjs run         run the manager in the foreground
//   node scripts/connectors/tunnel.mjs status | stop
//   node scripts/connectors/tunnel.mjs dry-run     print the cloudflared command and the generated config
//
// Mode (config.yaml connectors.cloudflare.mode):
//   quick — `cloudflared tunnel --url http://127.0.0.1:<port>`: a random
//           https://*.trycloudflare.com host parsed from cloudflared's output.
//   named — `tunnel` + `credentialsFile`: the manager writes its OWN config
//           (tunnel, credentials-file, ingress hostname -> gateway, then
//           http_status:404) and runs `cloudflared tunnel --config <it> run <id>`;
//           or a remotely managed tunnel token from `tokenEnv`, passed to
//           cloudflared as TUNNEL_TOKEN in its environment, never on argv.
// cloudflared is always given an explicit --config the manager writes under
// %LOCALAPPDATA%/StarCi/cloudflared (its text is also kept in the connectors
// row), so ~/.cloudflared/config.yml (which may belong to another tunnel) is
// never read.
//
// The manager restarts cloudflared when it dies (backoff 1s doubling to 60s,
// reset after 5 minutes of uptime) and keeps its state in the machine.sqlite
// connectors row 'tunnel'. cloudflared's notable output lines (its URL, its edge
// connection, errors) go to machine_logs (actor connector, kind
// tunnel.cloudflared); when it exits, the tail of its output is kept as a blob
// named by that exit's log row. STARCI_CLOUDFLARED_COMMAND and
// STARCI_CLOUDFLARED_ARGS (a JSON list of prefix args) replace the binary for
// tests, the way STARCI_ORCA_COMMAND does for Orca; STARCI_TUNNEL_BACKOFF_MS
// sets the first restart delay.
//
// One manager per host, enforced three ways (18 managers once ran at once):
// `run` claims the host lock 'tunnel' (machine.sqlite host_locks) and a loser
// exits at once (exit 1); the winner re-checks every STARCI_TUNNEL_OWNER_CHECK_MS
// (30 s) that the lock still names it and exits the moment another live process
// holds it; and a starter (`start`, ensureAskConnectors) never launches while a
// manager is alive or one it launched in the last 30 s is still starting (the
// lock row in state 'starting'). `status` is the health the supervisor reads:
// the manager, cloudflared and gateway pids and whether each lives, whether
// the gateway answers on its port, every `tunnel.mjs run` process on the host
// (more than one is a leak), `healthy`, and `problems`.
import '../api/process/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { tunnelRun } from '../api/cloudflared/tunnel-run.mjs';
import { probe } from '../api/http/probe.mjs';
import { fileURLToPath } from 'node:url';
import { connectorEnv, connectorSecret, connectorsConfig } from '../../engine/config.mjs';
import { pidAlive, starciLocalRoot, withMachine } from '../../engine/db/machine.mjs';
import { argsOf, claimManager, connectorLog, connectorState, lockHolder, markStarting, ownerConfig, recordAlive, spawnDetached, startingHolder, writeConnectorState } from './lib.mjs';
import { parseJson } from '../lib/json.mjs';
import { GATEWAY_FILE, gatewayAlive, gatewayState } from './ask-gateway.mjs';
import { listHostProcesses } from '../api/process/process-list.mjs';
import { isMain } from '../lib/is-main.mjs';

export const TUNNEL_FILE = fileURLToPath(import.meta.url);

const QUICK_URL = /https:\/\/(?!api\.)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.trycloudflare\.com\b/i;
const CONNECTED = /Registered tunnel connection|Connection [0-9a-f-]+ registered/i;
// The cloudflared output kept in memory; its tail becomes a blob when cloudflared exits.
const TAIL_CAP = 256 * 1024;
const NOTABLE = /ERR|error|fail|trycloudflare\.com|Registered tunnel connection|Connection [0-9a-f-]+ registered/i;

/** The public https://*.trycloudflare.com URL a quick tunnel printed, or null. */
export const parseQuickTunnelUrl = (text) => String(text ?? '').match(QUICK_URL)?.[0]?.toLowerCase() ?? null;
/** Whether cloudflared output reports a registered edge connection. */
export const parseConnected = (text) => CONNECTED.test(String(text ?? ''));

/** The tunnel manager's connectors row ({pid, childPid, baseUrl, connected, ...}), or null. */
export const tunnelState = (env = process.env) => connectorState('tunnel', env);
/** The config file cloudflared is started with: %LOCALAPPDATA%/StarCi/cloudflared/cloudflared.yml. */
export const cloudflaredConfigFile = (env = process.env) => path.join(starciLocalRoot(env), 'cloudflared', 'cloudflared.yml');

/**
 * The public base the notifier may link to: only while the manager is alive and cloudflared has
 * reported its URL (quick) or a registered connection (named).
 */
export function publicBase(env = process.env) {
  const s = tunnelState(env);
  if (!recordAlive(s) || !s.baseUrl || !s.connected) return null;
  return s.baseUrl;
}

const yamlString = (value) => JSON.stringify(String(value));

/** The config file cloudflared runs with — never the user's default ~/.cloudflared/config.yml. */
export function cloudflaredConfigText(cf, port) {
  const lines = ['# Generated by StarCi scripts/connectors/tunnel.mjs; rewritten on every start.', 'no-autoupdate: true'];
  if (cf.mode === 'named' && cf.auth === 'credentials-file') {
    lines.push(`tunnel: ${yamlString(cf.tunnel)}`, `credentials-file: ${yamlString(cf.credentialsFile)}`, 'ingress:',
      `  - hostname: ${yamlString(cf.hostname)}`, `    service: ${yamlString(`http://127.0.0.1:${port}`)}`, '  - service: http_status:404');
  }
  return `${lines.join('\n')}\n`;
}

/**
 * The cloudflared invocation for a normalized connectors.cloudflare block: {command, args, env, configText}.
 * `env` carries TUNNEL_TOKEN only in token mode; callers never print it.
 */
export function cloudflaredPlan(cf, { port, configFile, env = process.env, secretEnv = env } = {}) {
  const command = env.STARCI_CLOUDFLARED_COMMAND || 'cloudflared';
  const prefix = parseJson(env.STARCI_CLOUDFLARED_ARGS, []);
  const base = ['tunnel', '--config', configFile, '--no-autoupdate'];
  const childEnv = { ...env };
  delete childEnv.TUNNEL_TOKEN;
  let args;
  if (cf.mode === 'quick') args = [...base, '--url', `http://127.0.0.1:${port}`];
  else if (cf.mode === 'named' && cf.auth === 'credentials-file') args = [...base, 'run', cf.tunnel];
  else if (cf.mode === 'named') {
    const token = connectorSecret(cf.tokenEnv, secretEnv);
    if (!token) throw Error(`cloudflare.mode named needs the tunnel token in ${cf.tokenEnv} (or ${cf.tokenEnv}_FILE), or tunnel + credentialsFile`);
    childEnv.TUNNEL_TOKEN = token;
    args = [...base, 'run'];
  } else throw Error(`cloudflare.mode ${cf.mode}: no tunnel to run`);
  return { command, args: [...prefix, ...args], env: childEnv, configText: cloudflaredConfigText(cf, port) };
}

/** cloudflared's output: notable lines to machine_logs, everything into a bounded tail kept for the exit blob. */
function cloudflaredOutput(env) {
  let tail = '';
  return {
    add(text) {
      tail = `${tail}${text}`.slice(-TAIL_CAP);
      for (const line of String(text).split(/\r?\n/).filter((l) => NOTABLE.test(l))) {
        connectorLog('tunnel', line.slice(0, 2000), { env, kind: 'cloudflared', level: /ERR|error|fail/i.test(line) ? 'warn' : 'info' });
      }
    },
    // The exit: one log row whose data names the blob holding the output tail.
    exit(detail) {
      let sha = null;
      try { if (tail) sha = withMachine((m) => m.putMachineBlob(tail, { mediaType: 'text/plain' }), { env }); } catch { sha = null; }
      connectorLog('tunnel', `cloudflared exited (code ${detail.code ?? '-'}, signal ${detail.signal ?? '-'})`, { env, kind: 'cloudflared-exit', level: 'warn', data: { ...detail, logSha: sha } });
      tail = '';
    },
  };
}

/** Run and keep alive cloudflared per `cf`. Resolves never; `stop()` on the returned handle ends it. */
export function superviseTunnel(cf, { port, env = process.env, secretEnv = env, onState = () => {} } = {}) {
  const configFile = cloudflaredConfigFile(env), output = cloudflaredOutput(env);
  const plan = cloudflaredPlan(cf, { port, configFile, env, secretEnv });
  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  fs.writeFileSync(configFile, plan.configText);
  const firstBackoff = Number(env.STARCI_TUNNEL_BACKOFF_MS ?? 1000);
  const state = {
    schema: 'starci/connector-tunnel@1', pid: process.pid, mode: cf.mode, auth: cf.auth ?? null, tunnel: cf.tunnel ?? null,
    hostname: cf.hostname ?? null, gatewayPort: port, childPid: null, baseUrl: cf.mode === 'named' ? `https://${cf.hostname}` : null,
    connected: false, access: cf.access === true, restarts: 0, lastExit: null, startedAt: new Date().toISOString(), updatedAt: null,
  };
  const save = () => {
    state.updatedAt = new Date().toISOString();
    try {
      writeConnectorState('tunnel', { kind: 'tunnel', state: state.stoppedAt ? 'stopped' : state.connected ? 'connected' : 'starting', pid: state.pid, port: state.gatewayPort,
        publicUrl: state.baseUrl ?? null, config: { ...state, configText: plan.configText } }, env);
    } catch { /* a busy store: the next save writes it */ }
    onState({ ...state });
  };
  let child = null, stopped = false, backoff = firstBackoff, timer = null;
  const launch = () => {
    if (stopped) return;
    const startedAt = Date.now();
    if (cf.mode === 'quick') state.baseUrl = null;
    state.connected = false;
    child = tunnelRun(plan.args, { command: plan.command, env: plan.env });
    state.childPid = child.pid ?? null; save();
    const onData = (chunk) => {
      const text = chunk.toString();
      output.add(text);
      let changed = false;
      if (cf.mode === 'quick' && !state.baseUrl) { const url = parseQuickTunnelUrl(text); if (url) { state.baseUrl = url; changed = true; } }
      if (!state.connected && parseConnected(text)) { state.connected = true; changed = true; }
      if (changed) save();
    };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    const exited = (code, signal) => {
      if (!child) return;
      child = null;
      state.childPid = null; state.connected = false;
      state.lastExit = { code: code ?? null, signal: signal ?? null, at: new Date().toISOString() };
      output.exit({ ...state.lastExit, restarts: state.restarts, stopped });
      if (stopped) { save(); return; }
      if (Date.now() - startedAt > 5 * 60 * 1000) backoff = firstBackoff;
      state.restarts += 1; save();
      timer = setTimeout(launch, backoff);
      backoff = Math.min(backoff * 2, 60000);
    };
    child.on('exit', exited);
    child.on('error', (error) => { output.add(`spawn error: ${error.message}\n`); exited(null, null); });
  };
  launch();
  return {
    state: () => ({ ...state }),
    save,
    // `save: false` when this manager lost the tunnel to another: its record must not overwrite theirs.
    stop({ save: record = true } = {}) {
      stopped = true; clearTimeout(timer);
      const running = child; child = null;
      if (running) { try { running.kill(); } catch { /* gone */ } }
      state.childPid = null; state.connected = false; state.stoppedAt = new Date().toISOString();
      if (record) save();
    },
  };
}

/**
 * The one tunnel manager for this host. `start` may be called by every serve-ask at once, and each
 * call used to launch its own manager before the first recorded itself (nine managers, nine
 * cloudflared). A manager claims the host lock 'tunnel' first and refuses while another live
 * manager holds the lock or owns the connectors row: {ok:false, holder}. Otherwise it supervises
 * cloudflared and returns {ok:true, handle, release}.
 */
export function runManager(cf, { port, env = process.env, secretEnv = env, checkMs = Number(env.STARCI_TUNNEL_OWNER_CHECK_MS ?? 30000), onLost = () => {} } = {}) {
  const claim = claimManager('tunnel', { current: tunnelState(env), env });
  if (!claim.ok) return { ok: false, holder: claim.holder ?? null };
  let handle;
  try { handle = superviseTunnel(cf, { port, env, secretEnv }); } catch (error) { claim.release(); throw error; }
  // The lock decides who owns the tunnel. A manager whose lock another live process now holds
  // stops its cloudflared without touching the connectors row and reports it (the CLI exits); one
  // whose lock was freed takes it back, so a single manager always holds it.
  const check = () => {
    const held = lockHolder('tunnel', env);
    if (held && held.pid !== process.pid) {
      clearInterval(timer);
      handle.stop({ save: false });
      onLost(held);
      return false;
    }
    // Freed (or a dead holder's): take it back; another claimant that got there first is seen by the next check.
    if (!held) claimManager('tunnel', { env });
    if (tunnelState(env)?.pid !== process.pid) handle.save();
    return true;
  };
  const timer = Number.isFinite(checkMs) && checkMs > 0 ? setInterval(check, checkMs) : null;
  timer?.unref?.();
  const release = () => { clearInterval(timer); claim.release(); };
  return { ok: true, handle, release, check };
}

/**
 * A live manager: the one the connectors row names, the holder of the host lock, or one a starter
 * launched moments ago that has not claimed the lock yet.
 */
export const managerAlive = (env = process.env) => {
  const state = tunnelState(env);
  return recordAlive(state) ? state : lockHolder('tunnel', env) ?? startingHolder('tunnel', env);
};

/**
 * Make sure the ask gateway and the tunnel manager run (connectors.cloudflare on): each is launched
 * detached only when no live one exists (gatewayAlive / managerAlive, which count a launch still
 * starting), so this never adds a second manager. Never throws: {ok, gateway, tunnel} | {skipped}.
 * A spec run never launches the real cloudflared (STARCI_CLOUDFLARED_COMMAND must point at a fake).
 */
export function ensureAskConnectors({ env = process.env, config = undefined, spawn: launch = spawnDetached } = {}) {
  try {
    if (env.STARCI_CONNECTORS_OFF === '1') return { ok: true, skipped: 'STARCI_CONNECTORS_OFF' };
    if (env.NODE_TEST_CONTEXT && !env.STARCI_CLOUDFLARED_COMMAND) return { ok: true, skipped: 'test context' };
    const owner = config === undefined ? ownerConfig() : config;
    if (!owner) return { ok: false, error: 'config.yaml cannot be read' };
    const connectors = connectorsConfig(owner, env), cf = connectors.cloudflare, port = String(connectors.gateway.port);
    if (cf.mode === 'off') return { ok: true, skipped: 'connectors.cloudflare.mode is off' };
    const out = { ok: true };
    if (gatewayAlive(env)) out.gateway = { already: gatewayState(env)?.pid ?? true };
    else { const pid = launch(GATEWAY_FILE, ['run', '--port', port], { env }); markStarting('gateway', pid, env); out.gateway = { launched: pid }; }
    const live = managerAlive(env);
    if (live) out.tunnel = { already: live.pid ?? true };
    else {
      cloudflaredPlan(cf, { port: Number(port), configFile: cloudflaredConfigFile(env), env, secretEnv: connectorEnv(owner, env) });
      const pid = launch(TUNNEL_FILE, ['run', '--port', port], { env });
      markStarting('tunnel', pid, env);
      out.tunnel = { launched: pid };
    }
    return out;
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

/** Whether something answers HTTP on 127.0.0.1:<port> — the gateway 404s `/` with its no-store headers. */
export const probeGateway = async (port, { timeoutMs = 3000 } = {}) => {
  if (!Number.isInteger(Number(port)) || Number(port) <= 0) return { reachable: false, status: null };
  const r = await probe(`http://127.0.0.1:${Number(port)}/`, { timeoutMs, follow: 0 });
  return r.state === 'answered' ? { reachable: true, status: r.status ?? null, gateway: r.headers?.['x-robots-tag'] === 'noindex, nofollow' } : { reachable: false, status: null };
};

/** Every `tunnel.mjs run` process on this host ({pid, commandLine}), or null when the table cannot be read. */
export function tunnelProcesses() {
  const rows = listHostProcesses({ where: "Name='node.exe'", match: /tunnel\.mjs\S*\s+run\b/, timeoutMs: 20000 });
  return rows ? rows.filter((p) => p.pid !== process.pid).map((p) => ({ pid: p.pid, commandLine: p.cmd })) : null;
}

/**
 * The connectors' health for the supervisor: {healthy, problems[], manager, cloudflared, gateway,
 * publicBase, managers}. Healthy = one live manager holding the lock, its cloudflared alive and
 * connected, the gateway alive and answering on its port, and no second `tunnel.mjs run`.
 */
export async function tunnelHealth({ env = process.env, processes = tunnelProcesses, probe = probeGateway } = {}) {
  const state = tunnelState(env), gw = gatewayState(env), lock = lockHolder('tunnel', env);
  const manager = { pid: state?.pid ?? null, alive: recordAlive(state), lockPid: lock?.pid ?? null };
  const cloudflared = { pid: state?.childPid ?? null, alive: pidAlive(state?.childPid), connected: state?.connected === true, restarts: state?.restarts ?? 0, lastExit: state?.lastExit ?? null };
  const port = gw?.port ?? state?.gatewayPort ?? null;
  const gateway = { pid: gw?.pid ?? null, alive: recordAlive(gw), port, ...(await probe(port)) };
  const managers = processes ? processes() : null;
  const problems = [];
  if (!manager.alive) problems.push('no live tunnel manager (tunnel.mjs start)');
  else if (manager.lockPid !== manager.pid) problems.push(manager.lockPid ? `the tunnel host lock names ${manager.lockPid}, the tunnel connectors row names ${manager.pid}` : 'the tunnel manager holds no tunnel host lock: restart it');
  if (manager.alive && !cloudflared.alive) problems.push('cloudflared is not running (the manager restarts it with backoff)');
  else if (manager.alive && !cloudflared.connected) problems.push('cloudflared has no registered edge connection yet');
  if (!gateway.alive) problems.push('no live ask gateway (ask-gateway.mjs start)');
  if (!gateway.reachable) problems.push(`nothing answers on 127.0.0.1:${port ?? '?'} (the gateway port): the public host returns 502`);
  const leaked = (managers ?? []).filter((p) => p.pid !== manager.pid);
  if (leaked.length) problems.push(`${leaked.length} extra tunnel manager(s) running: ${leaked.map((p) => p.pid).join(', ')} — kill them (only ${manager.pid ?? 'none'} owns the tunnel)`);
  return { healthy: problems.length === 0, problems, manager, cloudflared, gateway, publicBase: publicBase(env), managers };
}

const loadCloudflare = () => {
  const config = ownerConfig();
  if (!config) throw Error('config.yaml cannot be read');
  return { config, connectors: connectorsConfig(config), secretEnv: connectorEnv(config) };
};

async function main() {
  const args = argsOf(process.argv.slice(2));
  const verb = args._[0] ?? 'status';
  const state = tunnelState();
  const out = (value) => console.log(JSON.stringify(value));
  if (verb === 'status') {
    const health = await tunnelHealth({ processes: args.fast ? null : tunnelProcesses });
    out({ ok: true, running: Boolean(managerAlive()), publicBase: publicBase(), ...(state ?? {}), health });
    return;
  }
  if (verb === 'stop') {
    for (const pid of [state?.pid, state?.childPid]) if (pid && pidAlive(pid)) { try { process.kill(pid); } catch { /* gone */ } }
    out({ ok: true, stopped: state?.pid ?? null }); return;
  }
  let loaded;
  try { loaded = loadCloudflare(); } catch (error) { out({ ok: false, error: error.message }); process.exit(2); }
  const { connectors, secretEnv } = loaded, cf = connectors.cloudflare, port = Number(args.port ?? connectors.gateway.port);
  if (cf.mode === 'off') { out({ ok: false, error: 'connectors.cloudflare.mode is off in config.yaml' }); process.exit(2); }
  if (cf.auth === 'credentials-file' && !cf.credentialsPresent) { out({ ok: false, error: `cloudflare.credentialsFile ${cf.credentialsFile} does not exist` }); process.exit(2); }
  for (const warning of connectors.warnings) console.error(`warning: ${warning}`);
  if (verb === 'dry-run') {
    try {
      const plan = cloudflaredPlan(cf, { port, configFile: cloudflaredConfigFile(), secretEnv });
      out({ ok: true, command: plan.command, args: plan.args, tokenInEnv: Boolean(plan.env.TUNNEL_TOKEN), config: plan.configText });
    } catch (error) { out({ ok: false, error: error.message }); process.exit(2); }
    return;
  }
  if (verb === 'start') {
    const live = managerAlive();
    if (live) { out({ ok: true, already: true, pid: live.pid, publicBase: publicBase() }); return; }
    try { cloudflaredPlan(cf, { port, configFile: cloudflaredConfigFile(), secretEnv }); } catch (error) { out({ ok: false, error: error.message }); process.exit(2); }
    const pid = spawnDetached(TUNNEL_FILE, ['run', '--port', String(port)]);
    markStarting('tunnel', pid);
    out({ ok: true, launched: pid, mode: cf.mode, hostname: cf.hostname }); return;
  }
  if (verb === 'run') {
    let managed;
    const lost = (holder) => { console.error(JSON.stringify({ ok: false, lost: true, error: `tunnel manager ${holder?.pid ?? '?'} holds the tunnel host lock; this one exits` })); process.exit(0); };
    try { managed = runManager(cf, { port, secretEnv, onLost: lost }); } catch (error) { out({ ok: false, error: error.message }); process.exit(2); }
    if (!managed.ok) { out({ ok: false, already: true, error: 'another tunnel manager owns the tunnel state', pid: managed.holder?.pid ?? null }); process.exit(1); }
    const stop = () => { managed.handle.stop(); managed.release(); process.exit(0); };
    process.on('SIGINT', stop); process.on('SIGTERM', stop); process.on('exit', managed.release);
    return;
  }
  console.error('usage: tunnel.mjs start|run|status|stop|dry-run [--port <n>]'); process.exit(2);
}

if (isMain(import.meta.url)) main();
