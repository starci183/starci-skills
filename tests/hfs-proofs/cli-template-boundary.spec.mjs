// proves: RT_CLI_APP_ONLY_TEMPLATES@lite
// proves: RT_CLI_APP_ONLY_TEMPLATES@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { appCliTemplateFindings } from '../../scripts/hfs/runtime-rules/app-cli-templates.mjs';

const hook = 'packages/hfs/templates/app/hooks/husky/pre-commit';
const hookText = fs.readFileSync(new URL('../../' + hook, import.meta.url), 'utf8');
const runtimeTemplate = 'packages/eslint/be/runtime/packages/hfs/templates/app/hooks/husky/pre-commit';

for (const edition of ['lite', 'full']) {
  test(`${edition} valid managed hook invokes app actions`, () => {
    assert.deepEqual(appCliTemplateFindings({ files: [hook, runtimeTemplate], read: () => hookText }), []);
  });

  test(`${edition} invalid managed hook rejects another CLI group`, () => {
    const text = hookText.replace('npx starci app hygiene', 'npx starci runtime check');
    const findings = appCliTemplateFindings({ files: [hook, runtimeTemplate], read: () => text });
    assert.deepEqual(findings.map(({ code, path }) => [code, path]), [
      ['RT_CLI_APP_ONLY_TEMPLATES', hook],
      ['RT_CLI_APP_ONLY_TEMPLATES', runtimeTemplate],
    ]);
  });
}
