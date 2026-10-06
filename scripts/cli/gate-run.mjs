#!/usr/bin/env node
// gate-run.mjs - the entry of `starci gate run` (modules/cli/commands/gate/run.yaml): it reads the op context of this process
// (scripts/guards/op-context.mjs) and hands it to the gate library (scripts/gates/gate.mjs runGate, runDocGate), which never
// reads the caller's environment itself. Prints the starci/gate@1 report and exits with its code.
import fs from 'node:fs';
import path from 'node:path';
import { setPriority } from '../api/process/set-priority.mjs';
import { DOC_PROFILE, GATE_EXIT, GATE_SCHEMA, parseGateArgs, runDocGate, runGate } from '../gates/gate.mjs';
import { opContextOf } from '../guards/op-context.mjs';
import { isMain } from '../lib/is-main.mjs';

/** Run the gate for `argv`, write the report to stdout (and --out); resolves the gate exit code. */
async function gateMain(argv, { stdout = (s) => process.stdout.write(s), context = () => opContextOf({ contract: true }) } = {}) {
  let opts;
  try { opts = parseGateArgs(argv); } catch (error) { stdout(`${JSON.stringify({ schema: GATE_SCHEMA, ok: false, exit: GATE_EXIT.toolFailed, errors: [error.message] })}\n`); return GATE_EXIT.toolFailed; }
  const report = opts.profile === DOC_PROFILE ? runDocGate({ tree: opts.tree })
    : await runGate({ root: opts.root ?? process.cwd(), base: opts.base, main: opts.main, changed: opts.changed, tests: opts.tests, context: context() });
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (opts.out) { fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true }); fs.writeFileSync(path.resolve(opts.out), text); }
  stdout(text);
  return report.exit;
}

if (isMain(import.meta.url)) {
  setPriority();
  process.exitCode = await gateMain(process.argv.slice(2));
}
