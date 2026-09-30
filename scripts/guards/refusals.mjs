// refusals.mjs — how an op guard refuses: the lines the agent reads and the runtime/guards/refusals.jsonl record.
// Shared by the agent command guard (command-guard.mjs, a PreToolUse hook) and the history hook's commit check
// (verify-commit.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The refusal as the agent reads it: what was refused and why, the remedy, and the shared-checkout rule. */
export function refusalLines(tool, verdict) {
  return [
    `starci guard: refused \`${tool} ${verdict.command ?? ''}\` [${verdict.code}] — ${verdict.reason}.`,
    ...(verdict.remedy ? [`starci guard: instead: ${verdict.remedy}.`] : []),
    'starci guard: this checkout is shared with other workflows (modules/ops/_common.yaml "Evidence, completion and commits"). Report a real need in your report; never work around this guard.',
  ];
}

/** Append one refusal to runtime/guards/refusals.jsonl; the refusal stands without its log line. */
export function logRefusal(entry, { root = skillRoot } = {}) {
  try {
    const dir = path.join(root, 'runtime', 'guards');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'refusals.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
  } catch { /* the refusal stands without its log line */ }
}
