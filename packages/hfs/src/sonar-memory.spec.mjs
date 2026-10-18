import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { renderTargets } from '../sync/index.mjs';

const heapProperty = 'sonar.javascript.node.maxspace';
const intendedHeapMiB = 6144;
const mib = 1024 * 1024;

function propertiesOf(text) {
  return new Map(text.split(/\r?\n/u).map(line => line.trim()).filter(line => line && !line.startsWith('#')).map(line => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

for (const edition of ['full', 'lite']) {
  test(`${edition} rendered Sonar properties apply the CI Node heap budget`, () => {
    const hfs = { hfs: 3, kind: 'app', edition, project: 'sonar-memory-proof', sides: {
      be: { apps: [{ name: 'api', kind: 'api' }] },
      fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/'] },
    } };
    const target = renderTargets(hfs, {}).find(item => item.path === 'sonar-project.properties');
    assert.ok(target, 'the managed Sonar properties are rendered');
    const properties = propertiesOf(target.content);
    // SonarJS reads this property into its Node command's maxOldSpaceSize. The 6 GiB budget leaves room for Java and the OS on an 8 GiB runner.
    // The probe measures the configured heap without allocating it; NODE_OPTIONS models the failed scan's smaller baseline.
    // https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/languages/javascript-typescript-css
    const maxspace = properties.get(heapProperty);
    const args = maxspace === undefined ? [] : [`--max-old-space-size=${maxspace}`];
    args.push('-e', "process.stdout.write(String(require('node:v8').getHeapStatistics().heap_size_limit))");
    const result = spawnSync(process.execPath, args, {
      encoding: 'utf8', windowsHide: true, timeout: 15_000,
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=2240' },
    });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr);
    const heapLimit = Number(result.stdout);
    assert.ok(heapLimit >= intendedHeapMiB * mib,
      `${heapProperty}=${maxspace ?? 'missing'} produced only ${heapLimit / mib} MiB of Node heap`);
    assert.ok(heapLimit < (intendedHeapMiB + 512) * mib, 'the configured heap stays within the CI budget plus V8 overhead');
    assert.equal(Number(maxspace), intendedHeapMiB, 'the analyzer uses the existing CI Node budget');
    assert.equal(properties.has('sonar.nodejs.maxspace'), false, 'the unrecognized property is not emitted');
  });
}
