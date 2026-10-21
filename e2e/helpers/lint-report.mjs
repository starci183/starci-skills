// lint-report.mjs - the scaffold e2e's proof that `starci app lint` judged the app: exit 0 alone is not enough, because a lint whose
// ESLint never ran (a source scope it could not read) must not pass as clean. The starci/lint@1 JSON a `npm run lint -- --format json`
// prints after npm's own banner lines names every tool error and the files each engine linted.
import assert from 'node:assert/strict';

/** Assert the JSON report in `stdout` carries no tool error, no finding, and ESLint files on both sides. */
export function assertLintRan(stdout) {
  const text = String(stdout ?? '');
  // The report is the last thing printed and starts on a line of its own; codegen and npm print their lines before it.
  const start = text.search(/^\{/mu);
  assert.ok(start >= 0, 'starci app lint printed its JSON report');
  const report = JSON.parse(text.slice(start, text.lastIndexOf('}') + 1));
  assert.deepEqual(report.errors, [], 'every lint tool ran');
  assert.deepEqual(report.findings.map((f) => `${f.path}:${f.line ?? ''} ${f.engine}/${f.rule} ${f.message}`), [], 'a fresh scaffold has no finding');
  for (const side of ['be', 'fe']) assert.ok(report.engines?.eslint?.sides?.[side]?.files > 0, `ESLint linted the ${side} side`);
}
