#!/usr/bin/env node
// grammar-proposal.mjs — what a drawing needs that the Grammar's DNA does not have (owner ruling 2026-09-27: "anything
// DNA lacks becomes a grammar proposal, never invented inline").
//
// A drawing that needs a component or variant DNA lacks composes the closest DNA components, marks the spot
// data-grammar-proposal="<name>" (scripts/work/draw/draw-dna.mjs), and writes the proposal beside its render source or
// in its draw-loop directory:
//   grammar-proposal.yaml   schema starci/grammar-proposal@1, proposals: [{name, gap, anatomy, tokens, claims, render,
//                           status?}] - render is the isolated render (an .html/.png path relative to the file, or
//                           inline html)
//   grammar-proposal.md     one heading per proposal naming it (the name itself, `Meter` variant `segments`, or
//                           data-grammar-proposal="Meter.segments"), its section stating the gap in DNA, the anatomy,
//                           the tokens, the knowledge rules it claims (rule ids) and an isolated render (an html block
//                           or a render path)
// A proposal missing one of those is no entry: the element that cites it is DRAW_OFF_GRAMMAR_COMPONENT.
//
// A proposal is the owner's to accept, never the drawing worker's and never automatic: interface.draw's draw-review
// ask lists every proposal of the record (question.grammarProposals, their isolated renders among question.assets), the
// job's settle records one `grammar-proposal-filed` ledger event per proposal (status proposed), and `api status`
// lists the workflow's open ones as grammarProposals[] until a grammar lane records `grammar-proposal-resolved`.
//
//   node scripts/work/grammar-proposal.mjs list <file|dir>... [--json]     every proposal found, complete or not
//   node scripts/work/grammar-proposal.mjs check <file|dir>... [--json]    exit 1 when one is incomplete
import fs from 'node:fs';
import path from 'node:path';
import { isMain } from '../lib/is-main.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { sha256File } from '../../engine/digest.mjs';
import { openEventItems } from '../../engine/db/ledger.mjs';
import { isDir, isFile } from './work-io.mjs';

export const GRAMMAR_PROPOSAL_FILED = 'grammar-proposal-filed';
export const GRAMMAR_PROPOSAL_RESOLVED = 'grammar-proposal-resolved';
export const PROPOSAL_FILE_NAMES = Object.freeze(['grammar-proposal.yaml', 'grammar-proposal.yml', 'grammar-proposal.md']);
const PROPOSAL_FIELDS = Object.freeze(['gap', 'anatomy', 'tokens', 'claims', 'render']);
/** A proposal is never accepted by the runtime: it stays proposed until the owner, through a grammar lane, decides. */
export const PROPOSED = 'proposed';

/** Section headings inside a proposal, never a proposal's name. */
const SECTION_WORDS = new Set(['gap', 'why', 'anatomy', 'tokens', 'claims', 'render', 'rules', 'values', 'summary', 'notes', 'rationale', 'a11y', 'accessibility', 'usage', 'example', 'examples']);
const RULE_ID = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+\b/;
const MD_FIELDS = {
  gap: /\bgap\b|\bwhy\b|does not (have|publish|describe)|no (dna|component|variant)|lacks?\b|không có|thiếu/i,
  anatomy: /\banatomy\b|\bslots?\b|\bparts?\b|giải phẫu/i,
  tokens: /\btokens?\b|var\(--|--[a-z][\w-]*|\b\d+px\b/i,
  claims: RULE_ID,
  render: /```\s*html|<(div|section|span|article|button|svg)\b|\.(png|html)\b|isolated render/i,
};

/** The names a markdown heading declares for its proposal. */
function headingNames(raw) {
  const names = new Set();
  for (const q of String(raw).matchAll(/data-grammar-proposal=["']([^"']+)["']/g)) names.add(q[1].trim());
  const heading = String(raw).replace(/[`*]/g, '').trim().replace(/^\d+[.)]\s*/, '');
  const variant = /^([A-Z][\w]*)\s+(?:variant|slot|part)\s+([A-Za-z][\w-]*)/.exec(heading);
  if (variant) names.add(`${variant[1]}.${variant[2]}`);
  if (!names.size) for (const q of String(raw).matchAll(/`([A-Z][\w]*(?:\.[\w-]+)?)`/g)) names.add(q[1]);
  const lead = /^([A-Za-z][\w.-]*)$/.exec(heading.split(/\s+[—–-]\s+|\s*\(|:/)[0].trim());
  if (!names.size && lead && !SECTION_WORDS.has(lead[1].toLowerCase())) names.add(lead[1]);
  return [...names];
}

function markdownProposals(text, file) {
  const lines = String(text).split(/\r?\n/);
  const heads = [];
  lines.forEach((line, i) => { const m = /^(#{1,4})\s+(.+?)\s*$/.exec(line); if (m) heads.push({ level: m[1].length, raw: m[2], line: i }); });
  const out = [];
  for (const [k, h] of heads.entries()) {
    const names = headingNames(h.raw);
    if (!names.length) continue;
    const end = heads.slice(k + 1).find((n) => n.level <= h.level)?.line ?? lines.length;
    const body = lines.slice(h.line + 1, end).join('\n');
    const fields = Object.fromEntries(Object.entries(MD_FIELDS).map(([f, rx]) => [f, rx.test(body) || (f === 'gap' && rx.test(h.raw))]));
    const missing = PROPOSAL_FIELDS.filter((f) => !fields[f]);
    // A heading whose section states none of the fields (a document title over several proposals) is not a proposal.
    if (missing.length === PROPOSAL_FIELDS.length) continue;
    const gap = /(?:^|\n)#{1,4}\s*gap[^\n]*\n+([^\n#]+)/i.exec(body)?.[1] ?? body.split('\n').find((l) => MD_FIELDS.gap.test(l)) ?? '';
    out.push({ name: names[0], names, file, format: 'md', gap: gap.trim().slice(0, 300), claims: [...new Set(body.match(new RegExp(RULE_ID.source, 'g')) ?? [])],
      render: /```\s*html([\s\S]*?)```/i.exec(body)?.[1]?.trim() ?? (/\(([^)]+\.(?:png|html))\)|`([^`]+\.(?:png|html))`/.exec(body)?.slice(1).find(Boolean) ?? null),
      status: PROPOSED, complete: missing.length === 0, missing });
  }
  return out;
}

function yamlProposals(doc, file) {
  const list = Array.isArray(doc?.proposals) ? doc.proposals : doc?.name ? [doc] : [];
  return list.filter((p) => p && typeof p === 'object' && p.name).map((p) => {
    const missing = PROPOSAL_FIELDS.filter((f) => p[f] == null || p[f] === '' || (Array.isArray(p[f]) && !p[f].length && f !== 'tokens'));
    return { name: String(p.name).trim(), names: [String(p.name).trim()], file, format: 'yaml', gap: String(p.gap ?? '').slice(0, 300),
      claims: Array.isArray(p.claims) ? p.claims.map(String) : String(p.claims ?? '').match(new RegExp(RULE_ID.source, 'g')) ?? [],
      render: typeof p.render === 'string' ? p.render : p.render?.path ?? null, status: p.status === PROPOSED || p.status == null ? PROPOSED : String(p.status),
      complete: missing.length === 0, missing };
  });
}

/** Every proposal in the given grammar-proposal files: [{name, names, file, format, gap, claims, render, status, complete, missing}]. */
export function readProposals(files) {
  const out = [];
  for (const file of files ?? []) {
    let text = '';
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    if (/\.ya?ml$/i.test(file)) {
      let doc = null;
      try { doc = parseYaml(text); } catch { doc = null; }
      out.push(...yamlProposals(doc, file));
    } else out.push(...markdownProposals(text, file));
  }
  return out;
}

/** The grammar-proposal files under `dir` (at most `depth` levels, never node_modules or .git). */
export function proposalFilesUnder(dir, depth = 6) {
  const out = [];
  const walk = (d, left) => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) { if (left > 0 && !['node_modules', '.git'].includes(e.name)) walk(full, left - 1); }
      else if (PROPOSAL_FILE_NAMES.includes(e.name)) out.push(full);
    }
  };
  if (isDir(dir)) walk(dir, depth);
  else if (isFile(dir) && PROPOSAL_FILE_NAMES.includes(path.basename(dir))) out.push(dir);
  return out;
}

/** The proposal files among `files` (files or directories). */
function proposalFilesIn(files) {
  const out = new Map();
  for (const f of files ?? []) for (const p of proposalFilesUnder(f)) out.set(path.resolve(p).toLowerCase(), path.resolve(p));
  return [...out.values()];
}

/** The isolated render image of a proposal, when it names a .png that exists. */
export function proposalImageOf(p) {
  if (!p?.render || !/\.png$/i.test(p.render)) return null;
  const abs = path.resolve(path.dirname(p.file), p.render);
  return isFile(abs) ? abs : null;
}

/**
 * Record one `grammar-proposal-filed` event per proposal the job's files carry, once per (name, file sha256):
 * never an acceptance. Returns the proposals newly recorded. `ledger` is an open ledger (appendEvent).
 */
export function recordGrammarProposals(ledger, { job, repo, files, now = Date.now() }) {
  const db = ledger.db;
  const found = readProposals(proposalFilesIn(files));
  const recorded = [];
  for (const p of found) {
    let sha = null;
    try { sha = sha256File(p.file); } catch { sha = null; }
    const rel = path.relative(repo, p.file).replace(/\\/g, '/');
    const seen = db.prepare("SELECT 1 FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.name')=? AND json_extract(payload_json,'$.sha256') IS ? LIMIT 1")
      .get(job.workflow_id, GRAMMAR_PROPOSAL_FILED, p.name, sha);
    if (seen) continue;
    const payload = { name: p.name, file: rel, sha256: sha, jobId: job.job_id, opId: job.op_id, attempt: job.attempt, status: PROPOSED, complete: p.complete,
      ...(p.missing.length ? { missing: p.missing } : {}), gap: p.gap, claims: p.claims, render: p.render && p.render.length < 300 ? p.render : null };
    ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: GRAMMAR_PROPOSAL_FILED, createdAt: now, payload });
    recorded.push(payload);
  }
  return recorded;
}

/** The workflow's open grammar proposals (filed, not resolved): [{name, file, jobId, opId, filedAt, status, complete}]. */
export function openGrammarProposals(db, workflowId) {
  return openEventItems(db, workflowId, {
    owedKind: GRAMMAR_PROPOSAL_FILED, resolvedKind: GRAMMAR_PROPOSAL_RESOLVED, keyOf: (p) => p.name,
    item: (p, row) => ({ name: p.name, file: p.file ?? null, jobId: p.jobId ?? null, opId: p.opId ?? null, filedAt: row.created_at, status: PROPOSED, complete: p.complete !== false }),
  });
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const json = rest.includes('--json');
  const targets = rest.filter((a) => !a.startsWith('--'));
  if (!['list', 'check'].includes(cmd) || !targets.length) {
    process.stderr.write('use: node scripts/work/grammar-proposal.mjs list|check <file|dir>... [--json]\n');
    return 2;
  }
  const proposals = readProposals(proposalFilesIn(targets.map((t) => path.resolve(t))));
  const incomplete = proposals.filter((p) => !p.complete);
  if (json) process.stdout.write(`${JSON.stringify({ ok: cmd === 'list' || !incomplete.length, proposals }, null, 2)}\n`);
  else process.stdout.write(`${proposals.map((p) => `${p.complete ? 'ok  ' : 'INCOMPLETE'} ${p.name} (${path.basename(p.file)})${p.missing.length ? ` missing ${p.missing.join(', ')}` : ''}`).join('\n') || 'no grammar proposals'}\n`);
  return cmd === 'check' && incomplete.length ? 1 : 0;
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
