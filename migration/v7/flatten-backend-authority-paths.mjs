#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const mode = process.argv[2] ?? '--check';
if (!['--check', '--write'].includes(mode)) {
  throw new Error('usage: node migration/v7/flatten-backend-authority-paths.mjs [--check|--write]');
}

const roots = [
  'README.md',
  'INDEX.md',
  'analyze-input.md',
  'knowledge',
  'operators',
  'readiness',
  'scripts',
  'skills',
  'uat'
];
const extensions = new Set(['.md', '.json', '.mjs']);
const replacements = [
  ['.worktrees/<project>/businesses', '.worktrees/businesses'],
  ['.worktrees/<project>/coding-context', '.worktrees/coding-context'],
  ['.worktrees/<project>/quality/debts', '.worktrees/debts'],
  ['.worktrees/<project>/debts', '.worktrees/debts'],
  ['.worktrees/<project>/uat', '.worktrees/uat'],
  ['.worktrees/<project>/<kind>', '.worktrees/<kind>'],
  [String.raw`^\\.worktrees/[a-z0-9][a-z0-9-]*/businesses`, String.raw`^\\.worktrees/businesses`],
  [String.raw`^\\.worktrees/[a-z0-9][a-z0-9-]*/coding-context`, String.raw`^\\.worktrees/coding-context`],
  [String.raw`^\\.worktrees/[A-Za-z0-9._-]+/quality/debts`, String.raw`^\\.worktrees/debts`],
  [String.raw`^\.worktrees\/[a-z0-9][a-z0-9-]*\/businesses`, String.raw`^\.worktrees\/businesses`],
  [String.raw`^\.worktrees\/[a-z0-9][a-z0-9-]*\/coding-context`, String.raw`^\.worktrees\/coding-context`],
  ['.worktrees/${provided.project}/businesses', '.worktrees/businesses'],
  ['.worktrees/${value?.payload?.provided?.project}/coding-context', '.worktrees/coding-context']
];

function filesBelow(target) {
  const absolute = path.join(runtimeRoot, target);
  if (!fs.existsSync(absolute)) return [];
  if (fs.statSync(absolute).isFile()) return [absolute];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(absolute, entry.name);
    return entry.isDirectory() ? filesBelow(path.relative(runtimeRoot, child)) : [child];
  });
}

const changed = [];
for (const file of roots.flatMap(filesBelow).filter((file) => extensions.has(path.extname(file)))) {
  const before = fs.readFileSync(file, 'utf8');
  const after = replacements.reduce((source, [from, to]) => source.replaceAll(from, to), before);
  if (after === before) continue;
  changed.push(path.relative(runtimeRoot, file).replaceAll('\\', '/'));
  if (mode === '--write') fs.writeFileSync(file, after);
}

console.log(JSON.stringify({ mode, changedCount: changed.length, changed }, null, 2));
if (mode === '--check' && changed.length > 0) process.exitCode = 1;
