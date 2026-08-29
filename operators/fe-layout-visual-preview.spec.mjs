import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateOutput } from './fe/layout/validate-output.mjs';
const output = () => ({ schemaVersion: 7, operatorId: 'fe/layout', output: { outcome: 'directions-ready', result: { summary: 'Responsive geometry compiled for wide, intermediate, and compact viewports.', artifactRefs: ['artifact://layout-geometry', 'artifact://responsive-proof'] }, gaps: [], evidenceRefs: ['direction://approved', 'laws://compiled'] } });
test('accepts an evidence-bound layout compilation and rejects legacy review routing', () => { assert.deepEqual(validateOutput(output()), { valid: true, errors: [] }); const routed = output(); routed.output.reviewPreview = { renderer: 'visualize' }; assert.equal(validateOutput(routed).valid, false); });
test('layout owns geometry compilation after laws and before Grammar', () => { const execute = readFileSync(new URL('./fe/layout/execute.md', import.meta.url), 'utf8'); assert.match(execute, /responsive layout geometry/i); assert.match(execute, /AI-first -> Rules-first -> Grammar-last/); assert.match(execute, /separate jobs/); });
