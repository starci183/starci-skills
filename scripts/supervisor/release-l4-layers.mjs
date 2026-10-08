// release-l4-layers.mjs - which rows of the L4 example plan an app can have, judged from the files the app holds.
// A full app scaffolds the scripts of every test layer and the tests tsconfig, but a layer exists only once the app writes a spec file in it
// (be/src/tests/<layer>/**/*.<layer>-spec.ts). A row for a layer with no spec file would demand what nothing produced ("No tests found",
// "No inputs were found in config file"), so the plan leaves it out and names it in `notPlanned` with the reason; a layer that holds a spec
// file always has its row, and a row whose script the app lacks stays `absent` and fails.
import fs from 'node:fs';
import path from 'node:path';
import { nextBuildEnv } from '../gates/build-env.mjs';

/** The test layers a full app may hold, with the suffix of their spec files. */
export const TEST_LAYERS = Object.freeze(['contract', 'integration', 'e2e']);

const hasFile = (dir, accept) => {
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir, { withFileTypes: true }).some((entry) => (entry.isDirectory() ? hasFile(path.join(dir, entry.name), accept) : accept(entry.name)));
};

/** What the app holds under be/src/tests: {sources, contract, integration, e2e}, each true when at least one such file exists. Reads the checkout. */
export function testLayersOf(appDir) {
  const tests = path.join(appDir, 'be', 'src', 'tests');
  const layers = Object.fromEntries(TEST_LAYERS.map((layer) => [layer, hasFile(path.join(tests, layer), (name) => name.endsWith(`.${layer}-spec.ts`))]));
  return { sources: hasFile(tests, (name) => name.endsWith('.ts')), ...layers };
}

/** The scripts of a full app that have nothing to run, [{script, why}], from the layers it holds; none when `layers` is absent. Pure. */
export function idleScripts(layers) {
  if (!layers) return [];
  const idle = TEST_LAYERS.filter((layer) => !layers[layer]).map((layer) => ({ script: `test:${layer}`, why: `be/src/tests/${layer} holds no ${layer}-spec.ts file` }));
  return layers.sources ? idle : [{ script: 'typecheck:tests', why: 'be/src/tests holds no TypeScript file' }, ...idle];
}

/** The environment of one plan step over `base`: a step that builds a Next app gets the SWC cache and no telemetry (the one decision of build-env.mjs), every step its own `env`. */
export const stepEnv = (step, base = process.env) => (step.nextBuild ? nextBuildEnv({ ...base, ...step.env }) : { ...base, ...step.env });
