// proves: CI_UPLOAD_NOT_SILENT@lite
// proves: CI_UPLOAD_NOT_SILENT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { ciUploadFindings } from '../../scripts/hfs/runtime-rules/ci-upload.mjs';

const workflow = ({ upload = '          use_oidc: true\n          fail_ci_if_error: true\n', permissions = '      id-token: write\n', gate = '' } = {}) => `name: coverage
on: workflow_dispatch
jobs:
  coverage:
    permissions:
${permissions}    steps:
      - uses: codecov/codecov-action@v5
${gate}        with:
${upload}`;

const findingsFor = (edition, text) => {
  const file = `examples/${edition}-app/.github/workflows/ci.yml`;
  return ciUploadFindings({ repo: { kind: 'app', edition }, files: [file], read: () => text });
};

for (const edition of ['lite', 'full']) {
  test(`${edition}: missing upload failure handling, OIDC permission and a secret gate are refused`, () => {
    const cases = [
      [workflow({ upload: '          use_oidc: true\n' }), /fail_ci_if_error/],
      [workflow({ permissions: '      contents: read\n' }), /id-token: write/],
      [workflow({ gate: '        if: ${{ env.CODECOV_TOKEN != \'\' }}\n' }), /gated on a secret/],
    ];
    for (const [text, reason] of cases) {
      const findings = findingsFor(edition, text);
      assert.deepEqual(findings.map((f) => f.code), ['CI_UPLOAD_NOT_SILENT']);
      assert.equal(findings[0].path, `examples/${edition}-app/.github/workflows/ci.yml`);
      assert.match(findings[0].message, reason);
    }
  });

  test(`${edition}: an ungated OIDC upload with permission and failure propagation passes`, () => {
    assert.deepEqual(findingsFor(edition, workflow()), []);
  });
}
