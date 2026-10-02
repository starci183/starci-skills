#!/usr/bin/env node
// check-generated-untracked.mjs - the GENERATED_UNTRACKED law as a standalone self-check (part of `npm run check`).
//   node scripts/checks/check-generated-untracked.mjs [--json]
//
// A generated root (ruleParams.runtime.generated of knowledge/hfs/runtime-slots.yaml) holds only what its
// generatedBy writes and is git-ignored: a checkout regenerates it and the index can never pin a stale copy.
// This check refuses a git-tracked path under such a root - the same finding scripts/hfs/runtime-check.mjs reports.
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { gitOutputOf } from '../lib/git.mjs';
import { RUNTIME_MANIFEST_FILE, loadSlotManifest, ruleParams } from '../hfs/slots.mjs';
import { generatedUntrackedFindings } from '../hfs/runtime-rules/generated-untracked.mjs';

/** The GENERATED_UNTRACKED findings of the runtime at `root`: every git-tracked file under a generated root. */
export function checkGeneratedUntracked(root = skillRoot) {
  const manifest = loadSlotManifest({ root, file: path.join(root, RUNTIME_MANIFEST_FILE) });
  const params = ruleParams(manifest, 'runtime');
  const tracked = gitOutputOf(lsFiles(['-z'], { dir: root, maxBuffer: 64 * 1024 * 1024 }), 'git ls-files -z').split('\0').filter(Boolean);
  return generatedUntrackedFindings({ params, files: tracked });
}

if (isMain(import.meta.url)) process.exit(printFindings(checkGeneratedUntracked(), "OK: no tracked file lies under a generated root."));
