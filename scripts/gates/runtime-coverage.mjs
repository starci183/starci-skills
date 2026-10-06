#!/usr/bin/env node
// runtime-coverage.mjs - `starci gate runtime-coverage`: the runtime's root node:test suite under Node's built-in coverage, writing coverage/lcov.info.
//   starci gate runtime-coverage [spec files or globs...]     default: tests/**/*.spec.mjs (the whole suite, ~25 minutes)
// It is `npm test` (the same glob and the same --import isolation preloads of tests/setup/) plus the coverage options of
// scripts/hfs/runtime-coverage-scope.mjs: the lcov denominator is the runtime's first-party source and nothing else. A normal spec
// report goes to stdout and the lcov to coverage/lcov.info (git-ignored). Arguments narrow the run to a subset, which is a smoke test
// of the producer and never the project's coverage. The exit code is the suite's: a red spec still leaves its lcov behind.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNode } from '../api/node/run-node.mjs';
import { isMain } from '../lib/is-main.mjs';
import { RUNTIME_LCOV, runtimeCoverageNodeArgs, runtimeTestGlob } from '../hfs/runtime-coverage-scope.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PRELOADS = ['low-priority', 'isolated-temp', 'isolated-registry', 'runtime-copies'].map((name) => `./tests/setup/${name}.mjs`);

/** The node arguments of the coverage run over `specs` (the whole suite when none). */
export const coverageArgs = (specs = []) => [
  ...PRELOADS.flatMap((file) => ['--import', file]),
  ...runtimeCoverageNodeArgs(),
  '--test-reporter=spec', '--test-reporter-destination=stdout',
  '--test-reporter=lcov', `--test-reporter-destination=${RUNTIME_LCOV}`,
  '--test', ...(specs.length ? specs : [runtimeTestGlob()]),
];

/** Runs the suite under coverage from `root`; returns the exit status (node does not create the lcov directory, so it is made here). */
function runCoverage(specs = [], root = ROOT) {
  fs.mkdirSync(path.join(root, path.dirname(RUNTIME_LCOV)), { recursive: true });
  const child = runNode(coverageArgs(specs), { cwd: root, stdio: 'inherit', maxBuffer: 1 << 30 });
  return child.status ?? 1;
}

if (isMain(import.meta.url)) process.exitCode = runCoverage(process.argv.slice(2));
