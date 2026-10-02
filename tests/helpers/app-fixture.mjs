import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';

export const APP_FIXTURE_ROOT = path.resolve(import.meta.dirname, '..', 'fixtures', 'app');

/** Read one authored record from the frozen, product-neutral fixture app. */
export const readAppFixtureYaml = (relative) =>
  parseYaml(fs.readFileSync(path.join(APP_FIXTURE_ROOT, ...relative.split('/')), 'utf8'));

/** Build one writable copy of the frozen fixture app and register its cleanup with the spec. */
export function buildAppFixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-app-fixture-'));
  const app = path.join(base, 'app');
  fs.cpSync(APP_FIXTURE_ROOT, app, { recursive: true });
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return app;
}
