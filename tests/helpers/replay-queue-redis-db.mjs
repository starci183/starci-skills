// Replays authored queue production templates with the current authored regression spec and installed Nest/Jest.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../../engine/yaml.mjs';
import { makeTempDir } from '../../scripts/api/fs/make-temp-dir.mjs';
import { runNode } from '../../scripts/api/node/run-node.mjs';
import { jestCoverage } from '../../scripts/hfs/coverage-scope.mjs';
import { installInto, missingFrom, RUNTIME, runtimeInstalls, uninstall } from './hfs-app-install.mjs';

const require = createRequire(import.meta.url);
const REQUIRED = Object.freeze([
  'typescript', 'jest', 'ts-jest', 'tslib', '@types/jest', '@types/node', '@nestjs/common', '@nestjs/core',
  '@nestjs/testing', 'reflect-metadata', 'rxjs', 'typeorm',
]);
const QUEUE_FILES = Object.freeze([
  'bullmq-queue-transport.client.ts', 'queue.decorators.ts', 'queue.options.ts', 'queue.contracts.ts',
  'queue.port.ts', 'queue-transport.port.ts', 'queue.policy.ts',
]);

/** Runs the actual adapter from RUNTIME; in replay-on-revision RUNTIME is the old exported tree. */
export function replayQueueRedisDb(t) {
  const app = makeTempDir('starci-queue-db-replay-');
  let links = [];
  t.after(() => uninstall(app, links));
  // The nested revision export borrows the enclosing checkout's installed compiler and current regression input.
  const dependencyRoot = path.dirname(path.dirname(path.dirname(require.resolve('typescript/package.json'))));
  const installs = runtimeInstalls({ root: dependencyRoot, env: {}, required: REQUIRED });
  const missing = missingFrom(installs, REQUIRED);
  if (missing.length) throw new Error(`Queue DB replay requires installed packages: ${missing.join(', ')}`);
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'private-queue-db-replay', private: true }));
  links = installInto(app, installs);
  const be = path.join(app, 'be');
  fs.mkdirSync(path.join(be, 'apps'), { recursive: true });
  const queue = path.join(be, 'src/modules/platform/queue');
  const composition = path.join(be, 'src/modules/platform/composition');
  fs.mkdirSync(queue, { recursive: true });
  fs.mkdirSync(composition, { recursive: true });
  const templates = path.join(RUNTIME, 'packages/hfs/templates/be');
  for (const name of QUEUE_FILES) {
    fs.copyFileSync(path.join(templates, 'patterns/queues/platform', `${name}.tpl`), path.join(queue, name));
  }
  for (const name of ['index.ts', 'composition.decorators.ts']) {
    fs.copyFileSync(path.join(templates, 'skeleton/src/modules/platform/composition', name), path.join(composition, name));
  }
  fs.copyFileSync(path.join(templates, 'tool-config/tsconfig.json'), path.join(be, 'tsconfig.json'));
  const manifest = parseYaml(fs.readFileSync(path.join(RUNTIME, 'knowledge/hfs/slots.yaml'), 'utf8'));
  fs.writeFileSync(path.join(be, 'jest.config.js'),
    `module.exports = require("@starci/jest-preset").starciJestConfig({ coverage: ${JSON.stringify(jestCoverage(manifest))} })\n`);
  const specName = 'bullmq-queue-transport.client.spec.ts';
  const spec = path.join(queue, specName);
  // Test input is current; production above stays at the revision under test. Copy the entire authored spec unchanged.
  fs.copyFileSync(path.join(dependencyRoot, 'packages/hfs/templates/be/patterns/queues/platform', `${specName}.tpl`), spec);
  const resultFile = path.join(app, 'jest-result.json');
  const fromApp = createRequire(path.join(app, 'package.json'));
  const run = runNode([
    fromApp.resolve('jest/bin/jest'), '--config', path.join(be, 'jest.config.js'), '--selectProjects', 'unit',
    '--runInBand', '--ci', '--no-cache', '--cacheDirectory', path.join(app, 'jest-cache'),
    '--json', '--outputFile', resultFile, '--runTestsByPath', spec,
  ], { cwd: be, maxBuffer: 16 * 1024 * 1024 });
  const result = fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, 'utf8')) : null;
  return { run, result };
}
