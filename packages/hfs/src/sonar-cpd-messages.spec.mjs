// Owner ruling 2026-10-22: a message catalog holds one block per language with the same keys, which Sonar's copy-paste detection
// read as duplicated code (NIVO v0.3.1: new_duplicated_lines_density 35% once prettier formatted the catalogs). The rendered
// properties leave the catalogs out of CPD only; they stay sources, so lint, analysis and every other rule still hold them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SONAR_CPD_EXCLUSIONS, renderTargets } from '../sync/index.mjs';

function propertiesOf(text) {
  return new Map(text.split(/\r?\n/u).map(line => line.trim()).filter(line => line && !line.startsWith('#')).map(line => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

for (const edition of ['full', 'lite']) {
  test(`${edition} rendered Sonar properties leave only the message catalogs out of copy-paste detection`, () => {
    const hfs = { hfs: 3, kind: 'app', edition, project: 'sonar-cpd-proof', sides: {
      be: { apps: [{ name: 'api', kind: 'api' }] },
      fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/'] },
    } };
    const target = renderTargets(hfs, {}).find(item => item.path === 'sonar-project.properties');
    assert.ok(target, 'the managed Sonar properties are rendered');
    const properties = propertiesOf(target.content);
    assert.equal(properties.get('sonar.cpd.exclusions'), '**/messages/*.messages.ts,**/messages/*.json');
    assert.deepEqual([...SONAR_CPD_EXCLUSIONS], ['**/messages/*.messages.ts', '**/messages/*.json']);
    for (const glob of SONAR_CPD_EXCLUSIONS) {
      assert.ok(!properties.get('sonar.exclusions').split(',').includes(glob), `${glob} stays a source`);
    }
  });
}
