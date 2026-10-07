// imagegen-codex.mjs — the headless Codex side of `starci work imagegen`: the brief Codex is given, the `codex exec` argv, the
// run (scripts/api/codex/exec.mjs, its events read by scripts/lib/codex-exec-events.mjs) and the images it leaves in its
// generated_images/<thread> directory. Codex is told to generate only: the runtime, not the model, copies the files out.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exec } from '../../api/codex/exec.mjs';
import { killTree } from '../../api/process/kill-tree.mjs';
import { newExecEvents, takeExecLine } from '../../lib/codex-exec-events.mjs';
import { withoutSeatEnv, withoutSeatShim } from '../../lib/seat-env.mjs';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** The brief handed to Codex: the op's prompt between the instruction to generate and nothing else. */
export function imagegenBrief({ promptText, count, size, referenceCount }) {
  const lines = [
    `Generate exactly ${count} image${count === 1 ? '' : 's'} with the built-in image generation tool, one tool call per image, from the brief below.`,
    'Do not write, copy, move or edit any file and do not run other commands: the images are collected from the tool output afterwards.',
    'When every image is generated reply with the single word done; when you cannot generate one reply refused: and the reason.',
  ];
  if (size) lines.push(`Requested size: ${size} pixels (the tool decides the size it returns; ask for this aspect ratio).`);
  if (referenceCount) lines.push(`The ${referenceCount} attached image${referenceCount === 1 ? ' is a reference' : 's are references'} for style and composition, not images to edit.`);
  return `${lines.join('\n')}\n\n--- brief ---\n${promptText.toString('utf8')}\n`;
}

/** The `codex exec` argv for one run: JSON events, nothing persisted, a read-only sandbox in `cwd`, the member's model and effort, the prompt on stdin. */
export function imagegenArgs({ cwd, member, references }) {
  const effort = member.effort ? ['-c', `model_reasoning_effort="${member.effort}"`] : [];
  return ['exec', '--json', '--ephemeral', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules', '-s', 'read-only', '-C', cwd,
    '-m', member.model, ...effort, ...references.map((file) => `--image=${file}`), '-'];
}

/** The environment of the run: the caller's, without the seat identity or the guard-shim PATH, so Codex runs as the owner's own login. */
const runnerEnv = (env) => withoutSeatShim(withoutSeatEnv(env));

/**
 * Run `codex exec` once. Input {args, brief, cwd, env, timeoutMs, onSpawn}; resolves {code, signal, pid, timedOut, error, stderr,
 * events: {threadId, usage, failures[], lastMessage}, exited}. `exited` is true when the child's close was seen.
 */
export async function runCodex({ args, brief, cwd, env, timeoutMs, onSpawn = null }) {
  const events = newExecEvents();
  const result = await exec(args, { input: brief, cwd, env: runnerEnv(env), timeoutMs, onSpawn, stop: (pid) => killTree(pid),
    onLine: (line) => takeExecLine(events, line) });
  return { ...result, events };
}

/** Where Codex keeps the images of a thread: <CODEX_HOME or ~/.codex>/generated_images/<thread>. */
const generatedDir = (env, threadId) => path.join(env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'generated_images', threadId);

/** The PNG files Codex generated in a thread, oldest first: [{file, basename, bytes}] (a file that is not a PNG is ignored). */
export function collectGenerated(env, threadId) {
  const dir = generatedDir(env, threadId);
  let names;
  try { names = fs.readdirSync(dir); } catch { return []; }
  return names.map((name) => path.join(dir, name)).filter((file) => path.extname(file).toLowerCase() === '.png')
    .map((file) => ({ file, basename: path.basename(file), mtimeMs: fs.statSync(file).mtimeMs, bytes: fs.readFileSync(file) }))
    .filter((item) => item.bytes.subarray(0, 8).equals(PNG_SIGNATURE))
    .sort((a, b) => a.mtimeMs - b.mtimeMs || (a.basename < b.basename ? -1 : 1));
}
