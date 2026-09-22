#!/usr/bin/env node
// dispatch-op.mjs — build the dispatch packet for one op and (optionally) spawn
// the `[Op] <id>` Orca terminal that executes it. One op = one
// ephemeral shell agent; the kernel driver is the caller.
//
// Packet contract per modules/kernel/dispatch.yaml +
// modules/kernel/verdict-contract.yaml (presence checked at runtime):
//   packet:
//     op: <id>
//     brief: modules/ops/ops/<id>.yaml
//     params: {<name>: <value>}   resolved tunables — the brief's defaults with
//                                 the goal leg's and the kernel's overrides on top
//     context: {records: [...], owned_paths: [...]}
//     constraints: {model, budget, lease}
//     returns: {verdict: pass|fail|blocked, evidence: [...paths], suspicion?: string}
//
// resolveOpParams is exported: scripts/kernel/api.mjs enqueue validates the
// owner's and the kernel's overrides against the brief with the same function
// that resolves them here, so a value refused at enqueue cannot appear in a packet.
//
// Spawn path reconciled with the real orca CLI:
//   orca terminal create --worktree <selector> --title "[Op] <id>" --command "<text>" --json
//     -> result.terminal.handle   (modules/host/orca/calls.yaml terminal-create)
//   orca terminal send --terminal <handle> --text "<prompt>" --enter --json
//   Command-terminal launch only (qwen/devin profiles); managed-agent profiles
//   (claude/codex) launch through `orca orchestration worker-start` and refuse
//   --spawn here — see modules/host/orca/index.yaml managedFallback.
//
// CLI:
//   node scripts/route/dispatch-op.mjs --op <id> [--records a,b] [--state <.starciwork>]
//       [--params '<json>'] [--model <target>] [--budget <n>] [--lease <token>]
//       [--worktree <sel>] [--dry-run | --spawn] [--json]
//   --spawn requires --lease (the lease binds the agent's writes to the job).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { loadRecords, readWorkspace, resolveOwnedDirs } from '../example/example-ownership.mjs';
import { spawnAgent, buildSpawnCommand } from '../agent/lib.mjs';
import { buildContext, renderPromptReads } from '../context/pack.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const VERDICT_CONTRACT = 'modules/kernel/verdict-contract.yaml';

// --------------------------------------------------------------------- params
// An op's tunables are data (modules/schemas/op.schema.yaml `params`): the brief
// holds the type, the default and who may set it, and the packet carries the
// resolved value. Prose never restates a number, so nothing has to be inferred
// from the goal text at run time.

/** One value against one declared param. Returns null when it holds. */
function paramValueError(name, def, value) {
  const type = def?.type;
  if (type === 'enum') {
    const allowed = Array.isArray(def.enum) ? def.enum : [];
    return allowed.includes(value) ? null : `${name} must be one of ${allowed.join(', ')} (got ${JSON.stringify(value)})`;
  }
  if (type === 'integer' && !Number.isInteger(value)) return `${name} must be an integer (got ${JSON.stringify(value)})`;
  if (type === 'number' && !(typeof value === 'number' && Number.isFinite(value))) return `${name} must be a number (got ${JSON.stringify(value)})`;
  if (type === 'string' && typeof value !== 'string') return `${name} must be a string (got ${JSON.stringify(value)})`;
  if (type === 'boolean' && typeof value !== 'boolean') return `${name} must be true or false (got ${JSON.stringify(value)})`;
  if (typeof value === 'number') {
    if (def.min !== undefined && value < def.min) return `${name} is ${value}, below its minimum ${def.min}`;
    if (def.max !== undefined && value > def.max) return `${name} is ${value}, above its maximum ${def.max}`;
  }
  return null;
}

/** The op's declared defaults with validated overrides on top.
 *  `leg` is what the approved goal leg carries — the only source for a param
 *  the brief marks `setBy: owner`. `flag` is what the kernel passes at enqueue;
 *  it may set a `setBy: kernel` param outright and may relay an owner param only
 *  when the leg already names it. An undeclared name, a wrong type, a value
 *  outside its bounds or a setter that has no authority is a refusal — the
 *  kernel never guesses a tunable it was not given. A `required: true` param
 *  has no default: with `enforceRequired` (enqueue) its absence is refused;
 *  without it (a packet rendered for a job enqueued earlier) it is omitted. */
export function resolveOpParams(opDoc, { leg = null, flag = null, enforceRequired = false } = {}) {
  const declared = opDoc?.params && typeof opDoc.params === 'object' ? opDoc.params : {};
  const legValues = leg && typeof leg === 'object' ? leg : {};
  const flagValues = flag && typeof flag === 'object' ? flag : {};
  const overrides = {};

  for (const [source, values] of [['goal leg', legValues], ['--params', flagValues]]) {
    for (const [name, value] of Object.entries(values)) {
      const def = declared[name];
      if (!def) return { ok: false, reason: 'params-invalid', detail: `${source} sets ${name}, which ${opDoc?.id ?? 'this op'} does not declare` };
      if (def.setBy === 'owner' && source === '--params' && !Object.hasOwn(legValues, name)) {
        return { ok: false, reason: 'params-invalid', detail: `${name} is set by the owner; the approved goal leg does not carry it` };
      }
      if (def.setBy === 'kernel' && source === 'goal leg') {
        return { ok: false, reason: 'params-invalid', detail: `${name} is set by the kernel; a goal leg cannot carry it` };
      }
      const error = paramValueError(name, def, value);
      if (error) return { ok: false, reason: 'params-invalid', detail: error };
      overrides[name] = value;
    }
  }

  const missing = Object.entries(declared).filter(([name, def]) => def?.required === true && !Object.hasOwn(overrides, name));
  if (enforceRequired && missing.length) {
    const [name, def] = missing[0];
    const via = def.setBy === 'owner' ? 'the approved goal leg (define-goal --params)' : `--params '{"${name}": <${def.type}>}'`;
    return { ok: false, reason: 'params-invalid', param: name,
      detail: `${opDoc?.id ?? 'this op'} requires params.${name} (${def.type}, set by ${def.setBy}): ${def.doc?.en ?? ''} — none was given; re-run enqueue with ${via}` };
  }
  const params = {};
  for (const [name, def] of Object.entries(declared)) {
    if (Object.hasOwn(overrides, name)) params[name] = overrides[name];
    else if (Object.hasOwn(def ?? {}, 'default')) params[name] = def.default;
  }
  return { ok: true, params, overrides };
}

function usage(code) {
  console.error(`use: node scripts/route/dispatch-op.mjs --op <id>
    [--records a,b] [--state <.starciwork dir>] [--params '<json>'] [--model <target>]
    [--budget <n>] [--lease <token>] [--worktree <selector>] [--dry-run | --spawn] [--json]`);
  process.exit(code);
}

function parseArgs(argv) {
  const a = { records: [] };
  const take = () => {
    const v = argv[++parseArgs.i];
    if (v === undefined) usage(2);
    return v;
  };
  for (parseArgs.i = 0; parseArgs.i < argv.length; parseArgs.i++) {
    const k = argv[parseArgs.i];
    if (k === '--op') a.op = take();
    else if (k === '--records') a.records.push(...take().split(','));
    else if (k === '--state') a.state = take();
    else if (k === '--params') a.params = take();
    else if (k === '--model') a.model = take();
    else if (k === '--budget') a.budget = take();
    else if (k === '--lease') a.lease = take();
    else if (k === '--worktree') a.worktree = take();
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '--spawn') a.spawn = true;
    else if (k === '--json') a.json = true;
    else if (k === '--help' || k === '-h') usage(0);
    else usage(2);
  }
  a.records = [...new Set(a.records.map(s => s.trim()).filter(Boolean))];
  return a;
}

const walk = dir => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]) : []);

/** Resolve the record list to owned paths via the example-ownership helpers —
 *  the same ownership resolution check scripts use, so the allowlist the packet
 *  carries is the ownership the tree actually declares. */
function resolveOwnedPaths(records, stateDir) {
  if (!stateDir) return { ownedPaths: [], note: 'no --state given — owned_paths empty; the kernel must fill them before a real dispatch' };
  const workRoot = path.resolve(stateDir);
  if (!fs.existsSync(workRoot)) return { ownedPaths: [], error: `state dir missing: ${workRoot}` };
  const recordsById = loadRecords(workRoot, walk);
  const workspaceDoc = readWorkspace(workRoot);
  const ownedPaths = [];
  const missing = [];
  for (const rid of records) {
    const rec = recordsById.get(rid);
    if (!rec) { missing.push(rid); continue; }
    for (const d of resolveOwnedDirs(rid, rec, recordsById, workspaceDoc, workRoot)) {
      ownedPaths.push({ record: rid, path: d.rel.replaceAll('\\', '/'), via: d.via, exists: fs.existsSync(d.abs) });
    }
  }
  return { ownedPaths, missing: missing.length ? missing : undefined };
}

/** modules/models/profiles/<target>.yaml -> launch.orca {kind, command}. */
function resolveModel(target, modelsDir) {
  const file = path.join(modelsDir, 'profiles', `${target}.yaml`);
  if (!fs.existsSync(file)) return { error: `no model profile ${target} at ${path.relative(skillRoot, file)}` };
  const doc = parseYaml(fs.readFileSync(file, 'utf8'));
  const orca = doc?.launch?.orca ?? {};
  return {
    target, provider: doc?.provider ?? null,
    kind: orca.kind ?? 'unknown',
    command: orca.command ?? null,
    profile: path.relative(skillRoot, file),
  };
}

function buildPrompt(packet, context) {
  // Compact prompt the shell agent receives. The READ ORDER is mandatory —
  // an agent that acts without reading its contract is the failure mode this
  // packet exists to prevent (agents that skip reads forget bypass flags,
  // miss context, and never persist).
  // The list is not hardcoded: scripts/context/pack.mjs resolves it as a
  // function — CONTEXT.md + brief + verdict contract + every concrete file the
  // brief's own reads declare + the packet contract — so a brief edit never
  // leaves the prompt stale.
  const lines = [
    `[Op] ${packet.op} — one operation, one verdict. You are an ephemeral op agent spawned by the workflow kernel.`,
    ...renderPromptReads(context),
    `brief: ${packet.brief}  (your contract — never renegotiate it)`,
    ...(packet.params ? [`params: ${Object.entries(packet.params).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}  (resolved tunables — use these values, never a number from prose)`] : []),
    `records: ${packet.context.records.join(', ') || '(none bound)'}`,
    `owned_paths: ${[...new Set(packet.context.owned_paths.map(p => p.path))].join(', ') || '(per brief write-ceiling)'}`,
    `   only owned_paths may be modified; anything else is out of scope.`,
    `constraints: lease=${packet.constraints.lease ?? '(none)'} model=${packet.constraints.model} budget=${packet.constraints.budget ?? '(unset)'}`,
    `machines: check names in your brief (layoutPolicy.checks, proofs) are executable canonical validators — run them verbatim, never invent placeholder commands (e.g. validateWorkspace):`,
    `  starci-validate → node ${path.join(skillRoot, 'bin', 'starci.mjs')} validate <work-root-or-record-dir> [--json]`,
    `  starci-stacks-check → checkApplicationStacks({repoRoot,environment,deploymentModelFile}) in ${path.join(skillRoot, 'scripts', 'checks', 'stacks.mjs')}`,
    `  starci-code-patterns-check → node ${path.join(skillRoot, 'scripts', 'checks', 'check-scoped-lint.mjs')} --profile <nest|next> --root <repo> (--all|-- <files>)`,
    `  a check you cannot execute is reported as environment/unavailable evidence — a placeholder result is NOT proof of an upstream defect.`,
    `persistence: state lives in .starciwork/runtime.sqlite and files on disk — never in your memory. Markers and reports are the truth.`,
    `returns: {verdict: pass|fail|blocked, evidence: [...paths], suspicion?: string} — contract: ${VERDICT_CONTRACT}`,
    `Return verdict + evidence paths. Cite suspicion instead of fixing out of scope — a wrong spec is a blocker, not a guess.`,
  ];
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.op) usage(2);
  const modelsDir = path.join(skillRoot, 'modules', 'models');
  const briefRel = `modules/ops/ops/${args.op}.yaml`;
  const briefAbs = path.join(skillRoot, briefRel);
  if (!fs.existsSync(briefAbs)) {
    console.error(`unknown op '${args.op}' — no brief at ${briefRel}`);
    process.exit(1);
  }
  const opDoc = parseYaml(fs.readFileSync(briefAbs, 'utf8'));
  const model = resolveModel(args.model ?? 'qwen-agent', modelsDir); // orchestrationDefault: qwen-agent
  if (model.error) { console.error(model.error); process.exit(1); }

  const owned = resolveOwnedPaths(args.records, args.state);
  const contractPresent = fs.existsSync(path.join(skillRoot, VERDICT_CONTRACT));
  // Context cutting is a function (scripts/context/pack.mjs): the mandatory
  // read set is resolved, not asserted — the prompt below enumerates the real
  // file list, and the packet carries it for the receipt.
  const ctx = buildContext({
    op: args.op, records: args.records, stateDir: args.state,
    skillRoot, briefDoc: opDoc, ownedPaths: owned.ownedPaths,
  });

  let flagParams = null;
  if (args.params !== undefined) {
    try { flagParams = JSON.parse(args.params); }
    catch (e) { console.error(`--params is not JSON: ${e.message}`); process.exit(2); }
  }
  const resolved = resolveOpParams(opDoc, { flag: flagParams });
  if (!resolved.ok) { console.error(`${resolved.reason}: ${resolved.detail}`); process.exit(1); }

  const packet = {
    op: args.op,
    brief: briefRel,
    ...(Object.keys(resolved.params).length ? { params: resolved.params } : {}),
    context: {
      records: args.records,
      owned_paths: owned.ownedPaths,
      mandatoryReads: ctx.mandatory?.map(m => m.path) ?? [],
      ...(owned.missing ? { recordsNotFound: owned.missing } : {}),
      ...(owned.note ? { note: owned.note } : {}),
      ...(owned.error ? { error: owned.error } : {}),
    },
    constraints: {
      model: model.target,
      provider: model.provider,
      budget: args.budget ?? null,
      lease: args.lease ?? null,
    },
    returns: { verdict: 'pass|fail|blocked', evidence: ['...paths'], suspicion: 'string?' },
  };

  const prompt = buildPrompt(packet, ctx);
  const title = `[Op] ${args.op}`;
  const worktree = args.worktree ?? 'active';

  // Spawn sequence per modules/kernel/dispatch.yaml spawnMechanics. The
  // terminal command is composed by the agent layer: profile launch command
  // (model+tuning) with the provider card's env prefix injected — devin's
  // ACP strip and qwen's credential refresh can no longer be forgotten.
  const spawnCmd = model.kind === 'command-terminal'
    ? buildSpawnCommand({ provider: model.provider, command: model.command })
    : null;
  const composedCommand = spawnCmd?.command ?? model.command;
  const orcaCommands = model.kind === 'command-terminal'
    ? [
      { step: 'create', argv: ['terminal', 'create', '--worktree', worktree, '--title', title, '--command', composedCommand, '--json'] },
      { step: 'read', argv: ['terminal', 'read', '--terminal', '<handle-from-create>', '--screen', '--json'],
        note: 'readiness — verify the prompt landed before sending; a long typed command can leave Enter un-landed (dispatch.yaml launchWindow)' },
      { step: 'send', argv: ['terminal', 'send', '--terminal', '<handle-from-create>', '--text', prompt, '--enter', '--json'] },
    ]
    : [
      { step: 'worker-start', argv: ['orchestration', 'worker-start', '--task', '<operation-task-id>', '--worktree', worktree, '--agent', model.provider ?? '<agent>', '--model', '<resolved-model-id>', '--json'],
        note: `${model.target} launches as a managed agent (profile launch.orca.kind=${model.kind}) — modules/host/orca/index.yaml managedFallback; needs an orchestration Task id, not terminal create` },
    ];

  const result = {
    packet,
    prompt,
    orca: {
      worktree, title,
      launchKind: model.kind,
      profile: model.profile,
      commands: orcaCommands.map(c => ({ step: c.step, cli: `orca ${c.argv.join(' ')}`.replace(prompt, '<prompt>'), note: c.note })),
      contractPresent,
      ...(contractPresent ? {} : { assumption: `${VERDICT_CONTRACT} not on disk — packet coded against modules/kernel/dispatch.yaml` }),
    },
    opContext: { riskHints: opDoc?.route?.riskHints ?? [], goal: opDoc?.goal?.en ?? opDoc?.goal ?? null },
    contextPack: ctx.error ? { error: ctx.error } : {
      mandatoryReads: ctx.mandatory.length,
      declaredReads: ctx.declaredReads.length,
      ownedFiles: ctx.ownedFiles.length, truncated: ctx.truncated,
      missing: ctx.missing,
    },
  };

  if (args.spawn) {
    if (!args.lease) { console.error('--spawn requires --lease <token> (the lease binds writes to the job identity)'); process.exit(2); }
    if (model.kind !== 'command-terminal') {
      console.error(`--spawn refused: ${model.target} is launch kind '${model.kind}' — use 'orca orchestration worker-start' with a Task id (managed-agent path)`);
      process.exit(1);
    }
    const spawned = spawnAgent({
      provider: model.provider, worktree: args.worktree ?? undefined,
      title, prompt, command: model.command, dispatchId: args.op,
    });
    result.spawn = {
      ok: spawned.ok === true, handle: spawned.terminal ?? null,
      step: spawned.step, error: spawned.error ?? null, command: spawned.command,
    };
    console.log(JSON.stringify(result, null, 2));
    if (!result.spawn.ok) process.exit(1);
    return;
  }

  // --dry-run (also the default when neither flag is passed — never spawn silently)
  if (!args.dryRun && !args.spawn) result.note = 'no --spawn: dry-run output';
  if (args.json) { console.log(JSON.stringify(result, null, 2)); return; }
  console.log(`PACKET op=${packet.op}`);
  console.log(`  brief: ${packet.brief}`);
  if (packet.params) console.log(`  params: ${Object.entries(packet.params).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}`);
  console.log(`  records: ${packet.context.records.join(', ') || '(none)'}`);
  for (const p of packet.context.owned_paths) console.log(`  owned_path: ${p.path}  (record ${p.record}, via ${p.via}${p.exists ? '' : ', MISSING-ON-DISK'})`);
  if (packet.context.recordsNotFound) console.log(`  records not in tree: ${packet.context.recordsNotFound.join(', ')}`);
  if (packet.context.note) console.log(`  note: ${packet.context.note}`);
  console.log(`  constraints: model=${model.target} (${model.kind}) budget=${packet.constraints.budget ?? '-'} lease=${packet.constraints.lease ?? '-'}`);
  console.log(`  returns: verdict pass|fail|blocked + evidence[] + suspicion?  (contract ${VERDICT_CONTRACT}${contractPresent ? '' : ' — NOT LANDED, assumed'})`);
  console.log('orca commands:');
  for (const c of result.orca.commands) {
    console.log(`  $ ${c.cli}`);
    if (c.note) console.log(`    note: ${c.note}`);
  }
  console.log('prompt the agent receives:');
  for (const line of prompt.split('\n')) console.log(`  | ${line}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
