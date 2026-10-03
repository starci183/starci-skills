import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseYaml } from '../../engine/yaml.mjs';
import { checkRepo as checkHfsRepo } from '../../scripts/hfs/check.mjs';
import { loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { APP, writeCleanRepo } from './hfs-cli-fixture.mjs';

const manifest = loadSlotManifest();
const slash = (value) => value.replaceAll(path.sep, '/');
const projectRoot = path.resolve(import.meta.dirname, '..', '..');
const IMMUTABLE_CATALOGS = ['knowledge/hfs/canon-pins.yaml', 'knowledge/hfs/rules.yaml', 'modules/kernel/failure-codes.yaml'];

function cachedCatalogRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-tree-rule-catalogs-'));
  for (const relative of IMMUTABLE_CATALOGS) {
    const source = path.join(projectRoot, ...relative.split('/'));
    const target = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(parseYaml(fs.readFileSync(source, 'utf8'))));
  }
  return root;
}

function filesBelow(root) {
  const files = new Map();
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (directory === root && entry.name === '.git') continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(target);
      else files.set(slash(path.relative(root, target)), fs.readFileSync(target));
    }
  };
  visit(root);
  return files;
}

function sameBytes(file, content) {
  try { return fs.readFileSync(file).equals(content); } catch { return false; }
}

function desiredDirectories(files) {
  const directories = new Set();
  for (const file of files) {
    let directory = path.posix.dirname(file);
    while (directory !== '.') {
      directories.add(directory);
      directory = path.posix.dirname(directory);
    }
  }
  return directories;
}

function removeExtra(directory, desired, directories, root) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (directory === root && entry.name === '.git') continue;
    const target = path.join(directory, entry.name);
    const relative = slash(path.relative(root, target));
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      if (directories.has(relative)) {
        removeExtra(target, desired, directories, root);
        if (fs.readdirSync(target).length === 0) fs.rmdirSync(target);
      } else fs.rmSync(target, { recursive: true, force: true });
    } else if (!desired.has(relative)) fs.rmSync(target, { force: true });
  }
}

/** One canonical Git tree per declaration, restored before every overlay mutation. */
export function hfsTreeRulesFixture() {
  const repos = new Map();
  const catalogRoot = cachedCatalogRoot();

  const fixtureFor = (declaration, options) => {
    const key = JSON.stringify([declaration, options ?? null]);
    let fixture = repos.get(key);
    if (!fixture) {
      const dir = writeCleanRepo(declaration, options);
      const baseline = filesBelow(dir);
      fixture = { dir, baseline, directories: desiredDirectories(baseline.keys()), fresh: true };
      execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore' });
      repos.set(key, fixture);
    }
    return fixture;
  };

  const restore = (fixture) => {
    const desired = new Set(fixture.baseline.keys());
    removeExtra(fixture.dir, desired, fixture.directories, fixture.dir);
    for (const [relative, content] of fixture.baseline) {
      const target = path.join(fixture.dir, ...relative.split('/'));
      if (sameBytes(target, content)) continue;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
  };

  return {
    repoOf(declaration = APP, mutate, options) {
      const fixture = fixtureFor(declaration, options);
      if (!fixture.fresh) restore(fixture);
      fixture.fresh = false;
      if (mutate) mutate(fixture.dir);
      execFileSync('git', ['add', '-A', '-f', '--', '.', ':!node_modules'], { cwd: fixture.dir, stdio: 'ignore' });
      return fixture.dir;
    },

    checkRepo(options) {
      return checkHfsRepo({ root: catalogRoot, manifest, ...options });
    },

    cleanup() {
      for (const { dir } of repos.values()) fs.rmSync(dir, { recursive: true, force: true });
      fs.rmSync(catalogRoot, { recursive: true, force: true });
      repos.clear();
    },
  };
}
