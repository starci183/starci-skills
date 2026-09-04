// The findings ledger, read back into law: `node scripts/promote-findings.mjs` collects the open
// findings whose `rule` is null — a failure no published rule covers — groups them by family and by
// the code or the statement they share, and for every group seen in at least two distinct sessions
// drafts knowledge/findings/proposals/<slug>.md in the rule shape the proof topics use
// (Case | When | Observe) with an evidence note stub under tests/evidence/, for a person to approve.
// It never writes into knowledge/ui/: a proposal becomes law only when a person authors the rule
// under UPDATE.md, and a proposal that already exists is never overwritten. A draft carries no rule
// heading and cites no ordinal, so the citation gate that reads knowledge/ does not read a draft as a
// published rule. knowledge/findings/INDEX.md states the law.
//
//   node scripts/promote-findings.mjs [--ledger <dir>] [--proposals <dir>] [--evidence <dir>] [--min <n>] [--dry]
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { readLedger, openLines, LEDGER_DIR, nodeOf } from './record-findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROPOSALS_DIR = path.join(LEDGER_DIR, 'proposals');
export const EVIDENCE_DIR = path.join('tests', 'evidence');
export const MIN_SESSIONS = 2;
const RULE_HEADING = /^## [A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d+\b/m;

// The topic a rule-less finding is about: its code when it carries one, else the statement past its
// node, lowercased with everything but letters and digits folded to one space.
export const normalize = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const topicOf = (line) => (line.code ? `code:${line.code}` : `statement:${normalize(line.statement.slice(nodeOf(line.statement).length + 2))}`);
export const slugOf = (family, topic) => `${family}-${normalize(topic.replace(/^(code|statement):/, '')).replace(/ /g, '-')}`.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 64).replace(/-$/, '');

// The groups a ledger yields: open, rule-less findings by family and topic, with the distinct sessions
// that saw each; only groups seen in `min` sessions are candidates.
export async function collectCandidates(ledgerDir, { min = MIN_SESSIONS } = {}) {
  const groups = new Map();
  if (!existsSync(ledgerDir)) return [];
  for (const name of readdirSync(ledgerDir).filter((f) => f.endsWith('.jsonl')).sort()) {
    const family = name.replace(/\.jsonl$/, '');
    const ledger = await readLedger(path.join(ledgerDir, name));
    for (const line of openLines(ledger)) {
      if (line.rule !== null) continue;
      const topic = topicOf(line);
      const key = `${family}|${topic}`;
      if (!groups.has(key)) groups.set(key, { family, topic, slug: slugOf(family, topic), lines: [], sessions: new Set() });
      const g = groups.get(key);
      g.lines.push(line);
      g.sessions.add(line.session);
    }
  }
  return [...groups.values()].filter((g) => g.sessions.size >= min).sort((a, b) => a.slug.localeCompare(b.slug));
}

const cell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
export function renderProposal(group, { date, evidenceRel }) {
  const first = group.lines[0];
  const instrument = first.operator === 'uat.verify' ? 'a walk of the running product' : 'a capture of the rendered surface';
  const what = group.topic.startsWith('code:') ? `the receipt coded it \`${first.code}\`` : `the receipts stated it as "${first.statement.slice(nodeOf(first.statement).length + 2)}"`;
  return [
    `# Proposal — ${group.slug}`,
    '',
    `Drafted by \`scripts/promote-findings.mjs\` on ${date} from the findings ledger of the \`${group.family}\` family. Not law: a`,
    'person authors the rule under `UPDATE.md`, in the topic whose reader binds it, with the next ordinal of',
    `that topic's prefix, and the occurrences below as its evidence. This group was seen in ${group.sessions.size} sessions`,
    `(${group.lines.length} findings), which is the bar a rule needs; no published rule covers it, and ${what}.`,
    '',
    '## Where it was seen',
    '',
    '| Session | Branch | Operator | Surface | Unit | Statement |',
    '| --- | --- | --- | --- | --- | --- |',
    ...group.lines.map((l) => `| ${cell(l.session)} | ${cell(l.branch)} | \`${l.operator}\` | ${cell(l.surface)} | ${cell(l.unit)} | ${cell(l.statement)} |`),
    '',
    '## Proposed rule',
    '',
    `Topic: to be chosen by the person — the finding was recorded by \`${first.operator}\` from ${instrument}, so a proof topic`,
    'is the likely home; the prefix and the ordinal are assigned when the rule is authored, never here.',
    '',
    `Governs ${group.topic.startsWith('code:') ? `what the receipts code as \`${first.code}\`` : 'what the receipts observed'}.`,
    '',
    '| Case | When | Observe |',
    '| --- | --- | --- |',
    `| Case 1 | ${cell(instrument === 'a walk of the running product' ? 'The run reaches the step the occurrences name' : 'The capture is measured at the node the occurrences name')} | ${cell(first.statement.slice(nodeOf(first.statement).length + 2))}; state here what seeing it falsifies, in the shape the topic's other rules use |`,
    '',
    `Sources: [the evidence note](../../../${evidenceRel}), which lists every occurrence above with its session and branch.`,
    '',
  ].join('\n');
}
export function renderEvidence(group, { date }) {
  return [
    `# Evidence — findings promoted for \`${group.slug}\`, ${date}`,
    '',
    `Occurrences of one rule-less finding in the \`${group.family}\` ledger, seen in ${group.sessions.size} distinct sessions, collected by`,
    '`scripts/promote-findings.mjs`. Evidence is allowed to be concrete: the sessions, branches and statements are as the ledger holds them.',
    '',
    '| Session | Branch | Operator | Surface | Unit | Recorded at | Statement |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...group.lines.map((l) => `| ${cell(l.session)} | ${cell(l.branch)} | \`${l.operator}\` | ${cell(l.surface)} | ${cell(l.unit)} | ${cell(l.at)} | ${cell(l.statement)} |`),
    '',
  ].join('\n');
}

export async function promoteFindings({ root = ROOT, ledgerDir = path.join(root, LEDGER_DIR), proposalsDir = path.join(root, PROPOSALS_DIR), evidenceDir = path.join(root, EVIDENCE_DIR), min = MIN_SESSIONS, date = new Date().toISOString().slice(0, 10), dry = false } = {}) {
  const uiDir = path.resolve(root, 'knowledge', 'ui');
  for (const dir of [proposalsDir, evidenceDir]) if (path.resolve(dir).startsWith(uiDir + path.sep) || path.resolve(dir) === uiDir) throw new Error(`${dir}: proposals and evidence are never written into knowledge/ui/`);
  const candidates = await collectCandidates(ledgerDir, { min });
  const out = [];
  for (const group of candidates) {
    const proposal = path.join(proposalsDir, `${group.slug}.md`);
    const evidenceName = `${date.replace(/-/g, '')}-findings-${group.slug}.md`;
    const evidence = path.join(evidenceDir, evidenceName);
    const evidenceRel = path.join(EVIDENCE_DIR, evidenceName).split(path.sep).join('/');
    if (existsSync(proposal)) { out.push({ slug: group.slug, proposal, evidence, written: false, reason: 'exists' }); continue; }
    const text = renderProposal(group, { date, evidenceRel });
    if (RULE_HEADING.test(text)) throw new Error(`${proposal}: a draft may not carry a rule heading`);
    if (!dry) {
      mkdirSync(proposalsDir, { recursive: true });
      mkdirSync(evidenceDir, { recursive: true });
      writeFileSync(proposal, text);
      if (!existsSync(evidence)) writeFileSync(evidence, renderEvidence(group, { date }));
    }
    out.push({ slug: group.slug, proposal, evidence, written: !dry, reason: dry ? 'dry' : 'drafted' });
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };
  promoteFindings({ ledgerDir: opt('--ledger'), proposalsDir: opt('--proposals'), evidenceDir: opt('--evidence'), min: opt('--min') ? Number(opt('--min')) : undefined, dry: args.includes('--dry') }).then((results) => {
    if (!results.length) { process.stdout.write('promote-findings: no rule-less finding seen in enough sessions\n'); return; }
    for (const r of results) process.stdout.write(`${r.reason}: ${path.relative(ROOT, r.proposal).split(path.sep).join('/')}${r.written ? ` (+ ${path.relative(ROOT, r.evidence).split(path.sep).join('/')})` : ''}\n`);
  }, (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
