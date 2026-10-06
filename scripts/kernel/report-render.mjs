#!/usr/bin/env node
// report-render.mjs — the canonical human rendering of a starci/op-report@1
// envelope. `starci kernel report` prints this block after filing so the op terminal
// shows the reports row's projection — the row is the truth, this is its view.
//
// The block passes through redactText: a report's summary, open items and blocker detail are agent-written text, and a
// secret in them never reaches the terminal. A library of scripts/kernel/verbs/report.mjs; it has no command line.

import { redactText } from '../lib/redact.mjs';

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
  return redactText(lines.join('\n'));
}
