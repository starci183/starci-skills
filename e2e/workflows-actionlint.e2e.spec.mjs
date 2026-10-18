// workflows-actionlint.e2e.spec.mjs - actionlint, the linter GitHub's own runs use, over every workflow a release puts on GitHub, BEFORE the cut: the rendered
// example workflows (examples/*/.github/workflows), the runtime's own (.github/workflows), and the workflows a fresh full and lite scaffold renders. It runs the
// very image the examples workflow runs (the digest-pinned docker:// action of .github/workflows/examples.yml, read from there, never restated) through the local
// Docker daemon. alpha.22's first candidate run was red on actionlint alone: an if: expression held a nested ${{ matrix.side }}, which GitHub evaluates as
// always true; no local proof had run actionlint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { scaffoldApp } from '../packages/hfs/scaffold/app.mjs';
import { createRequire } from 'node:module';

const RUNTIME = path.resolve(import.meta.dirname, '..');
const jestPreset = createRequire(import.meta.url)('../packages/jest-preset/index.cjs');
const PRESETS = { sonarExclusions: jestPreset.sonarExclusions() };

/** The actionlint image of the examples workflow: `docker://<image>@sha256:<digest>`. */
function actionlintImage() {
  const text = fs.readFileSync(path.join(RUNTIME, '.github', 'workflows', 'examples.yml'), 'utf8');
  const match = /uses:\s*docker:\/\/(rhysd\/actionlint@sha256:[0-9a-f]{64})/.exec(text);
  assert.ok(match, '.github/workflows/examples.yml runs a digest-pinned rhysd/actionlint image');
  return match[1];
}

const workflowsUnder = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => /\.ya?ml$/.test(name)).map((name) => path.join(dir, name)) : []);

/** actionlint over `files` (absolute, all below `root`), the root mounted read-only at /repo. */
function actionlint(image, root, files) {
  const relative = files.map((file) => path.relative(root, file).split(path.sep).join('/'));
  const run = spawnSync('docker', ['run', '--rm', '-v', `${root}:/repo:ro`, '-w', '/repo', '--entrypoint', 'actionlint', image, '-shellcheck=', ...relative],
    { encoding: 'utf8', windowsHide: true, timeout: 600_000, maxBuffer: 64 * 1024 * 1024 });
  return { status: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? run.error.message : ''}` };
}

/** The installed SQL parser extracts one Bun-built native binding at the isolated temp root, and a jest run leaves its default caches (`jest`, `jest_rt`)
 * there: process infrastructure of the commands this spec runs, not fixtures; removed before the leak guard, as the lite scaffold spec does. */
function removeToolTemp() {
  const isolated = process.env.STARCI_TEST_TEMP_DIR;
  if (!isolated || !fs.existsSync(isolated)) return;
  for (const entry of fs.readdirSync(isolated).filter((name) => /^\.bun-[\w-]+\.node$/u.test(name) || name === 'jest' || name === 'jest_rt')) fs.rmSync(path.join(isolated, entry), { recursive: true, force: true });
}

const docker = spawnSync('docker', ['info'], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
const skip = docker.status === 0 ? false : 'docker is unavailable (scaffold-e2e requires it; a skip is red there)';

test('actionlint finds nothing in the example, runtime and freshly scaffolded workflows', { skip, timeout: 900_000 }, (t) => {
  t.after(removeToolTemp);
  const image = actionlintImage();
  const own = [
    ...fs.readdirSync(path.join(RUNTIME, 'examples'), { withFileTypes: true }).filter((entry) => entry.isDirectory())
      .flatMap((entry) => workflowsUnder(path.join(RUNTIME, 'examples', entry.name, '.github', 'workflows'))),
    ...workflowsUnder(path.join(RUNTIME, '.github', 'workflows')),
  ];
  assert.ok(own.length > 3, 'the example and runtime workflows are found');
  const checked = actionlint(image, RUNTIME, own);
  assert.equal(checked.status, 0, `actionlint over the example and runtime workflows:\n${checked.output}`);

  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'actionlint-scaffold-'));
  t.after(() => fs.rmSync(into, { recursive: true, force: true }));
  const scaffolded = ['full', 'lite'].flatMap((edition) => {
    const { root } = scaffoldApp({ name: `lint-${edition}`, into, edition, presets: PRESETS, lock: () => ({ ok: true }) });
    return workflowsUnder(path.join(root, '.github', 'workflows'));
  });
  assert.ok(scaffolded.some((file) => file.endsWith(`${path.sep}ci.yml`)), 'the scaffolds render ci.yml');
  const fresh = actionlint(image, into, scaffolded);
  assert.equal(fresh.status, 0, `actionlint over the freshly scaffolded workflows:\n${fresh.output}`);
});
