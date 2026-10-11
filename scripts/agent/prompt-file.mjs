// prompt-file.mjs — the one owner of "content too long for a terminal goes to a file, and the terminal gets a pointer".
//
// Agent TUIs fold a large paste into a chip ("[Pasted Content N chars]", Codex 0.160) and the Enter that follows may not submit it
// (turn_start_unobserved, a Kernel start 2026-10-09), and `orca orchestration worker-start --spec <text>` takes the spec as one argv
// element that Windows caps at 32767 UTF-16 units (inc-826e077777de: a packet of 993 owned_paths never launched). So content above
// allocation.promptFile.maxChars (modules/models/runtimes.yaml, the only place the bound is declared) is written verbatim to a file and
// the terminal or the Task spec is given a short pointer that names it.
//
// One directory: <state root>/dispatch-prompts. One cleanup rule: the writer that names a file in that directory removes the
// files older than allocation.promptFile.ttlMs first. Launch specs, follow-up delivery, wake bounds and Critic Task files use this owner.

import fs from 'node:fs';
import path from 'node:path';
import { allocationSettings } from '../../engine/config.mjs';
import { starciLocalRoot } from '../../engine/runtime-root.mjs';
import { sha256 } from '../../engine/digest.mjs';

const DISPATCH_PROMPTS_DIR = 'dispatch-prompts';

/** One positive integer of allocation.promptFile; refuses when the contract omits it. */
function promptFileNumber(key) {
  const value = Number(allocationSettings()?.promptFile?.[key]);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`modules/models/runtimes.yaml allocation.promptFile.${key} must declare a positive number`);
  return value;
}

/** The longest text typed into a terminal or carried as a Task spec: the bound is a few short paragraphs, so an instruction line and a pointer always fit. */
export const promptFileMaxChars = () => promptFileNumber('maxChars');

/** The dispatch prompt of an operation attempt; its job directory supplies the unique identity. */
export const packetFileOf = (jobDir, attempt) => promptFileOf(`packet:${jobDir}:attempt:${Number(attempt) || 1}`);

/**
 * The file a launch or a follow-up with no file of its own spills to: <state>/dispatch-prompts/<hash of the identity>.md. The same call removes the
 * files of that directory older than allocation.promptFile.ttlMs, so the directory holds a day of prompts at most.
 */
export function promptFileOf(identity, { env = process.env, dir = path.join(starciLocalRoot(env), DISPATCH_PROMPTS_DIR), now = Date.now() } = {}) {
  const ttlMs = promptFileNumber('ttlMs');
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isFile() && now - fs.statSync(file).mtimeMs > ttlMs) fs.rmSync(file, { force: true });
    }
  } catch { /* no directory yet, or a file another writer removed first */ }
  return path.join(dir, `${sha256(String(identity))}.md`);
}

/**
 * Writes `prompt` verbatim to `file` (a path, or a function that names it only once the prompt is known to be above the bound) when it is above the bound. Returns {spilled:false} for a prompt that fits, {spilled:true, file, chars} after the
 * write, and {spilled:false, tooLong:true, chars} when it does not fit and there is no file to write to, so the caller's own error stays the real one.
 */
export function spillPrompt({ prompt, file, max = promptFileMaxChars() }) {
  const text = String(prompt ?? '');
  if (text.length <= max) return { spilled: false };
  const target = typeof file === 'function' ? file() : file;
  if (!target) return { spilled: false, tooLong: true, chars: text.length };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, 'utf8');
  return { spilled: true, file: path.resolve(target), chars: text.length };
}

/**
 * The spec to create the operation's Task with: the prompt itself when it fits, else the pointer to the file spillPrompt wrote. `heading` replaces
 * the [Op] first line (a Kernel, Supervisor or [Worker] spec). Returns {spec, spilled, file?, chars?, tooLong?}.
 */
export function taskSpecOf({ prompt, file, op, jobId, attempt = 1, heading = null }) {
  const out = spillPrompt({ prompt, file });
  if (!out.spilled) return { spec: String(prompt ?? ''), ...out };
  const spec = [
    heading ?? `[Op] ${op} — one operation, one verdict. You are an ephemeral op agent spawned by the workflow kernel (job ${jobId}, attempt ${attempt}).`,
    `PACKET FILE: your ${heading ? 'prompt' : 'operation packet'} is ${out.chars} characters, too long to paste into a terminal, so the runtime wrote it verbatim to:`,
    `  ${out.file}`,
    `Read that whole file now, before any other action - every line, to the end. It IS your spec: brief, owned_paths, commit, logging and report rules.`,
    `Nothing in this message replaces or narrows it; never write to that file.`,
  ].join('\n');
  return { spec, ...out };
}
