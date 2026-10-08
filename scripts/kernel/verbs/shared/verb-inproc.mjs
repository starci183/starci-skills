// verb-inproc.mjs — runs one Kernel verb inside the calling verb's process, through the same `run` the standalone verb has: the
// caller (`starci kernel decide`) is already admitted, so the nested call shares its ledger handle, its caller and its mutation
// fence. A nested verb's emitted answer is captured, never printed, and its failure is a value.
import { requiredOf } from '../../api-extensions.mjs';
import { CHILD_ENV } from '../../../machine/decisions.mjs';
import { readEnv } from '../../../lib/env.mjs';
import { VerbExit } from './verb-exit.mjs';

/** The failure value of a thrown error: a VerbExit carries the answer the verb already emitted. */
const failureOf = (error, emitted) => {
  if (error instanceof VerbExit) return { ok: false, code: emitted.at(-1)?.out?.reason ?? emitted.at(-1)?.out?.code ?? 'verb-failed', error: emitted.at(-1)?.human ?? `exit ${error.exitCode}`, out: emitted.at(-1)?.out ?? null };
  return { ok: false, code: error?.code ?? 'verb-failed', error: String(error?.message ?? error), out: null };
};

/**
 * Runs `verb` with `args` in this process. Returns {ok, out, human} on success, else {ok: false, code, error, out}. The menu is the
 * arbiter of the order of answers, so a nested call carries the mark of a child of a resolving verb (decisions-first passes it).
 */
export async function runVerbInProcess(ctx, verb, args) {
  const spec = ctx.ext.verbs.get(verb);
  if (!spec) return { ok: false, code: 'menu-verb-unknown', error: `no Kernel verb ${verb}`, out: null };
  const missing = requiredOf(spec, args).find((key) => !args[key]);
  if (missing) return { ok: false, code: 'menu-step-usage', error: `${verb} needs --${missing}`, out: null };
  const emitted = [];
  const emit = (out, human) => { emitted.push({ out, human }); };
  const saved = { exit: process.exitCode, child: readEnv(CHILD_ENV) };
  process.exitCode = undefined;
  process.env[CHILD_ENV] = '1';
  try {
    if (typeof spec.validate === 'function') spec.validate(args, ctx.need);
    await spec.run({ ledger: ctx.ledger, args, repo: ctx.repo, emit, need: ctx.need, caller: ctx.caller, ext: ctx.ext, internals: ctx.internals });
    const last = emitted.at(-1) ?? null;
    if (process.exitCode || last?.out?.ok === false) return { ok: false, code: last?.out?.reason ?? last?.out?.code ?? 'verb-failed', error: last?.human ?? `exit ${process.exitCode}`, out: last?.out ?? null };
    return { ok: true, out: last?.out ?? null, human: last?.human ?? '' };
  } catch (error) {
    return failureOf(error, emitted);
  } finally {
    process.exitCode = saved.exit;
    if (saved.child === undefined) delete process.env[CHILD_ENV]; else process.env[CHILD_ENV] = saved.child;
  }
}
