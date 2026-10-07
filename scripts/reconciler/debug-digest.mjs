#!/usr/bin/env node
// starci debug digest — the read-only digest a chat /loop runs: per running workflow its phase, jobs, holds, stopped ops, Kernel
// seat; the Supervisor seat, stale gates and Decision Items; the reconciler's leader and controller modes; admission anomalies;
// token burn per op; and the problems list ordered by the work each blocks. It reads the machine store, the ledgers and the
// existing read verbs, and never fixes, dispatches or resolves anything; the repetition is the calling chat's /loop.
//
//   starci debug digest [--repo <ledger-owner>]... [--workflow <id>]... [--json] [--child-timeout <sec>]
//
// Exit 0 when a digest was printed (problems are its content, not a failure), 1 when the machine store cannot be read, 2 on bad usage.
import { parseArgs } from 'node:util';
import { isMain } from '../lib/is-main.mjs';
import { ownerLanguage } from '../lib/i18n.mjs';
import { incidentPolicy, boundValue } from '../kernel/op-incident-policy.mjs';
import { analyze } from './debug-digest-analyze.mjs';
import { collectSnapshot } from './debug-digest-collect.mjs';
import { digestNumbers } from './debug-digest-numbers.mjs';
import { renderText, renderUnavailable } from './debug-digest-render.mjs';

const OPTIONS = { repo: { type: 'string', multiple: true }, workflow: { type: 'string', multiple: true },
  json: { type: 'boolean' }, 'child-timeout': { type: 'string' } };

/** The hold policy table with its bound resolver, as the analysis reads it. */
const loadPolicy = () => ({ ...incidentPolicy(), resolve: boundValue });

/** The digest of one collected snapshot under the shipped policy and numbers (the seam a spec feeds fixtures through). */
export const digestOf = (snapshot, { policy = loadPolicy(), numbers = digestNumbers() } = {}) => analyze(snapshot, policy, numbers);

export async function main(argv = process.argv.slice(2), io = {}) {
  let values;
  try { ({ values } = parseArgs({ args: argv, options: OPTIONS })); } catch (error) { (io.error ?? console.error)(`starci debug digest: ${error.message}`); return 2; }
  const out = io.print ?? console.log;
  const timeoutMs = values['child-timeout'] ? Number(values['child-timeout']) * 1000 : undefined;
  const snapshot = await (io.collect ?? collectSnapshot)({ repos: values.repo ?? [], workflowIds: values.workflow ?? [], ...(timeoutMs ? { timeoutMs } : {}) });
  const language = io.language ?? ownerLanguage();
  if (snapshot.unavailable) {
    out(values.json ? JSON.stringify({ ok: false, unavailable: snapshot.unavailable }) : renderUnavailable(snapshot.unavailable, language));
    return 1;
  }
  const digest = digestOf(snapshot, io);
  out(values.json ? JSON.stringify(digest) : renderText(digest, { language }));
  return 0;
}

if (isMain(import.meta.url)) process.exitCode = await main();
