// scripts/agent/trust-launch.mjs — the launch-time trust flow: pre-trust the directory an agent starts in (see trust.mjs for the
// writers and the scope rules), per provider, and report the receipt the launch event records.
import path from 'node:path';
import { probeGuardCommand } from '../api/process/probe-guard-command.mjs';
import { toolGuardCommand } from '../lib/guard-command.mjs';
import { codexLaunchHomes } from './codex-mirror-source.mjs';
import { codexTrustPaths, launchTrustVerdict } from './launch-trust-policy.mjs';
import {
  TOOL_GUARD_MATCHER, assertClaudeBypassConsent, assertClaudeSettingsEnv, assertJsonToolGuard, claudeKeyForms, claudeLaunchEnv,
  codexAppServer, codexKeyForms, codexProjectTables, excludeFromGit, jsonOf, projectTargets, readText, trustCodexToolGuard,
  trustTargets, writeClaudeTrust, writeCodexNoModelNudge, writeCodexNoUpdateCheck, writeCodexToolGuard, writeCodexTrust, writeDevinProfile,
} from './trust.mjs';

const TRUST_AGENTS = new Set(['claude', 'codex', 'devin']);

/**
 * Pre-trust `cwd` for `agent` before launch. Never throws; a failure is
 * recorded without a screen-only consent fallback. Returns null for
 * an agent with no trust prompt. A guard command no shell can run refuses the launch (status failed,
 * code guard-command-unresolvable) before any trust, settings or hook file is written (after the provider's own decline is read). Seam: `guardProbe`.
 */
export function ensureLaunchTrust({ agent, cwd, config, env = process.env, platform = process.platform, hooks, codexAppServer: appServer = null, guardProbe = probeGuardCommand } = {}) {
  if (!TRUST_AGENTS.has(agent)) return null;
  const authorization = launchTrustVerdict({ cwd, config, platform });
  if (!authorization.ok) return { agent, paths: [], status: 'declined', reason: authorization.reason };
  const { dir } = authorization;
  const targets = trustTargets({ env, platform });
  if (targets.skipped) return { agent, paths: [dir], status: 'skipped', reason: targets.skipped };
  const project = projectTargets(dir);
  const receipt = { agent, paths: [dir], approval: authorization.approval, written: [], already: [], errors: [] };
  // Check explicit provider declines before writing any trust/settings/hook file.
  let declined;
  try { declined = ownerDeclineOf({ agent, platform, authorization, targets, project, receipt, env }); }
  catch (error) { return { ...receipt, status: 'failed', errors: [{ error: String(error.message) }] }; }
  if (declined) return declined;
  const command = toolGuardCommand({ home: targets.home });
  const resolved = guardProbe({ command, home: targets.home, platform, env });
  if (!resolved.ok) return unresolvedGuard({ ...receipt, command, resolved });
  const ctx = { dir, platform, hooks, env, appServer, targets, project, receipt, command };
  const early = trustFlowOf(agent)(ctx);
  if (early) return early;
  receipt.status = receipt.errors.length ? 'failed' : ['already', 'written'][Number(receipt.written.length > 0)];
  if (!receipt.errors.length) delete receipt.errors;
  return receipt;
}

// The refusal of a launch whose guard command no shell can run: nothing is written, the code is catalogued.
const unresolvedGuard = ({ command, resolved, ...receipt }) => ({ ...receipt, status: 'failed', code: 'guard-command-unresolvable', reason: `the guard command ${command} cannot run: ${resolved.reason}`, errors: [{ error: resolved.reason }] });

function trustFlowOf(agent) {
  if (agent === 'devin') return trustDevin;
  return agent === 'claude' ? trustClaude : trustCodex;
}

// The provider's own explicit decline of the project: the receipt that refuses the launch, or null.
function ownerDeclineOf({ agent, platform, authorization, targets, project, receipt, env }) {
  if (agent === 'claude') return claudeDecline({ platform, authorization, targets, project, receipt });
  if (agent === 'codex') return codexDecline({ platform, authorization, targets, receipt, env });
  return null;
}

function claudeDecline({ platform, authorization, targets, project, receipt }) {
  const user = readText(targets.claudeJson), doc = user === null ? {} : jsonOf(user);
  const local = readText(project.claudeSettings), settings = local === null ? {} : jsonOf(local);
  if (!doc || !settings) throw new Error('Claude trust/settings file is unreadable');
  if (claudeKeyForms(authorization.dir, platform).some((key) => doc.projects?.[key]?.hasTrustDialogAccepted === false) || settings.skipDangerousModePermissionPrompt === false)
    return { ...receipt, status: 'declined', reason: 'owner declined Claude project trust or bypass consent' };
  return null;
}

function codexDecline({ platform, authorization, targets, receipt, env }) {
  const keys = authorization.paths.flatMap((p) => codexKeyForms(p, platform));
  for (const home of codexLaunchHomes({ homes: targets.codexHomes, env })) {
    const tables = codexProjectTables(readText(path.join(home.dir, 'config.toml')) ?? '');
    if (keys.some((key) => tables.get(key)?.trust != null && tables.get(key).trust !== 'trusted'))
      return { ...receipt, status: 'declined', reason: 'owner declined Codex project trust' };
  }
  return null;
}

function collectResult(receipt, r) {
  for (const key of r.written ?? []) receipt.written.push({ file: r.file, key });
  for (const key of r.already ?? []) receipt.already.push({ file: r.file, key });
  if (!r.ok) receipt.errors.push({ file: r.file, error: r.error });
}

const guarded = (file, fn) => { try { return fn(); } catch (e) { return { file, ok: false, error: String(e?.message ?? e) }; } };

// A step that failed names its file and error (or its state) in the receipt.
const noteFailure = (receipt, file, result) => {
  if (!result.ok) receipt.errors.push({ file, error: result.error ?? result.state });
};

// A project file the runtime wrote stays out of `git status` (the repository's own info/exclude).
function excludeWritten({ receipt, dir }, file) {
  const x = guarded(file, () => excludeFromGit(dir, file));
  if (x) { receipt.gitExclude ??= []; receipt.gitExclude.push(x); }
  if (x?.ok === false) receipt.errors.push({ file, error: x.error });
}

// Devin's LOCAL project config (<dir>/.devin/config.local.json): the guard hook.
function trustDevin(ctx) {
  const { receipt, project, command, hooks } = ctx;
  const file = project.devinConfig;
  const profile = guarded(file, () => writeDevinProfile({ file, command, hooks }));
  receipt.toolGuard = [{ file, state: profile.state ?? 'failed' }];
  noteFailure(receipt, file, profile);
  if (profile.ok) {
    receipt[profile.state === 'written' ? 'written' : 'already'].push({ file, key: 'hooks.PreToolUse' });
    excludeWritten(ctx, file);
  }
  return null;
}

// The directory trust record is Claude's own per-user state (~/.claude.json); everything else is the worktree's
// local project settings (<dir>/.claude/settings.local.json), which Claude reads for the bypass consent, env and hooks.
function trustClaude(ctx) {
  const { receipt, targets, project, dir, platform, command, hooks } = ctx;
  collectResult(receipt, guarded(targets.claudeJson, () => writeClaudeTrust({ file: targets.claudeJson, keys: claudeKeyForms(dir, platform), hooks })));
  if (receipt.errors.length) return { ...receipt, status: 'failed' };
  const file = project.claudeSettings;
  const consent = guarded(file, () => assertClaudeBypassConsent({ file, hooks }));
  receipt.bypassConsent = consent.state ?? 'failed';
  noteFailure(receipt, file, consent);
  if (receipt.errors.length) return { ...receipt, status: 'failed' };
  const launchEnv = guarded(file, () => assertClaudeSettingsEnv({ file, vars: claudeLaunchEnv(), hooks }));
  receipt.launchEnv = launchEnv.state ?? 'failed';
  noteFailure(receipt, file, launchEnv);
  const toolGuard = guarded(file, () => assertJsonToolGuard({ file, command, matcher: TOOL_GUARD_MATCHER, hooks }));
  receipt.toolGuard = [{ file, state: toolGuard.state ?? 'failed' }];
  noteFailure(receipt, file, toolGuard);
  if (consent.ok || launchEnv.ok || toolGuard.ok) excludeWritten(ctx, file);
  return null;
}

// A Codex notice pinned off in one home: recorded under `field` with the verdict of its writer.
function recordCodexNotice(receipt, field, file, result) {
  receipt[field] ??= [];
  receipt[field].push({ file, off: result.ok === true, ...(result.written ? { written: true } : {}), ...(result.ok ? {} : { error: result.error }) });
  if (!result.ok) receipt.errors.push({ file, error: result.error });
}

// The trust, update-check and nudge records of one Codex home; the failed receipt when the trust itself failed.
function trustCodexHome(ctx, home, keys) {
  const { receipt, hooks } = ctx;
  const file = path.join(home.dir, 'config.toml');
  collectResult(receipt, guarded(file, () => writeCodexTrust({ file, keys, hooks })));
  if (receipt.errors.length) return { ...receipt, status: 'failed' };
  recordCodexNotice(receipt, 'updateCheck', file, guarded(file, () => writeCodexNoUpdateCheck({ file, hooks })));
  recordCodexNotice(receipt, 'modelNudge', file, guarded(file, () => writeCodexNoModelNudge({ file, hooks })));
  return null;
}

// The guard hook of one Codex home: the block in the home's config.toml, then the hash Codex trusts it by. The
// receipt entry names the home's file, whether the block was written and the home's verdict.
function codexGuardIn(ctx, home, server) {
  const { receipt, dir, command, hooks } = ctx;
  const file = path.join(home.dir, 'config.toml');
  const hook = guarded(file, () => writeCodexToolGuard({ file, command, hooks }));
  if (!hook.ok) receipt.errors.push({ file, error: hook.error });
  else receipt[hook.written ? 'written' : 'already'].push({ file, key: 'hooks.PreToolUse' });
  const trusted = hook.ok && server ? guarded(file, () => trustCodexToolGuard({ home: home.dir, cwd: dir, command, appServer: server })) : null;
  if (trusted && !trusted.ok) receipt.errors.push({ file, error: trusted.error });
  const verdict = trusted ? ['failed', trusted.trusted][Number(Boolean(trusted.ok))] : 'not-checked';
  return { file, ...(hook.written ? { written: true } : {}), trustedIn: [{ home: home.dir, trusted: verdict }] };
}

// Codex: the directory trust, the notices and the guard hook live in each Codex home the worker can start in. Codex
// 0.160.0 loads a project layer's hooks only from the main checkout of a repository, never from a linked worktree
// (every workflow launch directory), so a hook written to <dir>/.codex is never listed; the home's own config.toml is
// the layer it lists for every directory, and `starci guard command` acts only for a terminal the launch bound a guard
// to. The homes are Orca's managed home and the system home (codexLaunchHomes): Orca starts the worker in one of them
// and rebuilds the managed config.toml from the system one at each launch, keeping only its project and hook-state tables.
function trustCodex(ctx) {
  const { receipt, targets, dir, platform, env, appServer } = ctx;
  receipt.paths = codexTrustPaths(dir);
  const keys = [...new Set(receipt.paths.flatMap((p) => codexKeyForms(p, platform)))];
  const homes = codexLaunchHomes({ homes: targets.codexHomes, env });
  for (const home of homes) {
    const failed = trustCodexHome(ctx, home, keys);
    if (failed) return failed;
  }
  // A re-rooted trust home (specs) never starts the real Codex: its app-server is injected, else the hash step waits.
  const server = appServer ?? (env.STARCI_AGENT_TRUST_HOME ? null : codexAppServer);
  receipt.toolGuard = homes.map((home) => codexGuardIn(ctx, home, server));
  return null;
}
