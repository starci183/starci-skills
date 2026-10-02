// The trigger kinds of a back end (scripts/hfs/rules/kinds.mjs): R179 BE_KIND_DECLARATION (the kinds in use are declared in
// hfs.json sides.be.kinds, with their patterns and platform capabilities) and R180 BE_KIND_EMPTY (a kind folder has members, each with code).
// The tracked file list is the whole input, so each case lists the files of one back end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { kindFindings } from '../../scripts/hfs/rules/kinds.mjs';

const API = ['be/src/features/orders/index.ts', 'be/src/features/orders/orders.module.ts'];
const JOB = ['be/src/features/jobs/send/index.ts', 'be/src/features/jobs/send/transport/queue/send.processor.ts'];
const PLATFORM = (...capabilities) => capabilities.map((capability) => `be/src/modules/platform/${capability}/index.ts`);
const run = (files, be) => kindFindings({ files, repo: { sides: { be } } });
const codes = (findings) => findings.map((f) => f.code);

test('BE_KIND_DECLARATION: the declared kinds equal the kinds in use, with their patterns and platform capabilities, and the finding is clean', () => {
  assert.deepEqual(run(API, { kinds: ['api'] }), []);
  assert.deepEqual(run([...API, ...JOB, ...PLATFORM('jobs', 'queue')], { kinds: ['api', 'jobs'], patterns: ['fenced-job', 'queue'] }), []);
  assert.deepEqual(run([], {}), [], 'a back end with no feature declares nothing');
  assert.deepEqual(run([], { kinds: [] }), []);
});

test('BE_KIND_DECLARATION: a kind in use that is not declared, and a declared kind nobody uses, are findings', () => {
  const undeclared = run([...API, ...JOB, ...PLATFORM('jobs', 'queue')], { kinds: ['api'], patterns: ['fenced-job', 'queue'] });
  assert.deepEqual(codes(undeclared), ['BE_KIND_DECLARATION']);
  assert.match(undeclared[0].message, /does not declare the kind `jobs`/);
  const noKinds = run(API, {});
  assert.match(noKinds[0].message, /does not declare the kind `api`/);
  const unused = run(API, { kinds: ['api', 'reactors'] });
  assert.deepEqual(codes(unused), ['BE_KIND_DECLARATION']);
  assert.match(unused[0].message, /declares `reactors` but no feature of that kind exists/);
});

test('BE_KIND_DECLARATION: a declared kind needs its patterns and its platform capabilities', () => {
  const noPatterns = run([...API, ...JOB, ...PLATFORM('jobs', 'queue')], { kinds: ['api', 'jobs'], patterns: ['queue'] });
  assert.equal(noPatterns.length, 1);
  assert.equal(noPatterns[0].pattern, 'fenced-job');
  const noPlatform = run([...API, ...JOB, ...PLATFORM('queue')], { kinds: ['api', 'jobs'], patterns: ['fenced-job', 'queue'] });
  assert.equal(noPlatform.length, 1);
  assert.equal(noPlatform[0].capability, 'jobs');
  assert.match(noPlatform[0].message, /hfs add/);
  const reactor = ['be/src/features/reactors/stock/index.ts', 'be/src/features/reactors/stock/stock.module.ts'];
  assert.deepEqual(run([...API, ...reactor, ...PLATFORM('event-bus')], { kinds: ['api', 'reactors'], patterns: ['event-bus'] }), []);
  assert.equal(run([...API, ...reactor], { kinds: ['api', 'reactors'], patterns: [] }).length, 2, 'the pattern and its platform capability');
});

test('BE_KIND_EMPTY: a file directly in a kind folder, or a member with no TypeScript, is a finding', () => {
  const stray = run([...API, 'be/src/features/jobs/.gitkeep'], { kinds: ['api'] });
  assert.deepEqual(codes(stray), ['BE_KIND_EMPTY']);
  assert.match(stray[0].message, /holds only instance folders/);
  const named = run(['be/src/features/jobs/index.ts', 'be/src/features/jobs/jobs.module.ts', 'be/src/features/jobs/application/run.handler.ts'], { kinds: [] });
  assert.ok(named.every((f) => f.code === 'BE_KIND_EMPTY' || f.code === 'BE_KIND_DECLARATION'));
  assert.ok(named.some((f) => f.code === 'BE_KIND_EMPTY' && f.path === 'be/src/features/jobs/index.ts'), 'a feature named like a kind is refused');
  const hollow = run([...API, 'be/src/features/jobs/send/README.md'], { kinds: ['api', 'jobs'], patterns: ['fenced-job', 'queue'] });
  assert.ok(hollow.some((f) => f.code === 'BE_KIND_EMPTY' && f.path === 'be/src/features/jobs/send/'));
});
