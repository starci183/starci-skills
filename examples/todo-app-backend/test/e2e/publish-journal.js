#!/usr/bin/env node
'use strict';

/**
 * Merges the per-run journals that `npm run test:e2e -- <group>` wrote (one directory per group) into the
 * tracked run journal under test/e2e/run/. Nothing here re-runs or rewrites a measurement: every byte
 * copied was written by a real run of a real check command, and the exit code recorded beside each group
 * is that command's own.
 *
 * Usage: node test/e2e/publish-journal.js <directory-of-group-journals>
 */

const fs = require('node:fs');
const path = require('node:path');

const TARGET = path.join(__dirname, 'run');

function readJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

function main(source) {
  if (!source) throw new Error('usage: node test/e2e/publish-journal.js <directory-of-group-journals>');
  const roots = [source, path.join(source, 'journal')].filter((dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory());
  const groupDirs = fs.readdirSync(roots.includes(path.join(source, 'journal')) ? roots[1] : source, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(roots.includes(path.join(source, 'journal')) ? roots[1] : source, entry.name));

  const stacks = [];
  const scenarios = {};
  const readback = [];
  let runOutput = '';

  for (const dir of groupDirs) {
    const stack = readJson(path.join(dir, 'stack.json'));
    const scene = readJson(path.join(dir, 'scenarios.json'));
    const back = readJson(path.join(dir, 'readback.json'));
    const output = fs.existsSync(path.join(dir, 'run-output.txt')) ? fs.readFileSync(path.join(dir, 'run-output.txt'), 'utf8') : '';
    if (!stack && !scene && !output) continue;
    if (stack) stacks.push(stack);
    if (scene) scenarios[scene.group] = scene;
    if (Array.isArray(back)) readback.push(...back);
    runOutput += `${output.trimEnd()}\n\n`;
  }

  if (!stacks.length) throw new Error(`no group journals found under ${source}`);
  fs.mkdirSync(TARGET, { recursive: true });
  fs.writeFileSync(path.join(TARGET, 'stack.json'), `${JSON.stringify(stacks, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(TARGET, 'scenarios.json'), `${JSON.stringify(scenarios, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(TARGET, 'readback.json'), `${JSON.stringify(readback, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(TARGET, 'run-output.txt'), runOutput, 'utf8');
  const tally = readback.reduce((acc, entry) => {
    acc[entry.outcome] = (acc[entry.outcome] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`published ${stacks.length} run journal(s), ${readback.length} assertion record(s): ${JSON.stringify(tally)}`);
  for (const stack of stacks) {
    console.log(`  ${stack.group.padEnd(24)} ${JSON.stringify(stack.counts)} disposed=${stack.teardown?.clean === true}`);
  }
}

main(process.argv[2]);
