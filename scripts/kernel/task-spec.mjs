// task-spec.mjs — the Orca Task spec an operation is created with, sized for the host's argv.
//
// `orca orchestration task-create --spec <text>` takes the spec inline: there is no --spec-file, and
// scripts/api/orca/lib.mjs passes it as one argv element to spawnSync. Windows caps a whole command
// line at 32767 UTF-16 units, so a packet above that fails at spawn with ENAMETOOLONG before Orca sees
// it - deterministically, every retry (nivo wf-nivo-workspace-provision-mujek7cb inc-826e077777de: a
// commit-only work-debt adoption, op-business.decide-cc63d20d87, carried 993 frozen owned_paths and
// its rendered packet never launched). A command-terminal launch then sends Orca's returned preamble,
// which embeds the spec, through `terminal send --text` - the same ceiling a second time.
//
// A prompt at or under TASK_SPEC_MAX_CHARS goes inline exactly as before. A longer one is written
// verbatim to the job's scratch directory (op-prompt.mjs jobScratchDirOf) and the Task spec becomes a
// short pointer that names the file and tells the worker to read all of it first: the packet the
// worker follows is byte-for-byte the one buildOpPrompt rendered, only its transport changed.

import fs from 'node:fs';
import path from 'node:path';

// Head-room under 32767 for the rest of the task-create argv (run id, titles, parent, from, --json)
// and for the Orca preamble a command terminal receives around the spec.
export const TASK_SPEC_MAX_CHARS = 16000;

/** The file a spilled packet is written to: <jobDir>/packet.a<attempt>.md. */
export const packetFileOf = (jobDir, attempt) => path.join(jobDir, `packet.a${Number(attempt) || 1}.md`);

/**
 * The spec to create the operation's Task with.
 * Returns {spec, spilled:false} for a prompt that fits, else writes it to `file` and returns
 * {spec: <pointer>, spilled:true, file, chars}; `heading` replaces the [Op] first line (a Kernel, Supervisor or
 * [Worker] spec). A spill with no file to write to returns the prompt
 * inline (spilled:false, tooLong:true) so the caller's task-create error stays the real one.
 */
export function taskSpecOf({ prompt, file, op, jobId, attempt = 1, heading = null, max = TASK_SPEC_MAX_CHARS, write = fs.writeFileSync, mkdir = fs.mkdirSync }) {
  const text = String(prompt ?? '');
  if (text.length <= max) return { spec: text, spilled: false };
  if (!file) return { spec: text, spilled: false, tooLong: true, chars: text.length };
  mkdir(path.dirname(file), { recursive: true });
  write(file, text, 'utf8');
  const spec = [
    heading ?? `[Op] ${op} — one operation, one verdict. You are an ephemeral op agent spawned by the workflow kernel (job ${jobId}, attempt ${attempt}).`,
    `PACKET FILE: your ${heading ? 'prompt' : 'operation packet'} is ${text.length} characters, more than the host passes on a command line, so the runtime wrote it verbatim to:`,
    `  ${path.resolve(file)}`,
    `Read that whole file now, before any other action - every line, to the end. It IS your spec: brief, owned_paths, commit, logging and report rules.`,
    `Nothing in this message replaces or narrows it; never write to that file.`,
  ].join('\n');
  return { spec, spilled: true, file: path.resolve(file), chars: text.length };
}
