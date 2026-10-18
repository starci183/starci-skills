import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderTargets } from '../sync/index.mjs';
import { parseYaml } from '../runtime/engine/yaml.mjs';
import { ciStandardFindings } from '../runtime/scripts/hfs/rules/ci-standard.mjs';

const standard = parseYaml(fs.readFileSync(new URL('../runtime/knowledge/hfs/ci-standard.yaml', import.meta.url), 'utf8'));
const nodeOptions = `--max-old-space-size=${standard.heap.minMiB}`;

for (const edition of ['full', 'lite']) {
  test(`${edition} CI gives typecheck, lint and coverage the standard heap on each step`, () => {
    const hfs = { hfs: 3, kind: 'app', edition, project: 'heap-proof', sides: {
      be: { apps: [{ name: 'api', kind: 'api' }] },
      fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/'] },
    } };
    const target = renderTargets(hfs, {}).find((item) => item.path === '.github/workflows/ci.yml');
    assert.ok(target, 'the managed CI is rendered');
    const doc = parseYaml(target.content);
    const typecheck = doc.jobs.fast.steps.find((step) => step.run === 'npm run typecheck');
    assert.equal(typecheck?.env?.NODE_OPTIONS, nodeOptions);
    const heavy = Object.values(doc.jobs).flatMap((job) => job.steps ?? [])
      .filter((step) => standard.heap.steps.some((needle) => String(step.run ?? '').includes(needle)));
    assert.ok(heavy.length >= 3, 'typecheck, lint and coverage are checked');
    for (const step of heavy) assert.equal(step.env?.NODE_OPTIONS, nodeOptions, step.name);
    assert.deepEqual(ciStandardFindings({ doc, file: target.path, scope: 'app-ci', edition }), []);
  });
}

test('the bundled CI standard rejects missing and undersized typecheck heaps in apps and the runtime', () => {
  const heapOnly = { ...standard, items: standard.items.filter((item) => item.id === 'heap-per-step') };
  for (const scope of ['app-ci', 'runtime']) {
    const findings = (stepEnv, jobEnv) => ciStandardFindings({ scope, standard: heapOnly, file: '.github/workflows/ci.yml',
      doc: { jobs: { fast: { env: jobEnv, steps: [{ name: 'typecheck', run: 'npm run typecheck', env: stepEnv }] } } },
    });
    for (const env of [undefined, {}, { NODE_OPTIONS: `--max-old-space-size=${standard.heap.minMiB - 1}` }]) {
      const result = findings(env);
      assert.equal(result.length, 1, `${scope}: missing or low step heap is refused`);
      assert.equal(result[0].item, 'heap-per-step');
    }
    assert.equal(findings(undefined, { NODE_OPTIONS: nodeOptions }).length, 1, 'job-level heap does not replace step custody');
    assert.deepEqual(findings({ NODE_OPTIONS: nodeOptions }), []);
    assert.deepEqual(findings({ NODE_OPTIONS: `--max-old-space-size=${standard.heap.minMiB + 1}` }), []);
  }
});
