// proves: RELEASE_NOTES@lite
// proves: RELEASE_NOTES@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseNotesRepoFindings } from '../../scripts/hfs/runtime-rules/release-notes.mjs';

const findingsFor = (edition, changelog) => releaseNotesRepoFindings({
  repo: { kind: 'app', edition },
  tagsAtHead: ['v1.2.3'],
  read: (file) => {
    assert.equal(file, 'CHANGELOG.md');
    return changelog;
  },
});

for (const edition of ['lite', 'full']) {
  test(`${edition}: a tagged version needs a finished matching changelog section`, () => {
    for (const changelog of ['# Changelog\n\n## [1.2.2]\n- Previous release.\n', '## [1.2.3] - in preparation\n- TODO: evidence.\n']) {
      const findings = findingsFor(edition, changelog);
      assert.deepEqual(findings.map((f) => f.code), ['RELEASE_NOTES']);
      assert.equal(findings[0].path, 'CHANGELOG.md');
      assert.match(findings[0].message, /v1\.2\.3/);
    }
  });

  test(`${edition}: the tagged section passes even with an unfinished next release`, () => {
    assert.deepEqual(findingsFor(edition, '# Changelog\n\n## [1.2.4] - in preparation\n- TODO: next release.\n\n## [1.2.3] - 2026-10-14\n- Added the booking confirmation flow.\n'), []);
  });
}
