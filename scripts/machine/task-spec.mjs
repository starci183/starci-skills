// task-spec.mjs — the Orca Task spec an operation is created with, sized for the host's argv.
//
// `orca orchestration worker-start --spec <text>` takes the spec inline: there is no --spec-file, and
// scripts/api/orca/lib.mjs passes it as one argv element to spawnSync. Windows caps a whole command
// line at 32767 UTF-16 units, so a packet above that fails at spawn with ENAMETOOLONG before Orca sees
// it - deterministically, every retry (inc-826e077777de: a
// leg, op-business.decide-cc63d20d87, carried 993 frozen owned_paths and
// its rendered packet never launched). A command-terminal launch then sends Orca's returned preamble,
// which embeds the spec, through `terminal send --text` - the same ceiling a second time.
//
// A prompt at or under TASK_SPEC_MAX_CHARS goes inline exactly as before. A longer one is written
// verbatim to a file its owner removes (the job's evidence directory, the Kernel's state directory, a Critic's placement, the dispatch-prompts directory of the state root) and the Task spec becomes a
// short pointer that names the file and tells the worker to read all of it first: the packet the
// worker follows is byte-for-byte the one buildOpPrompt rendered, only its transport changed.

import fs from 'node:fs';
import path from 'node:path';
import { starciLocalRoot } from '../../engine/runtime-root.mjs';
import { sha256 } from '../../engine/digest.mjs';

// Content is a file; what travels is the reference. A prompt above this bound is never pasted into an agent's terminal: agent TUIs fold a large
// paste into a chip ("[Pasted Content N chars]", Codex 0.160) and the Enter that follows may not submit it (turn_start_unobserved, Nivo Kernel
// 2026-10-09: a 16831-character paste, 15.9 KB of it the prompt under the old 16000 bound), and the argv of a command line is capped besides.
// The bound is a few short paragraphs: an instruction line and a pointer always fit.
export const TASK_SPEC_MAX_CHARS = 2000;

/** The file a spilled packet is written to: <jobDir>/packet.a<attempt>.md. */
export const packetFileOf = (jobDir, attempt) => path.join(jobDir, `packet.a${Number(attempt) || 1}.md`);

/**
 * The spec to create the operation's Task with.
 * Returns {spec, spilled:false} for a prompt that fits, else writes it to `file` and returns
 * {spec: <pointer>, spilled:true, file, chars}; `heading` replaces the [Op] first line (a Kernel, Supervisor or
 * [Worker] spec). A spill with no file to write to returns the prompt
 * inline (spilled:false, tooLong:true) so the caller's worker-start error stays the real one.
 */
export function taskSpecOf({ prompt, file, op, jobId, attempt = 1, heading = null, max = TASK_SPEC_MAX_CHARS, write = fs.writeFileSync, mkdir = fs.mkdirSync }) {
  const text = String(prompt ?? '');
  if (text.length <= max) return { spec: text, spilled: false };
  if (!file) return { spec: text, spilled: false, tooLong: true, chars: text.length };
  mkdir(path.dirname(file), { recursive: true });
  write(file, text, 'utf8');
  const spec = [
    heading ?? `[Op] ${op} — one operation, one verdict. You are an ephemeral op agent spawned by the workflow kernel (job ${jobId}, attempt ${attempt}).`,
    `PACKET FILE: your ${heading ? 'prompt' : 'operation packet'} is ${text.length} characters, too long to paste into a terminal, so the runtime wrote it verbatim to:`,
    `  ${path.resolve(file)}`,
    `Read that whole file now, before any other action - every line, to the end. It IS your spec: brief, owned_paths, commit, logging and report rules.`,
    `Nothing in this message replaces or narrows it; never write to that file.`,
  ].join('\n');
  return { spec, spilled: true, file: path.resolve(file), chars: text.length };
}

/** The state-root directory of prompt files no other owner holds (a Supervisor or [Worker] seat, a launch smoke): <state>/dispatch-prompts. */
export const DISPATCH_PROMPTS_DIR = 'dispatch-prompts';
/** How long a prompt file stays: the launch that wrote it is long attested by then, and the next launch removes it (the writer's own cleanup duty). */
export const DISPATCH_PROMPT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * The file a launch with no file of its own spills its prompt to: <state>/dispatch-prompts/<hash of the launch identity>.md. The same call removes the
 * files of that directory older than DISPATCH_PROMPT_TTL_MS, so the directory holds a day of prompts at most.
 */
export function defaultSpecFile(identity, { dir = path.join(starciLocalRoot(), DISPATCH_PROMPTS_DIR), now = Date.now() } = {}) {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isFile() && now - fs.statSync(file).mtimeMs > DISPATCH_PROMPT_TTL_MS) fs.rmSync(file, { force: true });
    }
  } catch { /* no directory yet, or a file another launch removed first */ }
  return path.join(dir, `${sha256(String(identity))}.md`);
}
