// Present the reviewable result of one accepted v2.2 attempt. This command is read-only: the
// response and all selected artifacts are already covered by the accepted evidence manifest.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { evidenceManifestErrors } from './evidence-manifest.mjs';
import { V22_CONTRACT, sessionRootOf } from './validate-request.mjs';
import { validateStep } from './validate-step.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function branchIdentity(branch) {
  const exchange = /^parallel-\d+$/.test(path.basename(branch)) ? null : path.basename(branch);
  const parallelDir = exchange ? path.dirname(branch) : branch;
  const step = /^step-(\d+)$/.exec(path.basename(path.dirname(parallelDir)));
  const parallel = /^parallel-(\d+)$/.exec(path.basename(parallelDir));
  if (!step || !parallel || (exchange && !/^[a-z][a-z-]*$/.test(exchange))) throw new Error('branch must be <session>/step-N/parallel-M[/exchange]');
  return { exchange, parallelDir, key: `${step[1]}/${parallel[1]}${exchange ? `/${exchange}` : ''}` };
}

const markdownLabel = (value) => String(value).replace(/([\\\[\]])/g, '\\$1').replace(/[\r\n]+/g, ' ').trim();
const markdownPath = (value) => path.resolve(value).split(path.sep).join('/').replaceAll('>', '%3E');
const limited = (value, lines = 40, chars = 4000) => String(value).split(/\r?\n/).slice(0, lines).join('\n').slice(0, chars).trim();
const fenced = (text, language = '') => `\`\`\`${language}\n${limited(text)}\n\`\`\``;

function jsonTable(value) {
  const rows = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.entries(value).map(([key, item]) => ({ key, value: item })) : [];
  if (!rows.length || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) return null;
  const headings = [...new Set(rows.slice(0, 10).flatMap((row) => Object.keys(row)))].slice(0, 12);
  if (!headings.length) return null;
  const cell = (value2) => String(typeof value2 === 'object' ? JSON.stringify(value2) : value2 ?? '').replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ').slice(0, 300);
  return [`| ${headings.join(' | ')} |`, `| ${headings.map(() => '---').join(' | ')} |`, ...rows.slice(0, 10).map((row) => `| ${headings.map((heading) => cell(row[heading])).join(' | ')} |`)].join('\n');
}

function markdownTable(text) {
  const lines = String(text).split(/\r?\n/);
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!/^\s*\|/.test(lines[index]) || !/^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(lines[index + 1])) continue;
    const table = [];
    for (let cursor = index; cursor < lines.length && /^\s*\|/.test(lines[cursor]); cursor += 1) table.push(lines[cursor]);
    return table.slice(0, 12).join('\n');
  }
  return null;
}

function isReadableText(bytes) {
  if (!bytes.length || bytes.includes(0)) return false;
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  let controls = 0;
  for (const byte of sample) if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) controls += 1;
  return controls / sample.length < 0.02;
}

async function presentPrimary(branch, item) {
  const absolute = path.resolve(branch, item.ref);
  const target = markdownPath(absolute);
  const label = markdownLabel(item.label);
  if (item.kind === 'image') return `![${label}](<${target}>)`;
  if (item.kind === 'link') return `[${label}](<${target}>)`;
  const bytes = await readFile(absolute);
  if (!isReadableText(bytes)) return `[${label}](<${target}>)`;
  const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
  if (item.kind === 'table') {
    let rendered = markdownTable(text);
    if (!rendered && path.extname(absolute).toLowerCase() === '.json') {
      try { rendered = jsonTable(JSON.parse(text)); } catch { /* Full validation already reports malformed data output. */ }
    }
    return rendered || fenced(text, path.extname(absolute).toLowerCase() === '.json' ? 'json' : 'text');
  }
  if (item.kind === 'code') {
    if (path.extname(absolute).toLowerCase() === '.md') return limited(text);
    const language = ({ '.js': 'javascript', '.mjs': 'javascript', '.ts': 'typescript', '.tsx': 'tsx', '.jsx': 'jsx', '.json': 'json', '.py': 'python', '.sh': 'bash', '.ps1': 'powershell', '.html': 'html', '.css': 'css', '.sql': 'sql' })[path.extname(absolute).toLowerCase()] ?? '';
    return fenced(text, language);
  }
  if (item.kind === 'diagram') {
    const trimmed = text.trimStart();
    return fenced(text, /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie)\b/.test(trimmed) ? 'mermaid' : 'text');
  }
  return limited(text);
}

export async function renderOutcome(root, branch, { validateStepFn = validateStep, evidenceErrorsFn = evidenceManifestErrors } = {}) {
  root = path.resolve(root);
  branch = path.resolve(branch);
  const session = sessionRootOf(branch);
  if (!session || !existsSync(path.join(session, 'state.json'))) throw new Error('SESSION_MISSING: outcome belongs to no open or retained user session');
  const { exchange, parallelDir, key } = branchIdentity(branch);
  const state = JSON.parse(await readFile(path.join(session, 'state.json'), 'utf8'));
  if (state.contractVersion !== V22_CONTRACT) throw new Error('OUTCOME_LEGACY: The best outcome renderer requires an enforced v2.2 session');
  const attempt = state.attempts?.[key];
  if (!attempt) throw new Error(`OUTCOME_UNACCEPTED: attempts[${key}] is missing`);
  if (attempt.status !== 'matched') throw new Error(`OUTCOME_UNACCEPTED: attempt ${attempt.id} is ${attempt.status}; only an accepted matched attempt has a best outcome`);
  if (!attempt.evidenceManifest) throw new Error(`OUTCOME_UNSEALED: attempt ${attempt.id} has no accepted evidence manifest`);
  const expectedResponseRef = `${path.relative(session, branch).split(path.sep).join('/')}/response/response.json`;
  if (attempt.responseRef !== expectedResponseRef) throw new Error(`OUTCOME_UNACCEPTED: attempts[${key}].responseRef does not bind this branch`);
  const sealErrors = await evidenceErrorsFn(branch, attempt.evidenceManifest);
  if (sealErrors.length) throw new Error(sealErrors.join('\n'));
  const checked = await validateStepFn(root, parallelDir, { operator: true, requestPhase: 'accept' });
  if (checked.errors.length) throw new Error(checked.errors.join('\n'));
  const response = JSON.parse(await readFile(path.join(branch, 'response', 'response.json'), 'utf8'));
  if (response.contractVersion !== V22_CONTRACT || response.status !== 'done' || response.comparison?.verdict !== 'matched' || response.comparison?.next !== 'advance') {
    throw new Error('OUTCOME_MISMATCH: response is not a matched v2.2 done receipt that advances');
  }
  if (response.attempt?.id !== attempt.id) throw new Error(`OUTCOME_UNACCEPTED: sealed response belongs to ${response.attempt?.id ?? 'no attempt'}, not ${attempt.id}`);
  if (!response.outcome?.primary) throw new Error('OUTCOME_MISSING: accepted done receipt has no primary outcome');
  const lines = ['## The best outcome', '', response.outcome.summary.trim(), '', await presentPrimary(branch, response.outcome.primary)];
  if (response.outcome.selectionReason) lines.push('', response.outcome.selectionReason.trim());
  if (response.outcome.secondary?.length) {
    lines.push('', ...response.outcome.secondary.map((item) => `- [${markdownLabel(item.label)}](<${markdownPath(path.resolve(branch, item.ref))}>)`));
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const target = process.argv[2];
  if (!target) throw new Error('usage: node scripts/render-outcome.mjs <session>/step-N/parallel-M[/exchange]');
  process.stdout.write(await renderOutcome(runtimeRoot, target));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
