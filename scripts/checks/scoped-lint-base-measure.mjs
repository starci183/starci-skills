#!/usr/bin/env node
// scoped-lint-base-measure.mjs — the child process that measures a scoped-lint base tree (scoped-lint-baseline.mjs
// measureBaseTree). It is started with the base view preloaded (NODE_OPTIONS --import scoped-lint-base-view.mjs), so
// the base tree's dependencies read from the live repository without a link, and runs the same check-scoped-lint
// measurement a scoped run makes, measure-only, on the base tree.
//
//   node scoped-lint-base-measure.mjs <request.json>
//   request: {root, files, profile, architectureConfig, out}; the report is written to `out`.
import fs from 'node:fs';
import {BASE_VIEW_ENV} from './scoped-lint-base-view.mjs';

const request = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!globalThis[Symbol.for('starci.scopedLintBaseView')] || !process.env[BASE_VIEW_ENV]) {
  fs.writeFileSync(request.out, JSON.stringify({error: 'the base view is not installed; the base tree has no dependencies of its own'}));
  process.exit(2);
}
const {checkScopedLint} = await import('./check-scoped-lint.mjs');
const report = await checkScopedLint(request.root, request.files, {profile: request.profile, architectureConfig: request.architectureConfig ?? null, measureOnly: true});
fs.writeFileSync(request.out, JSON.stringify(report));
