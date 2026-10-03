#!/usr/bin/env node
// release-app-installs.mjs: the release verification of a scaffolded app against FRESH registry installs.
// It runs the published `starci app scaffold release-app` (npx, canon-pins versions) into a temp dir, installs that app from the npm registry (`npm ci` on the
// scaffold's own lockfile, or `npm install` when it has none), and runs tests/packages-hfs/hfs-scaffold-app.spec.mjs with
// STARCI_APP_INSTALLS = that install and STARCI_REQUIRE_APP_INSTALLS=1. A missing install then fails the spec
// instead of skipping it, so the lint, typecheck and api boot proofs can never pass silently.
//
//   starci release app-installs          scaffold, install, run the spec; exit = the spec's exit
//   starci release app-installs --keep   keep the temp app and print where it is
//
// CI (.github/workflows/ci.yml) and the release checklist both run it. It needs the network and the published
// @starci packages the scaffold pins.
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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const keep = process.argv.includes('--keep');
// The app is made UNDER the checkout (its scratch folder ex-testing/, never committed): the scaffold spec widens Turbopack's root to the checkout, and an install elsewhere
// panics the fe build. It is removed link-safe afterwards.
const scratch = path.join(root, 'ex-testing');
fs.mkdirSync(scratch, { recursive: true });
const into = fs.mkdtempSync(path.join(scratch, 'release-app-'));
const app = path.join(into, 'release-app');
const step = (label, run, args, opts = {}) => {
  console.log(`release-app-installs: ${label}`);
  const r = run(args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) {
    console.error(`release-app-installs: FAILED at ${label} (exit ${r.status ?? r.error?.message})`);
    process.exit(r.status || 1);
  }
};

let exit = 1;
try {
  // Scaffold with the PUBLISHED cli, the way a user does (npx -p @starci/cli -p @starci/jest-preset starci app scaffold), at the canon-pins
  // versions: this proves the registry packages, not the runtime's source copy.
  const pins = parseYaml(fs.readFileSync(path.join(root, 'knowledge/hfs/canon-pins.yaml'), 'utf8')).pins;
  step(`npx @starci/cli@${pins['@starci/cli'].version} app scaffold release-app`, runNpx, scaffoldInvocation(pins, into), { cwd: into });
  const lock = fs.existsSync(path.join(app, 'package-lock.json'));
  step(lock ? 'npm ci (registry)' : 'npm install (registry)', runNpm, [lock ? 'ci' : 'install', '--no-audit', '--no-fund'], { cwd: app });
  const env = { ...nextBuildEnv(), STARCI_APP_INSTALLS: path.join(app, 'node_modules'), STARCI_REQUIRE_APP_INSTALLS: '1' };
  const r = runNode(['--test', path.join(root, 'tests/packages-hfs/hfs-scaffold-app.spec.mjs')], { cwd: root, env, stdio: 'inherit' });
  exit = r.status ?? 1;
  console.log(exit === 0 ? 'release-app-installs: OK (scaffold lint, typecheck and api boot ran against fresh registry installs)' : `release-app-installs: FAILED (spec exit ${exit})`);
} finally {
  if (keep) console.log(`release-app-installs: kept ${app}`);
  else {
    // The fresh install is real npm output (links included): removed without ever following a link.
    const removed = safeRemove(into, { hold: artifactHoldReason });
    if (!removed.ok) console.log(`release-app-installs: could not remove ${into}: ${removed.errors.map((e) => `${e.code} ${e.path}`).join('; ')}`);
  }
}
process.exit(exit);
