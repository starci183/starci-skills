#!/usr/bin/env node
// check-test-spawn-seam.mjs - TEST_SPAWN_OUTSIDE_SEAM (part of `npm run check`).
//   runs in the check stage (self-check test-spawn-seam); --json prints the findings as JSON
//
// A child `node --test` that inherits NODE_TEST_CONTEXT believes it is a subtest of an enclosing run: it reports to its parent and exits 0 whatever its tests did, so a verb that
// runs specs as a child would pass red specs when started from inside a test process or from an environment carrying the variable. The ONE seam that clears it is the node
// launcher of scripts/api/node (lib.mjs: nodeSpawn, nodeStart, nodeExecFile, through withoutTestRunner of scripts/lib/env.mjs). This check refuses:
//   - a runtime source file outside scripts/api/ that carries the `--test` argument and spawns a process itself (child_process, spawn/exec primitives, runProgram) instead of the seam;
//   - a seam launcher of scripts/api/node/lib.mjs that does not clear the mark.
// Files that only JUDGE a command line (the command policy, the rights guard, the raw-command scan, the L4 plan assertion) name `--test` without spawning and are not findings.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { gitOutputOf } from '../lib/git.mjs';

export const CODE = 'TEST_SPAWN_OUTSIDE_SEAM';
const TEST_ARG = /['"]--test['"]/;
const SPAWNS = /child_process|\b(?:spawn|spawnSync|execFile|execFileSync|execSync|runProgram)\s*\(/;
const SEAM = 'scripts/api/node/lib.mjs';
const LAUNCHERS = ['nodeSpawn', 'nodeStart', 'nodeExecFile'];

/** The findings over the tracked runtime scripts at `root`. */
export function checkTestSpawnSeam(root = skillRoot) {
  const tracked = gitOutputOf(lsFiles(['-z'], { dir: root, maxBuffer: 64 * 1024 * 1024 }), 'git ls-files -z').split('\0').filter((rel) => /^scripts\/.*\.mjs$/.test(rel) && !rel.startsWith('scripts/api/'));
  const findings = [];
  for (const rel of tracked) {
    let text;
    try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    if (TEST_ARG.test(text) && SPAWNS.test(text)) findings.push({ code: CODE, path: rel, message: `${rel} carries the --test argument and spawns a process itself: start the test runner through scripts/api/node (runNode, execNode, spawnNode), the one seam that clears NODE_TEST_CONTEXT` });
  }
  let seam = '';
  try { seam = fs.readFileSync(path.join(root, SEAM), 'utf8'); } catch { /* reported below */ }
  for (const launcher of LAUNCHERS) {
    const line = seam.split('\n').find((l) => l.includes(`export const ${launcher}`)) ?? '';
    if (!line.includes('forChild(')) findings.push({ code: CODE, path: SEAM, message: `${launcher} does not pass its options through forChild: a child node --test would inherit the mark of an enclosing spec run` });
  }
  return findings;
}

if (isMain(import.meta.url)) process.exit(printFindings(checkTestSpawnSeam(), 'OK: every test runner the runtime starts goes through the one launcher that clears the enclosing run.'));
