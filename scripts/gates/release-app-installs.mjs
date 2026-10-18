#!/usr/bin/env node
// release-app-installs.mjs: the release verification of a scaffolded app against FRESH registry installs.
// It runs the published `starci app scaffold release-app` (npx, canon-pins versions) into a temp dir, installs that app from the npm registry (`npm ci` on the
// scaffold's own lockfile, or `npm install` when it has none), and runs e2e/hfs-scaffold-app.spec.mjs with
// STARCI_APP_INSTALLS = that install and STARCI_REQUIRE_APP_INSTALLS=1. A missing install then fails the spec
// instead of skipping it, so the lint, typecheck and api boot proofs can never pass silently.
//
//   starci release app-installs          scaffold, install, run the spec; exit = the spec's exit
//   starci release app-installs --keep   keep the temp app and print where it is
//   starci release app-installs --source the same proof BEFORE a publish: the app is scaffolded by this checkout's hfs and its @starci scope is
//                                        installed from the checkout's PACKED tarballs (e2e/helpers/source-canon-registry.mjs); every other
//                                        package still comes from the public registry
//
// CI (.github/workflows/ci.yml) and the release checklist run the published form; it needs the network and the published
// @starci packages the scaffold pins. The source form runs inside `starci release scaffold-e2e` (e2e/hfs-scaffold-app-installs.e2e.spec.mjs),
// so the runtime verify and the release cut prove the spec against the very bytes they are about to publish (alpha.21: a spec that read a
// CI job id the split jobs no longer had was first run by the published form, on CI, after the cut).
import fs from 'node:fs';
import path from 'node:path';
import { runNpm } from '../api/npm/run-npm.mjs';
import { runNpx } from '../api/npm/run-npx.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { nextBuildEnv } from './build-env.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { scaffoldInvocation } from './release-proof.mjs';
import { main as hfsMain } from '../../packages/hfs/src/main.mjs';
import { startSourceCanonRegistry } from '../../e2e/helpers/source-canon-registry.mjs';
import { createRequire } from 'node:module';
import { prepareE2e } from './scaffold-e2e.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const keep = process.argv.includes('--keep');
const source = process.argv.includes('--source');
const unknown = process.argv.slice(2).filter((arg) => !['--keep', '--source'].includes(arg));
if (unknown.length) {
  console.error(`usage: starci release app-installs [--keep] [--source] (unknown: ${unknown.join(' ')})`);
  process.exit(2);
}
// The app is made UNDER the checkout (its scratch folder ex-testing/, never committed): the scaffold spec widens Turbopack's root to the checkout, and an install elsewhere
// panics the fe build. It is removed link-safe afterwards.
const scratch = path.join(root, 'ex-testing');
fs.mkdirSync(scratch, { recursive: true });
const into = fs.mkdtempSync(path.join(scratch, 'release-app-'));
const app = path.join(into, 'release-app');
/** A failed step: the run stops, the finally block still closes the registry and removes the app, and the exit is the step's. */
class StepFailed extends Error {
  constructor(status) { super(`step exit ${status}`); this.status = status; }
}
const step = (label, run, args, opts = {}) => {
  console.log(`release-app-installs: ${label}`);
  const r = run(args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) {
    console.error(`release-app-installs: FAILED at ${label} (exit ${r.status ?? r.error?.message})`);
    throw new StepFailed(r.status || 1);
  }
};

/** The presets the scaffold loads from the installed jest preset, here this checkout's packages/jest-preset (the copy the packed tarball carries). */
const sourcePresets = () => ({ sonarExclusions: createRequire(import.meta.url)('../../packages/jest-preset/index.cjs').sonarExclusions() });

/** Scaffold with this checkout's hfs and lock the app against the packed @starci tarballs; the install then reads the same registry for the @starci scope. */
async function sourceScaffold(registry) {
  console.log('release-app-installs: starci app scaffold release-app (this checkout, @starci from the packed tarballs)');
  let out = '';
  const code = await hfsMain(['scaffold', 'release-app', '--into', into], { cwd: into, stdout: (text) => { out += text; }, stderr: (text) => { out += text; }, lock: registry.lock, presets: sourcePresets() });
  process.stdout.write(out);
  if (code !== 0) {
    console.error(`release-app-installs: FAILED at the source scaffold (exit ${code})`);
    throw new StepFailed(code || 1);
  }
}

let exit = 1;
let registry = null;
try {
  if (source) {
    // The packed tarballs carry built output (the grammar and heroicons dist, test-world): prepared exactly as release scaffold-e2e prepares it.
    const prepared = prepareE2e({ root });
    for (const line of prepared.lines) console.log(`release-app-installs: ${line}`);
    if (!prepared.ok) throw new StepFailed(1);
    registry = await startSourceCanonRegistry({ root });
    await sourceScaffold(registry);
  } else {
    // Scaffold with the PUBLISHED cli, the way a user does (npx -p @starci/cli -p @starci/jest-preset starci app scaffold), at the canon-pins
    // versions: this proves the registry packages, not the runtime's source copy.
    const pins = parseYaml(fs.readFileSync(path.join(root, 'knowledge/hfs/canon-pins.yaml'), 'utf8')).pins;
    step(`npx @starci/cli@${pins['@starci/cli'].version} app scaffold release-app`, runNpx, scaffoldInvocation(pins, into), { cwd: into });
  }
  const lock = fs.existsSync(path.join(app, 'package-lock.json'));
  const from = source ? 'packed @starci tarballs + registry' : 'registry';
  // The source form points the @starci scope at the packed tarballs for the one install (an app-root .npmrc, removed after).
  const npmrc = path.join(app, '.npmrc');
  if (registry) fs.writeFileSync(npmrc, `@starci:registry=${registry.origin}/\n`);
  try {
    step(lock ? `npm ci (${from})` : `npm install (${from})`, runNpm, [lock ? 'ci' : 'install', '--no-audit', '--no-fund'], { cwd: app });
  } finally {
    if (registry) fs.rmSync(npmrc, { force: true });
  }
  const env = { ...nextBuildEnv(), STARCI_APP_INSTALLS: path.join(app, 'node_modules'), STARCI_REQUIRE_APP_INSTALLS: '1' };
  const r = runNode(['--test', path.join(root, 'e2e/hfs-scaffold-app.spec.mjs')], { cwd: root, env, stdio: 'inherit' });
  exit = r.status ?? 1;
  const against = source ? 'fresh installs of the packed @starci tarballs' : 'fresh registry installs';
  console.log(exit === 0 ? `release-app-installs: OK (scaffold lint, typecheck and api boot ran against ${against})` : `release-app-installs: FAILED (spec exit ${exit})`);
} catch (error) {
  if (!(error instanceof StepFailed)) throw error;
  exit = error.status;
} finally {
  if (registry) await registry.close();
  if (keep) console.log(`release-app-installs: kept ${app}`);
  else {
    // The fresh install is real npm output (links included): removed without ever following a link.
    const removed = safeRemove(into, { hold: artifactHoldReason });
    if (!removed.ok) {
      const errors = removed.errors.map((e) => `${e.code} ${e.path}`).join('; ');
      console.log(`release-app-installs: could not remove ${into}: ${errors}`);
    }
    // The scratch folder itself goes when it is left empty: git tracks no empty directory, and the runtime check refuses one (HFS_EMPTY_DIR).
    try { if (!fs.readdirSync(scratch).length) fs.rmdirSync(scratch); } catch { /* another run still holds it */ }
  }
}
process.exit(exit);
