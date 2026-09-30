import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-be-fixture.mjs';

// R32 composition-spec-boots-real-module (BE_APP_COMPOSITION_ONLY): each app's <app>.composition.spec.ts imports the app's
// own AppModule and calls AppModule.register( - a stand-in module never boots the real composition.
const APP_MODULE = 'export class AppModule {\n  static register(options: object) { return { module: AppModule, ...options }; }\n}\n';
const SPEC = "import { AppModule } from './app.module';\nit('boots', () => { AppModule.register({}); });\n";
const hits = report => findings(report, 'BE_APP_COMPOSITION_ONLY');
const run = (t, spec, files = {}) => runArch(archFixture(t, { files: { 'apps/core/src/app.module.ts': APP_MODULE, 'apps/core/src/core.composition.spec.ts': spec, ...files } }));

test('a composition spec that imports the real AppModule and calls register raises nothing', t => {
  const report = run(t, SPEC);
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.compositionSpec.status, 'checked');
  assert.equal(report.coverage.hfsMachine.compositionSpec.specs, 1);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_APP_COMPOSITION_ONLY'));
});

test('an alias of the real AppModule that is registered is accepted', t => {
  assert.deepEqual(hits(run(t, "import { AppModule as Real } from './app.module.ts';\nit('boots', () => { Real.register({}); });\n")), []);
});

test('a spec that declares its own AppModule is BE_APP_COMPOSITION_ONLY', t => {
  const found = hits(run(t, "class AppModule { static register(options: object) { return options; } }\nit('boots', () => { AppModule.register({}); });\n"));
  assert.ok(found.some(item => /declares its own AppModule/.test(item.message)), JSON.stringify(found));
  assert.ok(found.every(item => item.path === 'apps/core/src/core.composition.spec.ts' && item.app === 'core'));
});

test('a spec that imports AppModule from another file is BE_APP_COMPOSITION_ONLY', t => {
  const found = hits(run(t, "import { AppModule } from './stub.module';\nit('boots', () => { AppModule.register({}); });\n", { 'apps/core/src/stub.module.ts': APP_MODULE }));
  assert.equal(found.length >= 1, true);
  assert.ok(found.some(item => /not from the app's own/.test(item.message)));
});

test('a spec that imports AppModule but never registers it, or never imports it, is BE_APP_COMPOSITION_ONLY', t => {
  const unregistered = hits(run(t, "import { AppModule } from './app.module';\nit('boots', () => { expect(AppModule).toBeDefined(); });\n"));
  assert.equal(unregistered.length, 1);
  assert.match(unregistered[0].message, /never calls AppModule\.register/);
  const unimported = hits(run(t, "it('boots', () => { expect(1).toBe(1); });\n"));
  assert.equal(unimported.length, 1);
  assert.match(unimported[0].message, /does not import AppModule/);
});
