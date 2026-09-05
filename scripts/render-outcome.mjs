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
const limited = (value, lines = 80, chars = 8000) => {
  const source = String(value).split(/\r?\n/);
  const kept = source.slice(0, lines);
  let text = kept.join('\n');
  if (text.length > chars) {
    const boundary = text.lastIndexOf('\n', chars);
    text = text.slice(0, boundary > 0 ? boundary : chars);
  }
  if (kept.length < source.length || text.length < kept.join('\n').length) text += '\n…';
  return text.trim();
};
const fenced = (text, language = '') => `\`\`\`${language}\n${limited(text)}\n\`\`\``;

const display = (value) => String(typeof value === 'object' ? JSON.stringify(value) : value ?? '').replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ').slice(0, 240);
const headingLabel = (value) => String(value || 'Summary').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replaceAll('-', ' ').replace(/^./, (letter) => letter.toUpperCase());
const resultWeight = (value) => /(?:result|verdict|lane|gate|change|file|rule|case|finding|record|evidence|check|status|outcome|decision)/i.test(value) ? 1 : 0;

function rowsTable(rows) {
  if (!rows.length || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) return null;
  const headings = [...new Set(rows.slice(0, 20).flatMap((row) => Object.keys(row)))].slice(0, 16);
  if (!headings.length) return null;
  // Wide case sheets can carry several arrays per row. Keep whole rows and leave room for the other
  // sibling tables, rather than slicing midway through the first giant JSON string.
  const rowLimit = Math.max(3, Math.min(20, Math.floor(40 / headings.length)));
  const shown = rows.slice(0, rowLimit);
  const lines = [`| ${headings.join(' | ')} |`, `| ${headings.map(() => '---').join(' | ')} |`, ...shown.map((row) => `| ${headings.map((heading) => display(row[heading])).join(' | ')} |`)];
  if (shown.length < rows.length) lines.push('', `_${rows.length - shown.length} more row(s) remain in the full artifact._`);
  return lines.join('\n');
}

function jsonTables(value) {
  if (!value || typeof value !== 'object') return fenced(JSON.stringify(value, null, 2), 'json');
  const sections = [];
  const visit = (current, label, depth) => {
    if (!current || typeof current !== 'object' || depth > 2) return;
    if (Array.isArray(current)) {
      if (!current.length) return;
      const body = current.every((item) => item && typeof item === 'object' && !Array.isArray(item))
        ? rowsTable(current)
        : current.slice(0, 20).map((item) => `- ${display(item)}`).join('\n');
      sections.push({ label, weight: resultWeight(label), body });
      return;
    }
    const scalars = Object.entries(current).filter(([, item]) => item === null || typeof item !== 'object');
    if (scalars.length) sections.push({ label: label || 'Summary', weight: resultWeight(label) + (label ? 0 : 0.5), body: rowsTable(scalars.map(([Field, Value]) => ({ Field, Value }))) });
    for (const [field, item] of Object.entries(current)) if (item && typeof item === 'object') visit(item, field, depth + 1);
  };
  visit(value, '', 0);
  sections.sort((left, right) => right.weight - left.weight);
  const rendered = sections.filter((section) => section.body).map((section) => `### ${headingLabel(section.label)}\n\n${section.body}`).join('\n\n');
  return rendered ? limited(rendered, 240, 12000) : fenced(JSON.stringify(value, null, 2), 'json');
}

function markdownTables(text) {
  const lines = String(text).split(/\r?\n/);
  const tables = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!/^\s*\|/.test(lines[index]) || !/^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(lines[index + 1])) continue;
    const table = [];
    let cursor = index;
    for (; cursor < lines.length && /^\s*\|/.test(lines[cursor]); cursor += 1) table.push(lines[cursor]);
    let title = 'Result';
    for (let before = index - 1; before >= 0; before -= 1) if (/^#{1,6}\s+/.test(lines[before])) { title = lines[before].replace(/^#{1,6}\s+/, '').trim(); break; }
    const weight = resultWeight(`${title} ${table[0] ?? ''}`) * 10 + (/binding|context|input/i.test(title) ? -5 : 0);
    tables.push({ title, table, weight, index });
    index = cursor - 1;
  }
  tables.sort((left, right) => right.weight - left.weight || left.index - right.index);
  const candidates = tables.some((item) => item.weight > 0) ? tables.filter((item) => item.weight >= 0) : tables;
  const rendered = candidates.slice(0, 4).map(({ title, table }) => {
    const shown = table.slice(0, 22);
    if (shown.length < table.length) shown.push('', `_${table.length - shown.length} more row(s) remain in the full artifact._`);
    return `### ${title}\n\n${shown.join('\n')}`;
  }).join('\n\n');
  return rendered ? limited(rendered, 180, 12000) : null;
}

function selectedMarkdownSections(text, pattern) {
  const lines = String(text).split(/\r?\n/);
  const sections = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^##\s+/.test(lines[index]) || !pattern.test(lines[index])) continue;
    let end = index + 1;
    while (end < lines.length && !/^##\s+/.test(lines[end])) end += 1;
    sections.push(lines.slice(index, end).join('\n').trim());
  }
  return sections.length ? limited(sections.join('\n\n'), 160, 12000) : null;
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
  const withFullArtifact = (excerpt) => `${excerpt}\n\n[Open the full ${label} artifact](<${target}>)`;
  const bytes = await readFile(absolute);
  if (!isReadableText(bytes)) return `[${label}](<${target}>)`;
  const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
  if (item.kind === 'table') {
    let rendered = markdownTables(text);
    if (!rendered && path.extname(absolute).toLowerCase() === '.json') {
      try { rendered = jsonTables(JSON.parse(text)); } catch { /* Full validation already reports malformed data output. */ }
    }
    return withFullArtifact(rendered || fenced(text, path.extname(absolute).toLowerCase() === '.json' ? 'json' : 'text'));
  }
  if (item.kind === 'code') {
    if (path.extname(absolute).toLowerCase() === '.md') return withFullArtifact(selectedMarkdownSections(text, /(?:change|diff|file|mutation|result|verdict)/i) || limited(text));
    const language = ({ '.js': 'javascript', '.mjs': 'javascript', '.ts': 'typescript', '.tsx': 'tsx', '.jsx': 'jsx', '.json': 'json', '.py': 'python', '.sh': 'bash', '.ps1': 'powershell', '.html': 'html', '.css': 'css', '.sql': 'sql', '.diff': 'diff', '.patch': 'diff' })[path.extname(absolute).toLowerCase()] ?? '';
    return withFullArtifact(fenced(text, language));
  }
  if (item.kind === 'diagram') {
    const trimmed = text.trimStart();
    const markdownMermaid = /```mermaid\s*[\s\S]*?```/i.exec(text)?.[0];
    const rendered = markdownMermaid ?? (path.extname(absolute).toLowerCase() === '.md'
      ? selectedMarkdownSections(text, /(?:diagram|model|flow|boundary|sequence)/i) || limited(text)
      : fenced(text, /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie)\b/.test(trimmed) ? 'mermaid' : 'text'));
    return withFullArtifact(rendered);
  }
  return withFullArtifact(limited(text));
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
    lines.push('', ...response.outcome.secondary.map((item) => item.kind === 'image'
      ? `![${markdownLabel(item.label)}](<${markdownPath(path.resolve(branch, item.ref))}>)`
      : `- [${markdownLabel(item.label)}](<${markdownPath(path.resolve(branch, item.ref))}>)`));
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const target = process.argv[2];
  if (!target) throw new Error('usage: node scripts/render-outcome.mjs <session>/step-N/parallel-M[/exchange]');
  process.stdout.write(await renderOutcome(runtimeRoot, target));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
