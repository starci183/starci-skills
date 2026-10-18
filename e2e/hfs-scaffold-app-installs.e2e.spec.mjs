// hfs-scaffold-app-installs.e2e.spec.mjs - the registry-install proof of a scaffolded app, BEFORE the publish: `starci release app-installs --source`
// scaffolds the app with this checkout's hfs, installs it fresh with the @starci scope from the checkout's PACKED tarballs (every other package from
// the public registry) and runs e2e/hfs-scaffold-app.spec.mjs over that install with STARCI_REQUIRE_APP_INSTALLS=1, so no proof of it may skip.
// CI runs the same spec over the PUBLISHED packages (`starci release app-installs`); this file puts it inside `starci release scaffold-e2e`, the
// proof the runtime verify and the release cut run, so a defect of the spec or of the packages it installs is red before the cut and never first
// on CI after it (alpha.21: the spec still read the CI job `ci` the rendered workflow had split into fast, test, build and sonar).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runNode } from '../scripts/api/node/run-node.mjs';

const RUNTIME = path.resolve(import.meta.dirname, '..');
const tail = (text) => String(text ?? '').split(/\r?\n/).slice(-40).join('\n');

/** The installed SQL parser extracts one Bun-built native binding at the isolated temp root, and a jest run leaves its default caches (`jest`, `jest_rt`)
 * there: process infrastructure of the commands this spec runs, not fixtures; removed before the leak guard, as the lite scaffold spec does. */
function removeToolTemp() {
  const isolated = process.env.STARCI_TEST_TEMP_DIR;
  if (!isolated || !fs.existsSync(isolated)) return;
  for (const entry of fs.readdirSync(isolated).filter((name) => /^\.bun-[\w-]+\.node$/u.test(name) || name === 'jest' || name === 'jest_rt')) fs.rmSync(path.join(isolated, entry), { recursive: true, force: true });
}

test('the scaffolded app passes the registry-install proof against fresh installs of the packed @starci tarballs, no proof skipped', { timeout: 2_400_000 }, (t) => {
  t.after(removeToolTemp);
  const run = runNode([path.join(RUNTIME, 'scripts', 'gates', 'release-app-installs.mjs'), '--source'], { cwd: RUNTIME, timeout: 2_400_000, maxBuffer: 512 * 1024 * 1024 });
  const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  assert.equal(run.status, 0, `release app-installs --source exit ${run.status ?? run.error?.message}:\n${tail(output)}`);
  assert.match(output, /release-app-installs: OK \(scaffold lint, typecheck and api boot ran against fresh installs of the packed @starci tarballs\)/);
  assert.doesNotMatch(output, /\bSKIPPED:|# SKIP/, 'every proof of the scaffold spec ran');
  const summary = /^# fail (\d+)$/m.exec(output) ?? /^ℹ fail (\d+)$/m.exec(output);
  assert.ok(summary && summary[1] === '0', `the scaffold spec reported no failure:\n${tail(output)}`);
});
