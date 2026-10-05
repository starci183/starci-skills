import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { canonContentDigest, installedFiles } from '../../scripts/gates/canon-digest.mjs';
import { PROFILES_FILE } from '../../scripts/gates/canon-pins.mjs';
import { loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { publishedCanons } from './canon-install-fixture.mjs';
import { runtimeInstalls } from './hfs-app-install.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

/** A hermetic installed canon exposing the same public config-factory API; tests can vary selectors without a production scope mirror. */
export function fakeLintCanon(cwd, { files = path.basename(cwd) === 'be' ? ['src/**/*.ts'] : ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}'], ignores = ['**/node_modules/**'] } = {}) {
  const side = path.basename(cwd), name = `@starci/eslint-canon-${side}`;
  const pkg = path.join(cwd, 'node_modules', name);
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name, type: 'module', exports: './index.mjs' }));
  fs.writeFileSync(path.join(pkg, 'index.mjs'), `export const loadHfs = () => ({});\nexport const starci${side === 'be' ? 'Be' : 'Fe'}Config = () => ${JSON.stringify([{ ignores }, { files }])};\n`);
}


/** A valid app declaration; the fixture reads the actual manifest major instead of restating it. */
export const lintFixtureDeclaration = (project) => ({ hfs: loadSlotManifest().major, kind: 'app', project,
  sides: { be: { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } });

/**
 * Copy only actual local package bytes matching the executable profile's version and content digest.
 * Before publication, current source canons may be newer; checkout-owned installs are judged by the same digest owner.
 * Missing or corrupt canonical bytes fail the fixture. This helper neither fetches packages nor rebinds a profile.
 */
export function installBoundLintCanons(app) {
  const profiles = Object.values(parseYaml(fs.readFileSync(path.join(ROOT, PROFILES_FILE), 'utf8')).profiles);
  const published = publishedCanons();
  const installs = runtimeInstalls({ root: ROOT, env: {}, required: profiles.map(({ canon }) => canon.package) });
  const selected = profiles.map(({ canon }) => {
    const local = published.find((entry) => entry.package === canon.package);
    const candidates = [...(local ? [{ source: local.source, files: local.files }] : []),
      ...installs.map((dir) => ({ source: path.join(dir, ...canon.package.split('/')), files: null }))];
    const failures = [];
    for (const entry of candidates) {
      try {
        const manifest = JSON.parse(fs.readFileSync(path.join(entry.source, 'package.json'), 'utf8'));
        if (manifest.name !== canon.package || manifest.version !== canon.version) continue;
        const files = entry.files ?? installedFiles(entry.source);
        const digest = canonContentDigest(entry.source, canon.contentDigest, files);
        if (digest.value !== canon.contentDigest.value || digest.files !== canon.contentDigest.files) {
          failures.push(entry.source + ': content digest differs'); continue;
        }
        return { ...entry, files, canon };
      } catch (error) { if (error.code !== 'ENOENT') failures.push(entry.source + ': ' + error.message); }
    }
    throw new Error('No local canonical fixture install for ' + canon.package + '@' + canon.version
      + (failures.length ? ': ' + failures.join('; ') : '; install the profile-bound package in a checkout-owned example'));
  });
  const out = {};
  for (const { source, files, canon } of selected) {
    const target = path.join(app, 'node_modules', ...canon.package.split('/'));
    if (fs.existsSync(target)) throw new Error('The canonical fixture target must be absent: ' + target);
    for (const file of files) {
      fs.mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
      fs.copyFileSync(path.join(source, file), path.join(target, file));
    }
    const copied = canonContentDigest(target, canon.contentDigest, installedFiles(target));
    if (copied.value !== canon.contentDigest.value || copied.files !== canon.contentDigest.files)
      throw new Error('The copied canonical fixture bytes changed: ' + canon.package);
    out[canon.package] = target;
  }
  return out;
}
