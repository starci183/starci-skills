#!/usr/bin/env node
// starci supervisor decide — one typed answer to one item of the Supervisor's menu (modules/supervisor/supervisor-menu.yaml).
//   starci supervisor decide --item <id> --choice <choice> --reason <why> [--text <input>] [--json]
// The answer is validated against the menu as machine.sqlite shows it now, recorded as a supervisor-action, then executed: each step
// of the option runs as the `starci` verb it names, and the item's Decision Item is resolved when the steps succeeded. A choice that
// is not on the menu is refused with a typed code and the menu. `none-fits` records the reason and hands the item to the owner.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNode } from '../api/node/run-node.mjs';
import { jsonFromStdout } from '../lib/json.mjs';
import { clipLine } from '../lib/clip.mjs';
import { isMain } from '../lib/is-main.mjs';
import { eachInOrder } from '../lib/in-order.mjs';
import { openDecision } from '../machine/decisions.mjs';
import { recordAction } from './actions.mjs';
import { readSupervisorMenu } from './supervisor-menu-sources.mjs';
import { supervisorMenuLines } from './supervisor-menu.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STARCI = path.join(skillRoot, 'packages', 'cli', 'bin', 'starci.mjs');
const STEP_TIMEOUT_MS = 120_000;
const BY = 'supervisor';
const VERB = 'starci supervisor decide';
const CALLER_TOKEN = /\$(text|reason)\b/g;

const refusal = (code, error, menu) => ({ ok: false, code, error, menu });

/** A step argument with the caller's --text and --reason bound. */
const bindCaller = (value, caller) => String(value).replace(CALLER_TOKEN, (match, name) => caller[name]);

/** The argv of a step: `starci <run words> [positional] --flag value ... --json`. */
export function stepArgv(step, caller) {
  const { _: positional, ...flags } = step.args;
  const words = [...step.run.split(' '), ...(positional ? [positional] : [])];
  const options = Object.entries(flags).flatMap(([key, value]) => (value === true ? [`--${key}`] : [`--${key}`, bindCaller(value, caller)]));
  return [STARCI, ...words, ...options, '--json'];
}

/** One step run as a child of this process: {run, ok, out?, code?, error?}. */
function runStep(step, caller, { env }) {
  const done = runNode(stepArgv(step, caller), { cwd: skillRoot, env, timeout: STEP_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 });
  const out = jsonFromStdout(done.stdout) ?? jsonFromStdout(done.stderr);
  const ok = done.status === 0 && out?.ok !== false;
  return { run: step.run, ok, ...(ok ? { out } : { code: out?.code ?? `exit-${done.status}`, error: clipLine(out?.error ?? done.stderr ?? done.error?.message ?? '', 400) }) };
}

/** Runs the steps in order and stops at the first failure. */
async function runSteps(steps, caller, ctx) {
  const done = [];
  await eachInOrder(steps, (step) => {
    if (done.some((entry) => !entry.ok)) return;
    done.push(runStep(step, caller, ctx));
  });
  return done;
}

/** Closes the item's Decision Item with this verb; {resolved, error?}. A Decision Item that lists other verbs stays open for its controller. */
function resolveItem(item, note, { env }) {
  const done = runStep({ run: 'machine decisions', args: { _: 'supervisor', resolve: item.di, by: BY, verb: VERB, note } }, { text: '', reason: '' }, { env });
  return done.ok ? { resolved: true } : { resolved: false, error: `${done.code}: ${done.error}` };
}

/** none-fits: the item goes to the owner as an owner-class Decision Item, and the Supervisor's item closes. */
async function handToOwner(item, reason, { env }) {
  const opened = await openDecision(null, { ledger: 'supervisor', kind: 'runtime-defect', decider: 'owner', idempotencyKey: `none-fits:${item.di}`,
    summary: `Supervisor: no option of ${item.id} fits: ${reason}`.slice(0, 500), evidence: item.evidence, by: BY, item: item.id, severity: item.severity }, { env });
  return opened.ok ? { ok: true, owner: opened.json?.decision?.id ?? null } : { ok: false, error: opened.json?.error ?? 'the owner item could not be opened' };
}

const stepsFailed = (done) => done.find((entry) => !entry.ok) ?? null;

function answerOf({ item, option, done, closed, owner }) {
  const failed = stepsFailed(done);
  const out = { ok: !failed && owner?.ok !== false, item: item.id, choice: option.choice, effect: option.effect, steps: done, ...(closed ? { resolved: closed.resolved, ...(closed.error ? { resolveNote: closed.error } : {}) } : {}),
    ...(owner ? { owner } : {}), ...(failed ? { code: 'SUPERVISOR_MENU_STEP_FAILED', error: `${failed.run}: ${failed.code}: ${failed.error}` } : {}) };
  const handed = owner?.owner ? `; handed to the owner as ${owner.owner}` : '';
  const line = failed ? `decide FAILED at ${failed.run} (${failed.code}): ${failed.error}` : `decided ${item.id} -> ${option.choice}: ${option.effect}${handed}`;
  return { out, line };
}

const needsText = (option, text) => option.text && !option.escape && !text;

/** Answer one item: validates, records, executes. Returns {out, line} (out.ok false for a refusal). */
export async function decideItem({ item: itemId, choice, reason, text = '', env = process.env, now = Date.now() }) {
  const why = String(reason ?? '').trim();
  const menu = readSupervisorMenu({ env, now });
  const refuse = (code, error) => ({ out: refusal(code, error, menu), line: [`decide REFUSED (${code}): ${error}`, ...supervisorMenuLines(menu)].join('\n') });
  if (!choice || !why) return refuse('decide-answer-incomplete', 'decide needs --item <id>, --choice <choice> and --reason <why>');
  const item = menu.find((entry) => entry.id === itemId);
  if (!item) return refuse('menu-item-unknown', `${itemId ?? '(none)'} is not an open item of the Supervisor's menu`);
  const option = item.options.find((entry) => entry.choice === choice);
  if (!option) return refuse('menu-choice-unknown', `${choice} is not a choice of ${item.id} (${item.options.map((entry) => entry.choice).join(', ')})`);
  const input = String(text ?? '').trim();
  if (needsText(option, input)) return refuse('menu-text-missing', `${item.id} ${option.choice} needs --text <${option.text}>`);
  recordAction({ item: item.id, action: `decide:${option.choice}`, reason: why, workflowId: item.subject.workflow, refs: [`di:${item.di}`], by: BY, env, now });
  const caller = { text: option.escape ? why : input, reason: why };
  const done = option.escape ? [] : await runSteps(option.steps, caller, { env });
  const failed = stepsFailed(done);
  const owner = option.escape ? await handToOwner(item, why, { env }) : null;
  const closeable = !failed && !option.keepsOpen && (!option.escape || owner?.ok);
  const closed = closeable ? resolveItem(item, `${option.choice}: ${why}`, { env }) : null;
  return answerOf({ item, option, done, closed, owner });
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const value = (name) => { const at = argv.indexOf(`--${name}`); return at >= 0 ? argv[at + 1] ?? null : null; };
  const { out, line } = await decideItem({ item: value('item'), choice: value('choice'), reason: value('reason'), text: value('text') ?? '' });
  console.log(argv.includes('--json') ? JSON.stringify(out) : line);
  process.exitCode = out.ok ? 0 : 1;
}
