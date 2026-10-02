#!/usr/bin/env node
// examples-ci.mjs - the example apps of this repository in its own CI, derived, never listed by hand.
//
// GitHub runs only the repository-root workflows and Codecov reads one root config, so an example app's own ci.yml and
// codecov.yml (the full app-repository form `hfs sync` renders) never run here. Lite apps intentionally carry no test or
// coverage world, so they run the build/lint gates but are absent from Codecov and every test step. The root carries:
//   .github/workflows/examples.yml  one workflow whose job matrix is THIS module's `--matrix` output (every examples/*
//                                   folder whose hfs.json is of kind app): install, typecheck, lint, unit with coverage,
//                                   the Codecov upload under the app's flag, the front-end build and the Sonar gate on
//                                   push and pull_request; integration and e2e on workflow_dispatch only (owner ruling).
//   codecov.yml                     one flag per example app, rendered here from the same coverage scope as the app's own
//                                   codecov.yml and, as its complement, sonar.coverage.exclusions (packages/hfs/sync/index.mjs coverageScope over
//                                   the jest preset's COVERAGE_SOURCES), each held at 100 on the project and the patch.
//
//   node scripts/checks/check-examples-ci.mjs            check: the workflow derives its matrix from --matrix, no other root
//                                                  workflow runs an example on its own, codecov.yml is its render (exit 1)
//   node scripts/checks/check-examples-ci.mjs --matrix   the matrix as JSON (["ecommerce-app"]) for $GITHUB_OUTPUT
//   node scripts/checks/check-examples-ci.mjs --images   every deployable image as JSON ([{app, name, file}]); lite owns back-end images only
//   node scripts/checks/check-examples-ci.mjs --write    rewrite codecov.yml and each example's own codecov.yml and sonar-project.properties from the render
//
// The quality files of each example (codecov.yml, sonar-project.properties) are rendered here from the SOURCE jest preset of this repository, the
// one the root codecov.yml flag already reads, so the root flag, the app's coverage paths and sonar.coverage.exclusions are one scope. The build
// of every image of every example (never a push) is the `images` job, whose matrix is the --images output.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { coverageScope, renderTargets } from '../../packages/hfs/sync/index.mjs';
import { declaredSonarKeys, repositoryName, DECLARATION } from '../../packages/hfs/sync/sonar-key.mjs';
import { dockerfilePath } from '../hfs/rules/docker.mjs';
import { isMain } from '../lib/is-main.mjs';
import { readTextFile } from '../lib/read-text.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const WORKFLOW = '.github/workflows/examples.yml';
export const CODECOV = 'codecov.yml';
/** The step that prints the matrix, and the expression every matrix job reads it through. */
const MATRIX_COMMAND = 'node scripts/checks/check-examples-ci.mjs --matrix';
const MATRIX_JOB = 'apps';
const MATRIX_EXPRESSION = `\${{ fromJSON(needs.${MATRIX_JOB}.outputs.apps) }}`;

/** The example apps: every examples/<name>/hfs.json of kind app, sorted by name. */
export function exampleApps(root = ROOT) {
  const dir = path.join(root, 'examples');
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()); } catch { return []; }
  return entries.filter((entry) => {
    try { return JSON.parse(fs.readFileSync(path.join(dir, entry.name, 'hfs.json'), 'utf8'))?.kind === 'app'; } catch { return false; }
  }).map((entry) => entry.name).sort();
}

/** Whether an example declares the full edition whose generated contract includes tests and coverage. */
export function exampleHasTests(app, root = ROOT) {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'examples', app, 'hfs.json'), 'utf8')).edition !== 'lite'; }
  catch { return false; }
}

/** Example apps that own the test/coverage contract; lite apps are deliberately absent. */
export const coverageExampleApps = (root = ROOT) => exampleApps(root).filter(app => exampleHasTests(app, root));

/** The coverage scope of one example app from the repository root: the app scope of hfs sync under examples/<app>/. */
export function appCoverageScope(app, root = ROOT) {
  const preset = createRequire(import.meta.url)(path.join(root, 'packages', 'jest-preset', 'index.cjs'));
  return coverageScope({ coverageSources: [...preset.COVERAGE_SOURCES] }).map((glob) => `examples/${app}/${glob}`);
}

/** The Sonar project key an example declares in its stack declaration, or its project name. */
function sonarKeyOf(appRoot, project) {
  try {
    const keys = declaredSonarKeys(parseYaml(fs.readFileSync(path.join(appRoot, DECLARATION), 'utf8')), repositoryName(appRoot));
    if (keys.length === 1) return keys[0];
  } catch { /* no declaration: the project name stands in */ }
  return project;
}

/** The quality files of an example rendered from the source preset: [{ path, content, mode, hash }] (codecov.yml, sonar-project.properties). */
export function appQualityTargets(app, root = ROOT) {
  const appRoot = path.join(root, 'examples', app);
  const hfs = JSON.parse(fs.readFileSync(path.join(appRoot, 'hfs.json'), 'utf8'));
  const preset = createRequire(import.meta.url)(path.join(root, 'packages', 'jest-preset', 'index.cjs'));
  const presets = { sonarExclusions: preset.sonarExclusions(), coverageSources: [...preset.COVERAGE_SOURCES] };
  return renderTargets(hfs, presets, { sonarKey: sonarKeyOf(appRoot, hfs.project) }).filter((target) => APP_QUALITY_FILES.includes(target.path));
}
export const APP_QUALITY_FILES = Object.freeze(['codecov.yml', 'sonar-project.properties']);

/** Every deployable image of every example app, from its hfs.json: full owns be+fe; lite owns be only. */
export function exampleImages(root = ROOT) {
  return exampleApps(root).flatMap((app) => {
    const declaration = JSON.parse(fs.readFileSync(path.join(root, 'examples', app, 'hfs.json'), 'utf8'));
    const sides = declaration.sides ?? {};
    const deployableSides = declaration.edition === 'lite' ? ['be'] : ['be', 'fe'];
    return deployableSides.flatMap((side) => (sides[side]?.apps ?? []).map((entry) => ({ app, name: entry.name, file: dockerfilePath(side, entry.name) })));
  });
}
const IMAGES_COMMAND = 'node scripts/checks/check-examples-ci.mjs --images';
const IMAGES_JOB = 'images';

/** The root codecov.yml: one flag per example app over its coverage scope, project and patch at 100 per flag. */
export function renderCodecov(root = ROOT) {
  const flags = coverageExampleApps(root).map((app) => [`    - name: ${app}`, '      paths:', ...appCoverageScope(app, root).map((glob) => `        - ${JSON.stringify(glob)}`)].join('\n'));
  return `# Generated by scripts/checks/check-examples-ci.mjs --write. Do not edit: npm run check fails on any difference.
# One flag per full-edition example app (lite has no tests or coverage), uploaded by .github/workflows/examples.yml. The paths are the
# app's coverage scope (its services only), the same scope hfs sync renders into the app's own codecov.yml (and its complement into sonar.coverage.exclusions);
# every flag is held at 100 on the project and on the patch.
codecov:
  require_ci_to_pass: true
coverage:
  status:
    project:
      default:
        target: 100%
        threshold: 0%
    patch:
      default:
        target: 100%
        threshold: 0%
flag_management:
  default_rules:
    carryforward: false
    statuses:
      - type: project
        target: 100%
        threshold: 0%
      - type: patch
        target: 100%
        threshold: 0%
  individual_flags:
${flags.join('\n')}
`;
}

const read = readTextFile;

/** Every finding of the examples CI contract at `root`: [{code, path, message}]. */
export function checkExamplesCi(root = ROOT) {
  const findings = [];
  const add = (code, at, message) => findings.push({ code, path: at, message });
  const apps = exampleApps(root);
  // The workflow: a job `apps` prints the matrix with MATRIX_COMMAND, and every job with a matrix reads it from that output.
  const text = read(root, WORKFLOW);
  let doc = null;
  if (text === null) add('EXAMPLES_CI_WORKFLOW_MISSING', WORKFLOW, 'the root workflow that runs every example app is missing');
  else { try { doc = parseYaml(text); } catch (error) { add('EXAMPLES_CI_WORKFLOW_INVALID', WORKFLOW, error.message); } }
  if (doc) {
    const jobs = doc.jobs ?? {};
    const lister = jobs[MATRIX_JOB];
    if (!lister || !(lister.steps ?? []).some((step) => String(step.run ?? '').includes(MATRIX_COMMAND)) || !String(lister.outputs?.apps ?? '').includes('steps.'))
      add('EXAMPLES_CI_MATRIX_NOT_DERIVED', WORKFLOW, `job ${MATRIX_JOB} must run \`${MATRIX_COMMAND}\` and expose its output as outputs.apps`);
    const matrixJobs = Object.entries(jobs).filter(([id, job]) => id !== IMAGES_JOB && job?.strategy?.matrix);
    if (!matrixJobs.length) add('EXAMPLES_CI_MATRIX_NOT_DERIVED', WORKFLOW, 'no job runs the example apps as a matrix');
    for (const [id, job] of matrixJobs) {
      if (String(job.strategy.matrix.app ?? '') !== MATRIX_EXPRESSION || Object.keys(job.strategy.matrix).length !== 1)
        add('EXAMPLES_CI_MATRIX_NOT_DERIVED', `${WORKFLOW}#jobs.${id}`, `the matrix must be exactly app: ${MATRIX_EXPRESSION} (never a hand-written list)`);
      if (![job.needs].flat().includes(MATRIX_JOB)) add('EXAMPLES_CI_MATRIX_NOT_DERIVED', `${WORKFLOW}#jobs.${id}`, `needs must include ${MATRIX_JOB}`);
    }
    // Owner ruling: integration, e2e and contract (the docker-stack layers) run on workflow_dispatch only.
    for (const [id, job] of Object.entries(jobs)) for (const step of job?.steps ?? []) {
      if (/\btest:(integration|e2e|contract)\b/.test(String(step.run ?? '')) && !/github\.event_name\s*==\s*'workflow_dispatch'/.test(String(step.if ?? '')))
        add('EXAMPLES_CI_STACK_LAYER_AUTOMATIC', `${WORKFLOW}#jobs.${id}`, `the step "${step.name ?? step.run}" starts the docker stack and must run on workflow_dispatch only (if: github.event_name == 'workflow_dispatch' ...)`);
    }
    if (!doc.on?.workflow_dispatch) add('EXAMPLES_CI_NO_MANUAL_TRIGGER', WORKFLOW, 'the workflow needs a workflow_dispatch trigger for the manual integration and e2e layers');
    for (const app of apps) if (new RegExp(`examples/${app}\\b`).test(text)) add('EXAMPLES_CI_HARDCODED', WORKFLOW, `the workflow names examples/${app}: every app is reached through the matrix only`);
  }
  // No other root workflow runs an example app by itself (the folded per-example workflows are gone, and stay gone).
  const workflows = path.join(root, '.github', 'workflows');
  let files = [];
  try { files = fs.readdirSync(workflows).filter((name) => /\.ya?ml$/.test(name)); } catch { /* no workflows */ }
  for (const name of files) {
    const rel = `.github/workflows/${name}`;
    if (rel === WORKFLOW) continue;
    const body = read(root, rel) ?? '';
    for (const app of apps) if (new RegExp(`examples/${app}\\b`).test(body)) add('EXAMPLES_CI_STRAY_WORKFLOW', rel, `runs examples/${app} outside ${WORKFLOW}; fold it into the examples matrix`);
  }
  // The images job: its matrix is the --images output, it builds and never pushes.
  if (doc) {
    const images = doc.jobs?.[IMAGES_JOB];
    const steps = images?.steps ?? [];
    if (!images || !steps.some((step) => String(step.run ?? '').includes(IMAGES_COMMAND)) && !(doc.jobs?.[MATRIX_JOB]?.steps ?? []).some((step) => String(step.run ?? '').includes(IMAGES_COMMAND)))
      add('EXAMPLES_CI_IMAGES_NOT_DERIVED', WORKFLOW, `a job ${IMAGES_JOB} must build every image of every example from the output of \`${IMAGES_COMMAND}\` (never a hand-written list)`);
    else if (!String(images.strategy?.matrix?.include ?? '').includes('fromJSON(needs.') || steps.some((step) => String(step.with?.push) === 'true' || /docker push|--push/.test(String(step.run ?? ''))))
      add('EXAMPLES_CI_IMAGES_NOT_DERIVED', `${WORKFLOW}#jobs.${IMAGES_JOB}`, 'the images matrix must be include: fromJSON of the derived output, and the job never pushes an image');
  }
  // The examples' own quality files are the render from the source preset.
  for (const app of apps) for (const target of appQualityTargets(app, root)) {
    const file = `examples/${app}/${target.path}`;
    const have = read(root, file);
    if (have === null || have.replace(/\r\n/g, '\n') !== target.content) add('EXAMPLES_CI_APP_QUALITY_DRIFT', file, `${file} differs from its render from the source jest preset: run node scripts/checks/check-examples-ci.mjs --write`);
  }
  // codecov.yml is the render: one flag per app, paths from the coverage scope.
  const codecov = read(root, CODECOV);
  if (codecov === null) add('EXAMPLES_CI_CODECOV_MISSING', CODECOV, 'the root codecov.yml is missing: run node scripts/checks/check-examples-ci.mjs --write');
  else if (codecov.replace(/\r\n/g, '\n') !== renderCodecov(root)) add('EXAMPLES_CI_CODECOV_DRIFT', CODECOV, 'codecov.yml differs from its render (a flag per example app over its coverage scope): run node scripts/checks/check-examples-ci.mjs --write');
  return { apps, findings };
}

export function examplesCiMain(argv = [], { root = ROOT, out = (s) => process.stdout.write(s) } = {}) {
  if (argv.includes('--matrix')) { out(`${JSON.stringify(exampleApps(root))}\n`); return 0; }
  if (argv.includes('--images')) { out(`${JSON.stringify(exampleImages(root))}\n`); return 0; }
  if (argv.includes('--write')) {
    fs.writeFileSync(path.join(root, CODECOV), renderCodecov(root));
    for (const app of exampleApps(root)) for (const target of appQualityTargets(app, root)) fs.writeFileSync(path.join(root, 'examples', app, target.path), target.content);
    out(`examples-ci: wrote ${CODECOV} (${coverageExampleApps(root).length} flags) and each example's edition-matched quality files\n`);
    return 0;
  }
  const { apps, findings } = checkExamplesCi(root);
  for (const finding of findings) out(`${finding.code} ${finding.path}: ${finding.message}\n`);
  out(findings.length ? `examples-ci: ${findings.length} finding(s)\n` : `OK: ${apps.length} example app(s) (${apps.join(', ')}) run in ${WORKFLOW}; ${coverageExampleApps(root).length} full app(s) have flags in ${CODECOV}\n`);
  return findings.length ? 1 : 0;
}

if (isMain(import.meta.url)) process.exitCode = examplesCiMain(process.argv.slice(2));
