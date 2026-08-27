import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createVisualizeDirective, normalizeVisualizePath } from './visualize-directive.mjs';

test('normalizes a Windows path before creating a JSON-safe visualize directive', () => {
  const input = String.raw`C:\Users\Hi\.codex\visualizations\2026\08\25\nivo-modules.html`;
  const directive = createVisualizeDirective(input);

  assert.equal(
    directive,
    'visualize{"path":"C:/Users/Hi/.codex/visualizations/2026/08/25/nivo-modules.html"}'
  );
  assert.doesNotMatch(directive, /\\[nrt]/u);
});

test('preserves an absolute POSIX path and optional supported fields', () => {
  assert.equal(
    createVisualizeDirective('/tmp/review.html', { mode: 'wide', title: 'Module review' }),
    'visualize{"path":"/tmp/review.html","mode":"wide","title":"Module review"}'
  );
});

test('rejects relative paths and paths containing interpreted control characters', () => {
  assert.throws(() => normalizeVisualizePath('review.html'), /absolute/u);
  assert.throws(() => normalizeVisualizePath('C:/visualizations/\nivo.html'), /control characters/u);
  assert.throws(() => normalizeVisualizePath('C:/visualizations/\tivo.html'), /control characters/u);
});

test('rejects unsupported directive options', () => {
  assert.throws(() => createVisualizeDirective('/tmp/review.html', { mode: 'full' }), /mode/u);
  assert.throws(() => createVisualizeDirective('/tmp/review.html', { title: 'bad\ntitle' }), /control characters/u);
});

test('CLI emits exactly one safe directive', () => {
  const script = fileURLToPath(new URL('./visualize-directive.mjs', import.meta.url));
  const result = spawnSync(
    process.execPath,
    [script, String.raw`C:\Users\Hi\.codex\visualizations\2026\08\25\nivo-modules.html`],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    'visualize{"path":"C:/Users/Hi/.codex/visualizations/2026/08/25/nivo-modules.html"}\n'
  );
});
