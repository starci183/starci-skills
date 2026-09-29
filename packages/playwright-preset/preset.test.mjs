import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const preset = require('./index.cjs');

test('three projects, one per ui-screen viewport, in desktop/tablet/mobile order', () => {
  const config = preset.starciPlaywrightConfig();
  assert.deepEqual(config.projects.map((p) => [p.name, p.use.viewport.width, p.use.viewport.height]), [
    ['desktop', 1440, 900],
    ['tablet', 768, 1024],
    ['mobile', 390, 844],
  ]);
});

test('desktop and mobile are the layout-tree default breakpoints (the sizes ui-screen shots are drawn at)', async () => {
  const { DEFAULT_BREAKPOINTS } = await import('../../scripts/work/layout-tree.mjs');
  for (const { name, width, height } of DEFAULT_BREAKPOINTS) assert.deepEqual(preset.VIEWPORTS[name], { width, height }, name);
  assert.deepEqual(preset.VIEWPORTS.tablet, { width: 768, height: 1024 });
});

test('one serial worker, e2e-spec match, forbidOnly in CI, no retries', () => {
  const saved = process.env.CI;
  try {
    process.env.CI = '1';
    const config = preset.starciPlaywrightConfig();
    assert.equal(config.workers, 1);
    assert.equal(config.fullyParallel, false);
    assert.equal(config.testMatch, '**/*.e2e-spec.ts');
    assert.equal(config.forbidOnly, true);
    assert.equal(config.retries, 0);
  } finally {
    if (saved === undefined) delete process.env.CI; else process.env.CI = saved;
  }
});

test('options: baseURL, webServer and extra use flow through; viewports are copies, not shared', () => {
  const config = preset.starciPlaywrightConfig({ baseURL: 'http://127.0.0.1:5067', webServer: { command: 'x', url: 'http://127.0.0.1:5067' }, use: { locale: 'en' } });
  assert.equal(config.use.baseURL, 'http://127.0.0.1:5067');
  assert.equal(config.use.locale, 'en');
  assert.equal(config.use.colorScheme, 'light');
  assert.equal(config.webServer.command, 'x');
  config.projects[0].use.viewport.width = 1;
  assert.equal(preset.VIEWPORTS.desktop.width, 1440);
});
