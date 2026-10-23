// A JSON file is admitted by the format a tool requires, declared once by rule (scripts/lib/json-formats.mjs, read by the runtime's
// json-exceptions check), never by a per-file list. Authored config of no declared format is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSON_FORMATS, jsonFormatOf } from '../runtime/scripts/lib/json-formats.mjs';

const formatId = (rel) => jsonFormatOf(rel)?.id ?? null;

test('toolchain JSON is admitted by base name at any depth', () => {
  assert.equal(formatId('package.json'), 'npm-manifest');
  assert.equal(formatId('fe/apps/app/package-lock.json'), 'npm-manifest');
  assert.equal(formatId('be/tsconfig.json'), 'typescript-config');
  assert.equal(formatId('be/src/tests/tsconfig.json'), 'typescript-config');
  assert.equal(formatId('packages/grammar/tsconfig.stories.json'), 'typescript-config');
  assert.equal(formatId('turbo.json'), 'turbo-pipeline');
  assert.equal(formatId('be/nest-cli.json'), 'nest-cli');
  assert.equal(formatId('hfs.json'), 'tree-kind');
});

test('a next-intl catalog is admitted by its folder and locale file name', () => {
  assert.equal(formatId('fe/apps/app/src/modules/i18n/messages/en.json'), 'i18n-message-catalog');
  assert.equal(formatId('fe/apps/app/src/modules/i18n/messages/vi.json'), 'i18n-message-catalog');
  assert.equal(formatId('fe/apps/app/src/modules/i18n/messages/extra-notes.json'), null);
  assert.equal(formatId('fe/apps/app/src/messages/en.json'), null);
});

test('the stack layout JSON is admitted by its position under .starcistacks', () => {
  assert.equal(formatId('.starcistacks/dev/environment.json'), 'stack-environment');
  assert.equal(formatId('examples/lite-app/.starcistacks/production/environment.json'), 'stack-environment');
  assert.equal(formatId('.starcistacks/dev/infra/metadata.json'), 'stack-infra-metadata');
  assert.equal(formatId('.starcistacks/dev/infra/compose/realm-shop.json'), 'keycloak-realm-import');
  assert.equal(formatId('.starcistacks/dev/notes.json'), null);
});

test('emitted contracts, scorecard snapshots, claude settings and package-script fragments are formats of their tool', () => {
  assert.equal(formatId('be/contracts/order/events.json'), 'async-event-contract');
  assert.equal(formatId('be/contracts/order/events.pin.json'), 'async-event-contract');
  assert.equal(formatId('benchmark/snapshots/2026-09-25-24h.json'), 'model-scorecard-snapshot');
  assert.equal(formatId('benchmark/snapshots/nested/x.json'), null);
  assert.equal(formatId('.claude/settings.json'), 'claude-code-settings');
  assert.equal(formatId('packages/hfs/templates/app/package-scripts/core.json'), 'package-scripts-fragment');
  assert.equal(formatId('packages/tsconfig/next.json'), 'shared-tsconfig-preset');
});

test('authored config of no declared format is refused', () => {
  for (const rel of ['knowledge/ui/proof/calibration/calibration.json', 'engine/yaml-license.json', 'modules/kernel/rules.json', 'settings.json', 'src/data/feature-flags.json', 'tsconfig.yaml']) {
    assert.equal(jsonFormatOf(rel), null, rel);
  }
});

test('every format names its tool and a matcher, and ids are unique', () => {
  assert.equal(new Set(JSON_FORMATS.map((format) => format.id)).size, JSON_FORMATS.length);
  for (const format of JSON_FORMATS) {
    assert.ok(format.tool && typeof format.match === 'function', format.id);
  }
});
