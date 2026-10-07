#!/usr/bin/env node
// imagegen.mjs — `starci work imagegen`: the one way an op gets an image generated (owner decision 2026-10-07: imagegen is a
// headless call, never an op's seat). The op writes its prompt to a file and names an output directory inside its worktree;
// the verb admits the call on the imagegen call tier (tiers.yaml calls: the picker, the quota threshold and a provider slot for
// the duration), runs `codex exec` headlessly with the image tool, writes <stem>-<n>.png and <stem>-<n>.prompt.txt under the
// directory and appends the calls to <dir>/generation-receipts.yaml (model, prompt and image sha256, duration, usage).
//
//   starci work imagegen --prompt <file> --out <dir> [--reference <image>]... [--count N] [--size WxH] [--name <stem>]
//                        [--stage <label>] [--json]      exit 0 images written, 1 typed refusal (code), 2 bad usage
import { callSpec } from '../agent/tiers.mjs';
import { opContextOf } from '../guards/op-context.mjs';
import { isMain } from '../lib/is-main.mjs';
import { gitRootOf } from './git-root.mjs';
import { IMAGEGEN_CODES, refusal } from './imagegen/imagegen-codes.mjs';
import { imagegenRequest, readImagegenArgv } from './imagegen/imagegen-request.mjs';
import { runImagegen } from './imagegen/imagegen-run.mjs';

function textOf(result) {
  if (!result.ok) return `imagegen REFUSED [${result.code}]: ${result.detail}`;
  const lines = result.files.map((file) => `  ${file.path} ${file.width}x${file.height} sha256 ${file.sha256}`);
  return [`imagegen ok: ${result.produced} of ${result.requested} image(s) on ${result.model} in ${result.durationMs} ms`, ...lines, `  receipt ${result.receipt}`].join('\n');
}

/** The verb over argv: returns the exit code; `root` (the worktree), `context` (the op's binding), `deps` and `io` are the specs' seams. */
export async function main(argv, { cwd = process.cwd(), env = process.env, root = undefined, context = undefined, deps = {}, io = null, out = process.stdout, err = process.stderr } = {}) {
  const read = readImagegenArgv(argv);
  if (read.usage) { err.write(`${read.usage}\n`); return 2; }
  const json = read.opts.json === true;
  const worktree = root === undefined ? gitRootOf(cwd) : root;
  const spec = callSpec('imagegen');
  let result;
  if (!worktree) result = refusal(IMAGEGEN_CODES.outsideWorktree, `${cwd} is not inside a git worktree: the output directory must be inside the op's worktree`);
  else {
    const request = imagegenRequest(read.opts, { root: worktree, spec });
    const bound = context === undefined ? opContextOf({ env }) : context;
    result = request.ok ? await runImagegen({ ...request, scopeId: `imagegen:${bound?.jobId ?? 'owner'}` }, { env, io, deps }) : request;
  }
  out.write(json ? `${JSON.stringify(result, null, 2)}\n` : `${textOf(result)}\n`);
  return result.ok ? 0 : 1;
}

if (isMain(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
