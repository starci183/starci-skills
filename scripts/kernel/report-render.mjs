#!/usr/bin/env node
// report-render.mjs — the canonical human rendering of a starci/op-report@1
// envelope. `api report` prints this block after filing so the op terminal
// shows the reports row's projection — the row is the truth, this is its view.
//
//   node scripts/kernel/report-render.mjs <report.json>

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const checkToken = (c) =>
  `${c?.name ?? '?'} ${Number(c?.exitCode) === 0 ? 'ok' : `fail(${c?.exitCode ?? '?'})`}`;

export function renderReportBlock(report = {}) {
  const lines = [
    `=== OP REPORT — ${report.task ?? '-'} / ${report.dispatch ?? '-'} ===`,
    `outcome : ${report.outcome ?? '-'}`,
    `summary : ${String(report.summary ?? '').replace(/\s+/g, ' ').trim() || '-'}`,
    `files   : ${Array.isArray(report.files) ? report.files.length : 0} changed`,
    `checks  : ${Array.isArray(report.checks) && report.checks.length ? report.checks.map(checkToken).join(' / ') : '-'}`,
  ];
  if (Array.isArray(report.open) && report.open.length) lines.push(`open    : ${report.open.join('; ')}`);
  if (report.blocker) lines.push(`blocker : ${report.blocker.kind ?? '-'} — ${report.blocker.detail ?? ''}`);
  if (report.question?.text) lines.push(`question: ${report.question.text}`);
  return lines.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.argv[2];
  if (!file) { console.error('use: node scripts/kernel/report-render.mjs <report.json>'); process.exit(2); }
  console.log(renderReportBlock(JSON.parse(fs.readFileSync(file, 'utf8'))));
}
