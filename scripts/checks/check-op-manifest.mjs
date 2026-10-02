#!/usr/bin/env node
// check-op-manifest.mjs — every modules/ops/ops/<id>.yaml holds the one shape
// modules/schemas/op.schema.yaml describes, plus the five rules a JSON schema
// cannot express:
//
//   PARAM_RESTATED  a step/proof spells out a number the op already carries as a param
//   RULE_DUPLICATED the same sentence (normalized, >= 12 words) appears twice in one op
//   RULE_IN_DATA    a reads[].purpose carries a rule (must/never/only/reject) instead of data
//   PATH_JOINED     a writes[].path joins several paths with ' + '
//   CHECK_MISSING   a proofs[].check names a file that is not on disk
//   PARAM_DEFAULT   a param carries both a default and `required: true`, or neither
//   SCHEMA_INVALID  the manifest breaks modules/schemas/op.schema.yaml
//
//   starci runtime check --only op-manifest -- [--opsDir <dir>] [--json]
//
// Exit 0 is clean; any finding exits 1.
import fs from 'node:fs';
import path from 'node:path';
import { isMain } from '../lib/is-main.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { mergeOpShared, opSharedOf } from '../lib/op-shared.mjs';
import { validateAgainstSchema } from '../lib/json-schema.mjs';

const SCHEMA_FILE = 'modules/schemas/op.schema.yaml';

// -------------------------------------------------------------------- prose
const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
// The units a param can carry. Each entry is the stem the prose spells and the
// stems a param name or doc uses for the same meaning.
const UNITS = [
  { unit: 'candidate', prose: 'candidates?', stems: ['candidate'] },
  { unit: 'round', prose: 'rounds?', stems: ['round'] },
  { unit: 'screen', prose: 'screens?', stems: ['screen'] },
  { unit: 'image', prose: 'images?', stems: ['image'] },
  { unit: 'attempt', prose: 'attempts?', stems: ['attempt'] },
  { unit: 'retry', prose: 'retries', stems: ['retry', 'retries'] },
  { unit: 'file', prose: 'files', stems: ['file'] },
  { unit: 'option', prose: 'options', stems: ['option'] },
];
// `five rounds` and `five-round` are the same restatement.
const NUMBER_RE = new RegExp(
  `\\b(${NUMBER_WORDS.join('|')}|\\d+)[\\s-]+(${UNITS.map((u) => u.prose).join('|')})\\b`, 'gi');

const flatten = (s) => String(s).replace(/\s+/g, ' ').trim();
const normalize = (s) => flatten(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const wordCount = (s) => (s ? s.split(' ').length : 0);

/** Sentences of a prose blob. Abbreviated ids (`1..5`, `evidence/x.json`) keep their
 *  dots, so the split needs a following space and a capital or backtick. */
const sentencesOf = (text) => flatten(text)
  .split(/(?<=[.!?])\s+(?=[A-Z`])/)
  .map((s) => s.trim())
  .filter(Boolean);

/** Every prose string in the document, with the key path that holds it. Prose is
 *  what sits under an `en` key — a path, a field name or a policy token is data,
 *  and two entries naming the same data are not one rule written twice. */
function proseStrings(node, at = '$', out = []) {
  if (typeof node === 'string') { if (at.endsWith('.en')) out.push({ at, text: node }); }
  else if (Array.isArray(node)) node.forEach((item, i) => proseStrings(item, `${at}[${i}]`, out));
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) proseStrings(v, at === '$' ? `$.${k}` : `${at}.${k}`, out);
  return out;
}

/** Which units this op's params already carry — a param covers a unit when its
 *  name or its doc names the same thing. */
function unitsCoveredBy(params) {
  const covered = new Set();
  for (const [name, def] of Object.entries(params ?? {})) {
    const text = `${String(name).replace(/([a-z0-9])([A-Z])/g, '$1 $2')} ${def?.doc?.en ?? ''}`.toLowerCase();
    for (const { unit, stems } of UNITS) if (stems.some((stem) => text.includes(stem))) covered.add(unit);
  }
  return covered;
}

const unitOf = (word) => {
  const w = String(word).toLowerCase();
  return UNITS.find(({ unit, stems }) => stems.includes(w) || stems.includes(w.replace(/s$/, '')) || unit === w.replace(/s$/, ''))?.unit ?? null;
};

// -------------------------------------------------------------------- rules
export function checkOpManifest({ root = skillRoot, opsDir } = {}) {
  const dir = opsDir ? path.resolve(opsDir) : path.join(root, 'modules', 'ops', 'ops');
  const schemaFile = path.join(root, SCHEMA_FILE);
  const findings = [];
  const add = (op, code, level, message) => findings.push({ op, code, level, message });

  if (!fs.existsSync(schemaFile)) return { ok: false, opCount: 0, findings: [{ op: '-', code: 'SCHEMA_MISSING', level: 'error', message: `${SCHEMA_FILE} is not on disk` }] };
  const schema = parseYaml(fs.readFileSync(schemaFile, 'utf8'));

  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.yaml') && !f.startsWith('_')).sort()
    : [];
  if (!files.length) return { ok: false, opCount: 0, findings: [{ op: '-', code: 'SCHEMA_MISSING', level: 'error', message: `no op manifests under ${dir}` }] };

  for (const file of files) {
    const id = file.replace(/\.yaml$/, '');
    let doc;
    try { doc = parseYaml(fs.readFileSync(path.join(dir, file), 'utf8')); }
    catch (e) { add(id, 'SCHEMA_INVALID', 'error', `unparseable: ${e.message}`); continue; }

    for (const error of validateAgainstSchema(doc, schema)) add(id, 'SCHEMA_INVALID', 'error', error);
    if (doc?.id && doc.id !== id) add(id, 'SCHEMA_INVALID', 'error', `$.id is ${doc.id} but the file is ${file}`);

    // `shared:` markers expand to the _common.yaml fragments — the rules below
    // judge the effective manifest text, not the stub (scripts/lib/op-shared.mjs).
    let full;
    try { full = mergeOpShared(doc, opSharedOf(dir)); }
    catch (e) { add(id, 'SCHEMA_INVALID', 'error', `shared fragment: ${e.message}`); continue; }

    // PARAM_DEFAULT — a param either has a value that stands when nobody sets it, or is required
    // of its setter at enqueue; a JSON schema walker without oneOf cannot say "exactly one".
    for (const [name, def] of Object.entries(full?.params && typeof full.params === 'object' ? full.params : {})) {
      const hasDefault = Object.hasOwn(def ?? {}, 'default'), required = def?.required === true;
      if (hasDefault === required) add(id, 'PARAM_DEFAULT', 'error', `params.${name} ${hasDefault ? 'carries both a default and required: true' : 'carries neither a default nor required: true'} — exactly one`);
    }

    // (a) PARAM_RESTATED — a tunable's value spelled out in prose the agent reads as law.
    const covered = unitsCoveredBy(full?.params);
    if (covered.size) {
      const proseFields = [
        ...(Array.isArray(full?.steps) ? full.steps.map((s, i) => ({ at: `steps[${i}].action.en`, text: s?.action?.en })) : []),
        ...(Array.isArray(full?.proofs) ? full.proofs.map((p, i) => ({ at: `proofs[${i}].requirement.en`, text: p?.requirement?.en })) : []),
      ];
      for (const { at, text } of proseFields) {
        if (typeof text !== 'string') continue;
        for (const match of flatten(text).matchAll(NUMBER_RE)) {
          const unit = unitOf(match[2]);
          if (unit && covered.has(unit)) add(id, 'PARAM_RESTATED', 'error', `${at}: "${match[0]}" restates a value params already carry — cite params.<name>`);
        }
      }
    }

    // (b) RULE_DUPLICATED — one rule, one place.
    const seen = new Map();
    for (const { at, text } of proseStrings(full)) {
      for (const sentence of sentencesOf(text)) {
        const key = normalize(sentence);
        if (wordCount(key) < 12) continue;
        if (seen.has(key)) add(id, 'RULE_DUPLICATED', 'error', `${at} repeats ${seen.get(key)}: "${flatten(sentence).slice(0, 90)}…"`);
        else seen.set(key, at);
      }
    }

    // (c) RULE_IN_DATA — reads describe data; the rule belongs to the step.
    for (const [i, read] of (Array.isArray(full?.reads) ? full.reads : []).entries()) {
      const purpose = read?.purpose?.en;
      if (typeof purpose !== 'string') continue;
      // A hyphenated compound is a name, not a rule: `read-only` access is data.
      const words = [...new Set([...purpose.matchAll(/(?<![-\w])(must|never|only|reject)(?![-\w])/gi)].map((m) => m[1].toLowerCase()))];
      if (words.length) add(id, 'RULE_IN_DATA', 'warn', `reads[${i}] (${read?.id ?? '?'}).purpose.en carries a rule (${words.join(', ')}) — move it to the step that applies it`);
    }

    // (d) PATH_JOINED — one write entry, one path.
    for (const [i, write] of (Array.isArray(full?.writes) ? full.writes : []).entries()) {
      if (typeof write?.path === 'string' && write.path.includes(' + ')) add(id, 'PATH_JOINED', 'error', `writes[${i}] (${write?.id ?? '?'}).path joins several paths with ' + ' — one path (or one glob) per entry`);
    }

    // (e) CHECK_MISSING — a claim that executes.
    for (const [i, proof] of (Array.isArray(full?.proofs) ? full.proofs : []).entries()) {
      const check = proof?.check;
      if (typeof check !== 'string' || !check.trim()) continue;
      if (!fs.existsSync(path.join(root, check))) add(id, 'CHECK_MISSING', 'error', `proofs[${i}] (${proof?.id ?? '?'}).check names ${check}, which is not on disk`);
    }
  }

  return { ok: findings.length === 0, opCount: files.length, findings };
}

export function opManifestMain(argv = []) {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { exitCode: 0, text: 'Usage: starci runtime check --only op-manifest -- [--opsDir <dir>] [--json]\n\nEvery modules/ops/ops/<id>.yaml holds the modules/schemas/op.schema.yaml shape, gives each param a default or required: true, keeps each rule in one step, cites params instead of restating numbers, keeps rules out of reads[].purpose, writes one path per entry and cites only checks that exist. Exit 0 is clean.\n' };
  }
  const i = argv.indexOf('--opsDir');
  const result = checkOpManifest(i >= 0 ? { opsDir: argv[i + 1] } : {});
  if (argv.includes('--json')) {
    return {
      exitCode: result.ok ? 0 : 1,
      text: `${JSON.stringify({ schema: 'starci/op-manifest-check@1', ok: result.ok, opCount: result.opCount, findings: result.findings }, null, 2)}\n`,
    };
  }
  if (result.ok) return { exitCode: 0, text: `OK: ${result.opCount} op manifests hold starci/op@1.\n` };
  const counts = {};
  for (const f of result.findings) counts[f.code] = (counts[f.code] ?? 0) + 1;
  const lines = result.findings.map((f) => `  ${f.op}  [${f.code}] ${f.message}`);
  const tally = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([code, n]) => `${code}=${n}`).join(' ');
  return { exitCode: 1, text: `${lines.join('\n')}\nFAIL: ${result.findings.length} finding(s) across ${result.opCount} op manifests — ${tally}\n` };
}

if (isMain(import.meta.url)) {
  const result = opManifestMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
