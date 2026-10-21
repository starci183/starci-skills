// ci-standard.mjs - R301 CI_STANDARD: the one StarCi CI standard (knowledge/hfs/ci-standard.yaml, OWNER RULING ci-standard 2026-10-18: ".claude defines ONE standard CI
// ruleset, its own CI and the examples follow it, and apps inherit it"). This file checks the items the standard marks `check: ci-standard`:
//   job-shape              the managed ci.yml holds exactly the edition's jobs; the unit run is in `test`, the proof and the Codecov upload in `coverage` (the one OIDC job)
//   full-history-base-ref  every actions/checkout fetches the full history; a job that lints writes STARCI_BASE_REF before it lints
//   heap-per-step          every heavy step (heap.steps) declares NODE_OPTIONS --max-old-space-size >= heap.minMiB on the step
//   sonar-lint-per-side    a lint with --sonar names --side
//   optional-providers     an optional (continue-on-error) Codecov or Sonar step follows its availability probe in the same job
//   test-sharding          the test job is a shard matrix; each shard runs --shard=i/N without the per-file threshold; the coverage job merges, then proves
//   lint-parallel          the lint job is a matrix over side [be, fe]
//   cache-saved-always     no cache keyed by the commit sha; actions/cache/save runs under if: always()
//   timeouts               every job declares timeout-minutes
//   sha-pinned-actions     every remote `uses:` names a 40-hex commit sha (docker:// a sha256 digest; ./ local actions allowed)
// `ciStandardFindings({doc, file, scope})` is the pure core: scope `app-ci` (an app's managed .github/workflows/ci.yml: the example apps and every app through the
// app check) or `runtime` (the runtime repository's own workflows, scripts/hfs/runtime-rules/runtime-ci-standard.mjs), each checking the items whose `covers` names it.
import fs from 'node:fs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { parseWorkflow } from '../runtime-rules/workflow-source.mjs';
import { found } from './read.mjs';
import { appWorkflowFindings } from './app-workflow-findings.mjs';
import { isPlainObject as record } from '../../../engine/plain-object.mjs';
import { byCodeUnit } from '../../lib/list.mjs';

export const CI_STANDARD = 'CI_STANDARD';
const STANDARD_FILE = new URL('../../../knowledge/hfs/ci-standard.yaml', import.meta.url);
const APP_CI = '.github/workflows/ci.yml';
const SHA_PIN = /@[0-9a-f]{40}$/;
const DIGEST_PIN = /@sha256:[0-9a-f]{64}$/;

let cached = null;
/** The standard (knowledge/hfs/ci-standard.yaml), read once. */
/** The coverage proof step: the coverage judgement over the merged lcov (`starci app coverage verify`), never the whole app check. */
const COVERAGE_PROOF = /app coverage verify\b/;

function ciStandard() {
  if (!cached) {
    const doc = parseYaml(fs.readFileSync(STANDARD_FILE, 'utf8'));
    if (doc?.schema !== 'starci/ci-standard@1' || !Array.isArray(doc.items)) throw new Error('knowledge/hfs/ci-standard.yaml is not a starci/ci-standard@1 standard');
    cached = doc;
  }
  return cached;
}

const jobsOf = (doc) => (record(doc?.jobs) ? Object.entries(doc.jobs).filter(([, job]) => record(job)) : []);
const stepsOf = (job) => (Array.isArray(job.steps) ? job.steps.filter(record) : []);
const usesOf = (step) => String(step.uses ?? '').trim();
const runOf = (step) => (typeof step.run === 'string' ? step.run : '');

/** The items of the standard this file checks for `scope`: their ids. */
const checkedItems = (standard, scope) => new Set(standard.items.filter((item) => item.check === 'ci-standard' && item.covers.includes(scope)).map((item) => item.id));

function jobShape(doc, edition, standard, say) {
  const shape = standard.jobs[edition] ?? standard.jobs.full;
  const ids = jobsOf(doc).map(([id]) => id);
  const out = [];
  const missing = shape.required.filter((id) => !ids.includes(id));
  const extra = ids.filter((id) => !shape.required.includes(id) && !shape.optional.includes(id));
  const gaps = [missing.length ? 'missing ' + missing.join(', ') : '', extra.length ? 'not in the standard ' + extra.join(', ') : ''].filter(Boolean).join('; ');
  if (gaps) out.push(say('job-shape', `the jobs must be ${shape.required.join(', ')} (optional ${shape.optional.join(', ')}); ${gaps}`));
  const withStep = (match) => jobsOf(doc).filter(([, job]) => stepsOf(job).some((step) => match(step))).map(([id]) => id);
  const unit = withStep((step) => step.name === 'unit');
  const upload = withStep((step) => usesOf(step).startsWith('codecov/codecov-action@'));
  const proof = withStep((step) => COVERAGE_PROOF.test(runOf(step)));
  if (unit.join() !== 'test') out.push(say('job-shape', `the unit run must be a step of the test job alone, not of ${unit.join(', ') || 'no job'}`));
  if (proof.join() !== 'coverage') out.push(say('job-shape', `the coverage proof must be a step of the coverage job alone, not of ${proof.join(', ') || 'no job'}`));
  if (upload.length && upload.join() !== 'coverage') out.push(say('job-shape', `the Codecov upload must be a step of the coverage job alone, not of ${upload.join(', ')}`));
  const oidc = jobsOf(doc).filter(([, job]) => job.permissions?.['id-token'] === 'write').map(([id]) => id);
  if (upload.length && oidc.join() !== 'coverage') out.push(say('job-shape', `only the coverage job holds the OIDC id-token (id-token: write), not ${oidc.join(', ') || 'no job'}`));
  return out;
}

function testSharding(doc, say) {
  const test = record(doc.jobs?.test) ? doc.jobs.test : null;
  if (!test) return [];
  const out = [];
  const shards = test.strategy?.matrix?.shard;
  if (!Array.isArray(shards) || !shards.length) out.push(say('test-sharding', 'the test job must be a matrix over shard (ci.jobs.test.shards)'));
  const unit = stepsOf(test).find((step) => step.name === 'unit');
  const total = /--shard=\$\{\{\s*matrix\.shard\s*\}\}\/(\d+)/.exec(unit ? runOf(unit) : '');
  if (unit && !total) out.push(say('test-sharding', 'the unit run must pass --shard=${{ matrix.shard }}/<N>'));
  if (total && Array.isArray(shards) && Number(total[1]) !== shards.length) out.push(say('test-sharding', `the unit run's shard total ${total[1]} must equal the ${shards.length} matrix shards`));
  if (unit && String(unit.env?.STARCI_COVERAGE_SHARD ?? '') !== '1') out.push(say('test-sharding', 'a shard runs the unit step with STARCI_COVERAGE_SHARD: "1": it measures only the files it loads and writes the istanbul JSON the coverage job merges'));
  if (unit && !runOf(unit).includes('--coverageThreshold={}')) out.push(say('test-sharding', 'a shard measures without the per-file threshold (--coverageThreshold={}); the coverage job proves it on the merged report'));
  const coverage = record(doc.jobs?.coverage) ? stepsOf(doc.jobs.coverage) : [];
  const merge = coverage.findIndex((step) => /app coverage merge\b/.test(runOf(step)));
  const proof = coverage.findIndex((step) => COVERAGE_PROOF.test(runOf(step)));
  if (merge < 0 || (proof >= 0 && merge > proof)) out.push(say('test-sharding', 'the coverage job must merge the shard reports (starci app coverage merge) before the coverage proof'));
  return out;
}

function lintParallel(doc, say) {
  const sides = record(doc.jobs?.lint) ? doc.jobs.lint.strategy?.matrix?.side : null;
  return Array.isArray(sides) && sides.map(String).sort(byCodeUnit).join() === 'be,fe' ? [] : [say('lint-parallel', 'the lint job must be a matrix over side [be, fe]')];
}

function cacheSavedAlways(doc, say) {
  const out = [];
  for (const [id, job] of jobsOf(doc)) {
    for (const step of stepsOf(job)) {
      const uses = usesOf(step);
      if (/^actions\/cache(?:\/restore)?@/.test(uses) && String(step.with?.key ?? '').includes('github.sha')) out.push(say('cache-saved-always', `job ${id}: a cache keyed by the commit sha never warms; key it by the lockfile hash (and the run) with restore-keys`));
      if (uses.startsWith('actions/cache/save@') && !/^(?:\$\{\{\s*)?always\(\)/.test(String(step.if ?? '').trim())) out.push(say('cache-saved-always', `job ${id}: actions/cache/save runs under if: always(), so a red run still warms the cache`));
    }
  }
  return out;
}

function fullHistory(doc, say) {
  const out = [];
  for (const [id, job] of jobsOf(doc)) {
    for (const step of stepsOf(job)) {
      if (usesOf(step).startsWith('actions/checkout@') && String(step.with?.['fetch-depth']) !== '0') out.push(say('full-history-base-ref', `job ${id}: actions/checkout must fetch the full history (fetch-depth: 0)`));
    }
  }
  for (const [id, job] of jobsOf(doc)) {
    const steps = stepsOf(job);
    const base = steps.findIndex((step) => /STARCI_BASE_REF=.*>>\s*"?\$GITHUB_ENV"?/.test(runOf(step)));
    const lint = steps.findIndex((step) => /\bnpm run lint\b|\bstarci app lint\b/.test(runOf(step)));
    if (lint >= 0 && (base < 0 || base > lint)) out.push(say('full-history-base-ref', `job ${id} must write STARCI_BASE_REF to GITHUB_ENV before its first lint step`));
  }
  return out;
}

function heapPerStep(doc, standard, say) {
  const out = [];
  for (const [id, job] of jobsOf(doc)) {
    for (const step of stepsOf(job)) {
      const run = runOf(step);
      if (!standard.heap.steps.some((needle) => run.includes(needle))) continue;
      const heap = /--max-old-space-size=(\d+)/.exec(String(step.env?.NODE_OPTIONS ?? ''));
      if (!heap || Number(heap[1]) < standard.heap.minMiB) out.push(say('heap-per-step', `job ${id}, step ${step.name ?? run.split('\n')[0].slice(0, 60)}: a heavy step declares NODE_OPTIONS --max-old-space-size=${standard.heap.minMiB} (or more) on the step`));
    }
  }
  return out;
}

function sonarLintPerSide(doc, say) {
  const out = [];
  for (const [id, job] of jobsOf(doc)) {
    for (const step of stepsOf(job)) {
      const run = runOf(step);
      if (/\b(?:npm run lint|starci(?:\.mjs)?["']?\s+app lint|app lint)\b/.test(run) && /\s--sonar\b/.test(run) && !/\s--side\s+(?:be\b|fe\b|\$\{\{\s*matrix\.side\s*\}\})/.test(run)) {
        out.push(say('sonar-lint-per-side', `job ${id}, step ${step.name ?? 'lint'}: a lint with a Sonar import must name its side (--side be|fe) and the reports are merged afterwards; a combined lint with Sonar breaks the standard`));
      }
    }
  }
  return out;
}

function optionalProviders(doc, say) {
  const out = [];
  const probes = [['codecov/codecov-action@', 'codecov-availability'], ['SonarSource/sonarqube-scan-action@', 'sonar-availability']];
  for (const [id, job] of jobsOf(doc)) {
    const steps = stepsOf(job);
    steps.forEach((step, index) => {
      const probe = probes.find(([prefix]) => usesOf(step).startsWith(prefix));
      if (!probe || step['continue-on-error'] !== true) return;
      if (!steps.slice(0, index).some((earlier) => earlier.id === probe[1])) out.push(say('optional-providers', `job ${id}: the optional ${usesOf(step).split('@')[0]} step must follow its availability probe (id ${probe[1]})`));
    });
  }
  return out;
}

function timeouts(doc, say) {
  return jobsOf(doc).filter(([, job]) => !Number.isFinite(Number(job['timeout-minutes'])) || job['timeout-minutes'] === null || job['timeout-minutes'] === '')
    .filter(([, job]) => job.uses === undefined).map(([id]) => say('timeouts', `job ${id} must declare timeout-minutes`));
}

function shaPinned(doc, say) {
  const out = [];
  for (const [id, job] of jobsOf(doc)) {
    for (const uses of [job.uses, ...stepsOf(job).map((step) => step.uses)].filter((value) => typeof value === 'string')) {
      const ref = uses.trim();
      if (ref.startsWith('./')) continue;
      const pinned = ref.startsWith('docker://') ? DIGEST_PIN.test(ref) : SHA_PIN.test(ref);
      if (!pinned) out.push(say('sha-pinned-actions', `job ${id}: ${ref} must be pinned to a commit sha (a docker:// action to a sha256 digest)`));
    }
  }
  return out;
}

/** The R301 findings of one workflow document: scope `app-ci` (with the app's edition) or `runtime`. Pure over the document and the standard. */
export function ciStandardFindings({ doc, file, scope, edition = 'full', standard = ciStandard() }) {
  if (!record(doc)) return [];
  const items = checkedItems(standard, scope);
  const say = (item, why) => found(CI_STANDARD, file, `${CI_STANDARD} ${file}: [${item}] ${why} (knowledge/hfs/ci-standard.yaml)`, { item });
  const checks = {
    'job-shape': () => jobShape(doc, edition, standard, say),
    'full-history-base-ref': () => fullHistory(doc, say),
    'heap-per-step': () => heapPerStep(doc, standard, say),
    'sonar-lint-per-side': () => sonarLintPerSide(doc, say),
    'optional-providers': () => optionalProviders(doc, say),
    'test-sharding': () => testSharding(doc, say),
    'lint-parallel': () => lintParallel(doc, say),
    'cache-saved-always': () => cacheSavedAlways(doc, say),
    timeouts: () => timeouts(doc, say),
    'sha-pinned-actions': () => shaPinned(doc, say),
  };
  return Object.entries(checks).filter(([id]) => items.has(id)).flatMap(([, check]) => check());
}

/** R301 over an app: its managed .github/workflows/ci.yml (the app check, and the runtime check over every example app). */
export function ciStandardAppFindings(ctx) {
  const edition = ctx.repo?.edition === 'lite' ? 'lite' : 'full';
  return appWorkflowFindings({ ...ctx, inScope: (file) => file === APP_CI && (ctx.inScope ?? (() => true))(file) },
    ({ path: file, text }) => ciStandardFindings({ doc: parseWorkflow(text), file, scope: 'app-ci', edition }), { dedupe: true });
}
