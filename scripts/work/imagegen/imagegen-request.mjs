// imagegen-request.mjs — the arguments of `starci work imagegen` read and judged: the prompt file, the reference images, the
// image count and size, and the output directory, which must sit inside the op's worktree. A refusal names its code.
import fs from 'node:fs';
import path from 'node:path';
import { parseOpts } from '../../lib/cli-arg.mjs';
import { containedPath, slash } from '../../lib/path-key.mjs';
import { IMAGEGEN_CODES, refusal } from './imagegen-codes.mjs';

const MAX_PROMPT_BYTES = 64 * 1024;
const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;
const NAME = /^[a-z0-9][a-z0-9._-]*$/i;
const SIZE = /^\d{3,5}x\d{3,5}$/;
const REFERENCE_SIGNATURES = Object.freeze({
  '.png': (head) => head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  '.jpg': (head) => head.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  '.jpeg': (head) => head.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  '.webp': (head) => head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP',
});

// The usage line of the verb.
const IMAGEGEN_USAGE = 'use: starci work imagegen --prompt <file> --out <dir inside the worktree> [--reference <image>]... [--count N] [--size WxH] [--name <stem>] [--stage <label>] [--json]';

/** argv read into raw options {prompt, out, references[], count, size, name, stage, json}, or {usage} naming what is wrong. */
export function readImagegenArgv(argv) {
  const problems = [];
  const opts = parseOpts(argv, {
    '--prompt': (o, take) => { o.prompt = take(); },
    '--out': (o, take) => { o.out = take(); },
    '--reference': (o, take) => { o.references = [...(o.references ?? []), take()]; },
    '--count': (o, take) => { o.count = take(); },
    '--size': (o, take) => { o.size = take(); },
    '--name': (o, take) => { o.name = take(); },
    '--stage': (o, take) => { o.stage = take(); },
    '--json': (o) => { o.json = true; },
  }, (problem) => problems.push(problem));
  if (!opts.prompt) problems.push('--prompt is required');
  if (!opts.out) problems.push('--out is required');
  return problems.length ? { usage: `${problems.join('; ')}\n${IMAGEGEN_USAGE}` } : { opts };
}

function insideWorktree(base, file) {
  try { containedPath(base, file, { label: 'reference' }); return true; } catch { return false; }
}

function referenceProblem(file) {
  const check = REFERENCE_SIGNATURES[path.extname(file).toLowerCase()];
  if (!check) return `${file} is not a png, jpg or webp reference image`;
  let stat;
  try { stat = fs.statSync(file); } catch { return `${file} does not exist`; }
  if (!stat.isFile() || stat.size < 12 || stat.size > MAX_REFERENCE_BYTES) return `${file} is not a regular image file of 12 bytes to 20 MiB`;
  const head = Buffer.alloc(12);
  const fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, head, 0, 12, 0); } finally { fs.closeSync(fd); }
  return check(head) ? null : `${file} is not the ${path.extname(file)} image its name claims`;
}

function promptProblem(file) {
  let stat;
  try { stat = fs.statSync(file); } catch { return `prompt file ${file} does not exist`; }
  if (!stat.isFile() || stat.size === 0 || stat.size > MAX_PROMPT_BYTES) return `prompt file ${file} is not a non-empty regular file of at most ${MAX_PROMPT_BYTES} bytes`;
  return null;
}

const stemOf = (promptFile) => path.basename(promptFile).replace(/\.prompt\.txt$/i, '').replace(/\.[^.]+$/, '');

function countProblem(count, spec) {
  const valid = Number.isInteger(count) && count >= 1 && count <= spec.maxImages;
  return valid ? null : `--count must be an integer from 1 to ${spec.maxImages}`;
}

function inputProblems(opts, spec, count) {
  const refs = opts.references ?? [];
  const found = [promptProblem(path.resolve(opts.prompt)), countProblem(count, spec)];
  if (refs.length > spec.maxReferences) found.push(`at most ${spec.maxReferences} --reference images`);
  if (opts.size !== undefined && !SIZE.test(opts.size)) found.push('--size must look like 1536x1024');
  if (opts.name !== undefined && !NAME.test(opts.name)) found.push('--name must be a file stem of letters, digits, dot, dash or underscore');
  return [...found, ...refs.map((file) => referenceProblem(path.resolve(file)))].filter(Boolean);
}

/**
 * The request the run takes, or a typed refusal. `root` is the worktree the output must sit inside; `spec` is tiers.yaml
 * calls.imagegen. A target file that already exists is refused: a variant takes a new --name.
 */
export function imagegenRequest(opts, { root, spec }) {
  const count = opts.count === undefined ? 1 : Number(opts.count);
  const problems = inputProblems(opts, spec, count);
  if (problems.length) return refusal(IMAGEGEN_CODES.badInput, problems.join('; '));
  let outDir;
  let base;
  try {
    base = containedPath(root, '.', { label: 'worktree' });
    outDir = containedPath(root, path.resolve(opts.out), { label: '--out' });
  } catch (error) { return refusal(IMAGEGEN_CODES.outsideWorktree, error.message); }
  const outside = (opts.references ?? []).find((file) => !insideWorktree(base, path.resolve(file)));
  if (outside) return refusal(IMAGEGEN_CODES.outsideWorktree, `reference ${outside} is outside the worktree: the receipt cites each reference by a worktree path, so copy it into the record first`);
  const rel = slash(path.relative(base, outDir));
  if (rel === '.git' || rel.startsWith('.git/')) return refusal(IMAGEGEN_CODES.outsideWorktree, '--out must not be inside .git');
  const prompt = path.resolve(opts.prompt);
  const stem = opts.name ?? stemOf(prompt);
  const taken = Array.from({ length: count }, (_, i) => path.join(outDir, `${stem}-${i + 1}.png`)).find((file) => fs.existsSync(file));
  if (taken) return refusal(IMAGEGEN_CODES.badInput, `${taken} already exists: a variant takes a new --name`);
  return { ok: true, promptFile: prompt, promptText: fs.readFileSync(prompt), references: (opts.references ?? []).map((file) => path.resolve(file)),
    count, size: opts.size ?? null, outDir, root, stem, stage: opts.stage ?? 'final', json: opts.json === true };
}
