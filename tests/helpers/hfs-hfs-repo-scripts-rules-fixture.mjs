import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { APP, cleanup, gitAdd, writeCleanRepo } from './hfs-cli-fixture.mjs';

const relativePath = (value) => {
  const normalized = path.posix.normalize(value.replace(/\\/g, '/'));
  if (normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) throw new Error(`fixture path escapes the repository: ${value}`);
  return normalized;
};

const targetOf = (root, relative) => path.join(root, ...relative.split('/'));

const snapshotFiles = (root) => {
  const files = new Map();
  const directories = new Set(['.']);
  const visit = (dir, prefix = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!prefix && entry.name === '.git') continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        directories.add(relative);
        visit(path.join(dir, entry.name), relative);
      } else {
        files.set(relative, fs.readFileSync(path.join(dir, entry.name)));
      }
    }
  };
  visit(root);
  return { directories, files };
};

/** One Git-backed clean app, restored before every rule scenario in this spec process. */
export function createHfsRepoScriptsRulesFixture() {
  const root = gitAdd(writeCleanRepo(APP));
  const baseline = snapshotFiles(root);
  const dirtyFiles = new Set();
  const dirtyDirectories = new Set();

  const restore = () => {
    for (const relative of dirtyFiles) {
      const target = targetOf(root, relative);
      const original = baseline.files.get(relative);
      if (original === undefined) fs.rmSync(target, { force: true });
      else {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, original);
      }
    }
    for (const relative of [...dirtyDirectories].sort((a, b) => b.length - a.length)) {
      if (baseline.directories.has(relative)) continue;
      try { fs.rmdirSync(targetOf(root, relative)); } catch (error) {
        if (!['ENOENT', 'ENOTEMPTY'].includes(error?.code)) throw error;
      }
    }
    dirtyFiles.clear();
    dirtyDirectories.clear();
  };

  const put = (dir, relative, text = 'export {};\n') => {
    if (dir !== root) throw new Error('fixture writes must target its shared repository');
    const normalized = relativePath(relative);
    const target = targetOf(root, normalized);
    for (let parent = path.posix.dirname(normalized); parent !== '.'; parent = path.posix.dirname(parent)) dirtyDirectories.add(parent);
    dirtyFiles.add(normalized);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  };

  const repoOf = (declaration = APP, mutate, options) => {
    if (declaration !== APP || options !== undefined) throw new Error('this fixture owns only the default clean app');
    restore();
    if (mutate) mutate(root);
    execFileSync('git', ['-C', root, 'add', '-A', '-f', '--', '.', ':!node_modules'], { stdio: 'ignore' });
    return root;
  };

  return {
    basePackage: JSON.parse(baseline.files.get('package.json').toString('utf8')),
    dispose: () => cleanup([root]),
    put,
    repoOf,
  };
}
