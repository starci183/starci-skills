// op-prompt-imagegen.mjs — the line of the [Op] prompt that tells a drawing op how it gets an image (owner decision 2026-10-07:
// imagegen is a headless call an op makes, never an op's seat). Only the ops modules/kernel/command-policy.yaml calls.imagegen
// names are told; the same table is what the command guard enforces.
import { loadCommandPolicy } from '../guards/command-policy.mjs';

const REFUSALS = 'IMAGEGEN_QUOTA, IMAGEGEN_CAPACITY, IMAGEGEN_UNAVAILABLE, IMAGEGEN_RUNNER_FAILED, IMAGEGEN_TIMEOUT, IMAGEGEN_NO_OUTPUT, IMAGEGEN_BAD_INPUT, IMAGEGEN_OUT_OF_WORKTREE';

/** The machine line for `op` (its kind), or no line when the op is not one the call table names. */
export function imagegenPromptLines({ skillRoot, op }) {
  const call = loadCommandPolicy({ root: skillRoot })?.calls?.imagegen;
  if (!Array.isArray(call?.ops) || !call.ops.includes(op)) return [];
  return [
    `  starci-imagegen → starci work imagegen --prompt <STARCI_JOB_SCRATCH>/<stem>.prompt.txt --out <the record's assets directory in your worktree> --name <stem> [--reference <image>]... [--count N] [--size WxH] --json — the only way you get an image generated: you run no image model and no codex yourself, the verb calls the imagegen model (Codex) headlessly on its own call tier. Write the exact brief to the prompt file first; the verb writes <stem>-<n>.png, <stem>-<n>.prompt.txt (the brief bytes) and generation-receipts.yaml (model, sha256, toolOutputBasename, real pixel size, duration, usage) in --out, and the size you ask is a request. Record each image as generation.tool image_gen.imagegen with promptPath and the receipt's sha256, and attach the --json output. A refusal names its code (${REFUSALS}): report it as outcome blocked, kind environment, with the code and detail; never retry in a loop and never replace the image with a hand-made, scripted or reused one`,
  ];
}
