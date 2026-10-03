import fs from 'node:fs';
import path from 'node:path';
import { loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { cleanup, gitAdd, installTypeScript, writeCleanRepo } from './hfs-cli-fixture.mjs';

const fixtures = new Map();

const walk = (root, relative = '') => {
  const files = [];
  const dir = path.join(root, ...relative.split('/').filter(Boolean));
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!relative && (entry.name === '.git' || entry.name === 'node_modules')) continue;
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...walk(root, child));
    else files.push(child);
  }
  return files.sort();
};

const snapshotOf = (dir) => new Map(dockerRuleFixtureFiles(dir).map((relative) => [relative, fs.readFileSync(path.join(dir, ...relative.split('/')))]));

const restore = ({ dir, snapshot }) => {
  for (const relative of dockerRuleFixtureFiles(dir)) {
    if (!snapshot.has(relative)) fs.rmSync(path.join(dir, ...relative.split('/')), { force: true });
  }
  for (const [relative, expected] of snapshot) {
    const target = path.join(dir, ...relative.split('/'));
    let actual = null;
    try { actual = fs.readFileSync(target); } catch {}
    if (actual?.equals(expected)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, expected);
  }
  return dir;
};

export const DOCKER_RULES_MANIFEST = loadSlotManifest();

export function dockerRuleFixtureFiles(dir) {
  return walk(dir);
}

export function dockerRulesRepoOf(declaration, mutate) {
  const key = JSON.stringify(declaration);
  let fixture = fixtures.get(key);
  if (!fixture) {
    const dir = gitAdd(installTypeScript(writeCleanRepo(declaration)));
    fixture = { dir, snapshot: snapshotOf(dir) };
    fixtures.set(key, fixture);
  }
  const dir = restore(fixture);
  if (mutate) mutate(dir);
  return dir;
}

export function cleanupDockerRuleFixtures() {
  cleanup([...fixtures.values()].map(({ dir }) => dir));
  fixtures.clear();
}
