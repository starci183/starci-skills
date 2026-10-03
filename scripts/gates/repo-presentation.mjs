#!/usr/bin/env node
// Repository presentation gate. Product repositories also receive the full HFS tree check.
//   starci gate repo-presentation --root <repo> [--runtime] [--json]
import path from 'node:path';
import { checkHfsWithoutConfig, checkRepoPresentation } from '../hfs/architecture/hfs.mjs';

const args = process.argv.slice(2);
let root = '.', runtime = false, json = false;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--root') root = args[++index];
  else if (args[index] === '--runtime') runtime = true;
  else if (args[index] === '--json') json = true;
  else { process.stderr.write('usage: starci gate repo-presentation --root <repo> [--runtime] [--json]\n'); process.exit(2); }
}
if (!root) { process.stderr.write('--root needs a directory\n'); process.exit(2); }
root = path.resolve(root);
const result = runtime ? checkRepoPresentation({ root, runtime }) : checkHfsWithoutConfig(root);
const report = { schema: 'starci/repo-presentation-check@1', root, profile: runtime ? 'runtime' : 'product',
  ok: result.coverage.status === 'checked' && result.violations.length === 0,
  coverage: result.coverage, findings: result.violations };
if (json) process.stdout.write(`${JSON.stringify(report)}\n`);
else {
  for (const item of report.findings) process.stdout.write(`${item.path}:${item.line} [${item.ruleId}] ${item.message}\n`);
  process.stdout.write(`${report.ok ? 'PASS' : 'FAIL'} ${root}: ${report.findings.length} findings\n`);
}
process.exitCode = report.ok ? 0 : 1;
