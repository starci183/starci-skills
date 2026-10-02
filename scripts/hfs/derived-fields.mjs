// derived-fields.mjs - the fields of the knowledge that are DERIVED, never typed (RT_GENERATED_BLOCK_STALE, rule R194).
//   - a pattern rule's `verification.automated` list is the failure codes of the rules its `hfsRules` names (rules.yaml);
//   - a `files:` entry's `slot` of a back-end pattern topic is the slot that owns its `path` (slots.yaml);
//   - the `code` of a lint rule's entry in a `why` map (packages/eslint/fe/lib/why.mjs, packages/stylelint/lib/why.mjs) is the code of
//     the catalog rule that lists the lint rule as its enforcer.
// `node scripts/hfs/derived-fields.mjs --write` rewrites them in place, `--check` (the default) lists the files that differ.
// A typed value that names a code or an enforcer a catalog rule owns adds that rule to `hfsRules` once, so nothing a pattern
// verified by hand is lost; a typed value no rule owns is reported and never silently dropped. Pure text in, text out.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { gitOutputOf } from '../lib/git.mjs';
import { isMain } from '../lib/is-main.mjs';
import { loadRuleCatalog, loadSlotManifest } from './slots.mjs';

const PATTERN_DIRS = Object.freeze(['be', 'fe', 'repo']);
export const WHY_FILES = Object.freeze([
  { file: 'packages/eslint/fe/lib/why.mjs', kind: 'eslint-fe' },
  { file: 'packages/stylelint/lib/why.mjs', kind: 'stylelint' },
]);
const RULE_NUMBER = (id) => Number(id.slice(1));

/** The catalog lookups the derivations share: owner of a code, owner of an enforcer id, failure codes of a rule. */
export function catalogIndex(catalog) {
  const byCode = new Map(catalog.rules.flatMap((rule) => rule.failureCodes.map((code) => [code, rule.id])));
  const byEnforcer = new Map(catalog.rules.flatMap((rule) => rule.enforcers.map((enforcer) => [`${enforcer.kind}:${enforcer.id}`, rule.id])));
  const codesOf = new Map(catalog.rules.map((rule) => [rule.id, rule.failureCodes]));
  return { byCode, byEnforcer, codesOf };
}

const unquote = (item) => item.trim().replace(/^["']|["']$/g, '');

/** The rule that owns one typed verification item (a failure code, `starci-fe/<id>`, `starci-be/<id>`, a stylelint id), or null. */
function ownerOfItem(item, index, kinds) {
  const value = unquote(item);
  if (index.byCode.has(value)) return index.byCode.get(value);
  const [plugin, id] = value.split('/');
  const kind = { 'starci-be': 'eslint-be', 'starci-fe': 'eslint-fe' }[plugin];
  if (kind && index.byEnforcer.has(`${kind}:${id}`)) return index.byEnforcer.get(`${kind}:${id}`);
  return kinds.map((k) => index.byEnforcer.get(`${k}:${value}`)).find(Boolean) ?? null;
}

/**
 * `text` of a pattern topic with every rule's `hfsRules` completed and `verification.automated` rewritten from the catalog.
 * Returns { text, unowned: [{rule, item}] }: the typed items no catalog rule owns (left out of the list, reported).
 */
export function derivePatternVerification(text, index, kinds = []) {
  const lines = text.split('\n');
  const unowned = [];
  const starts = lines.map((line, i) => (/^ {2}- id: /.test(line) ? i : -1)).filter((i) => i >= 0);
  // Bottom-up, so a rewritten block never moves the lines of the blocks above it.
  for (let s = starts.length - 1; s >= 0; s -= 1) {
    const from = starts[s];
    const to = s + 1 < starts.length ? starts[s + 1] : lines.length;
    const ruleId = lines[from].replace(/^ {2}- id: /, '').trim();
    const rulesAt = lines.findIndex((line, i) => i >= from && i < to && /^ {4}hfsRules: \[/.test(line));
    const autoAt = lines.findIndex((line, i) => i >= from && i < to && /^ {6}automated:/.test(line));
    if (rulesAt < 0 || autoAt < 0) continue;
    let end = autoAt + 1;
    while (end < to && /^ {8}- /.test(lines[end])) end += 1;
    const typed = lines.slice(autoAt + 1, end).map((line) => line.replace(/^ {8}- /, ''));
    const rules = lines[rulesAt].replace(/^ {4}hfsRules: \[/, '').replace(/\].*$/, '').split(',').map((r) => r.trim()).filter(Boolean);
    const added = [];
    for (const item of typed) {
      const owner = ownerOfItem(item, index, kinds);
      if (owner === null) unowned.push({ rule: ruleId, item: unquote(item) });
      else if (!rules.includes(owner) && !added.includes(owner)) added.push(owner);
    }
    const complete = [...rules, ...added.sort((a, b) => RULE_NUMBER(a) - RULE_NUMBER(b))];
    const derived = [...new Set(complete.flatMap((id) => index.codesOf.get(id) ?? []))];
    lines[rulesAt] = `    hfsRules: [${complete.join(', ')}]`;
    lines.splice(autoAt, end - autoAt, ...(derived.length ? ['      automated:', ...derived.map((code) => `        - ${code}`)] : ['      automated: []']));
  }
  return { text: lines.join('\n'), unowned };
}

/** `text` of a pattern topic with the `slot` of every `files:` entry set to the slot that owns its path. `classify(path)` -> slot id or null. */
export function deriveFilesSlots(text, classify) {
  const lines = text.split('\n');
  const problems = [];
  const filesAt = lines.findIndex((line) => /^files:\s*$/.test(line));
  if (filesAt < 0) return { text, problems };
  for (let i = filesAt + 1; i < lines.length; i += 1) {
    const match = /^ {2}- path: (.+)$/.exec(lines[i]);
    if (!match) continue;
    const slotAt = lines.findIndex((line, k) => k > i && /^ {4}slot: /.test(line) && k < i + 8);
    if (slotAt < 0) { problems.push(`${match[1]} has no slot line`); continue; }
    const slot = classify(match[1].trim());
    if (!slot) { problems.push(`${match[1]} is owned by no slot`); continue; }
    lines[slotAt] = `    slot: ${slot}`;
  }
  return { text: lines.join('\n'), problems };
}

/** `text` of a why map with the `code` of each entry set from the catalog; `kind` is the enforcer kind of the plugin. */
export function deriveWhyCodes(text, index, kind) {
  const lines = text.split('\n');
  const problems = [];
  let current = null;
  lines.forEach((line, i) => {
    const entry = /^ {2}"([^"]+)": \{\s*$/.exec(line);
    if (entry) { current = entry[1]; return; }
    const code = /^ {4}code: "([^"]+)",$/.exec(line);
    if (!code || current === null) return;
    const owner = index.byEnforcer.get(`${kind}:${current}`);
    const derived = owner ? index.codesOf.get(owner)?.find((c) => c === code[1]) ?? index.codesOf.get(owner)?.[0] : null;
    if (!derived) { problems.push(`${current} is the enforcer of no catalog rule`); return; }
    lines[i] = `    code: "${derived}",`;
  });
  return { text: lines.join('\n'), problems };
}

/**
 * Every derived file among `files` (tracked repository paths, read through `read`): [{file, before, after, problems}] — `after`
 * differs from `before` when the file is stale. `classify` (path -> slot id) enables the `files:` slot derivation; null skips it.
 */
export function derivedFiles({ files, read, catalog, classify }) {
  const index = catalogIndex(catalog);
  const out = [];
  for (const dir of PATTERN_DIRS) {
    for (const file of files.filter((f) => new RegExp(`^knowledge/patterns/${dir}/[^/]+\\.yaml$`).test(f)).sort()) {
      const before = read(file);
      if (before === null || before === undefined) continue;
      const verification = derivePatternVerification(before, index, { be: ['eslint-be'], fe: ['eslint-fe', 'stylelint'], repo: [] }[dir]);
      const slots = dir === 'be' && classify ? deriveFilesSlots(verification.text, classify) : { text: verification.text, problems: [] };
      out.push({ file, before, after: slots.text, problems: [...verification.unowned.map((u) => `${u.rule}: ${u.item} is owned by no catalog rule`), ...slots.problems] });
    }
  }
  for (const { file, kind } of WHY_FILES) {
    const before = files.includes(file) ? read(file) : null;
    if (before === null || before === undefined) continue;
    const why = deriveWhyCodes(before, index, kind);
    out.push({ file, before, after: why.text, problems: why.problems });
  }
  return out;
}

if (isMain(import.meta.url)) {
  const root = skillRoot;
  const { createProseResolver, sample } = await import('./runtime-rules/prose-path.mjs');
  const manifest = loadSlotManifest({ root });
  const examples = ['examples/ecommerce-app/hfs.json'].filter((f) => fs.existsSync(path.join(root, f)));
  const resolver = createProseResolver({ files: examples, read: (f) => fs.readFileSync(path.join(root, f), 'utf8') }, manifest);
  const classify = (p) => resolver.classify(`be/${sample(p.replace(/<kind>/g, 'api'))}`).slot ?? null;
  const files = gitOutputOf(lsFiles([], { dir: root, maxBuffer: 1 << 28 }), 'git ls-files').split('\n').filter(Boolean);
  const stale = derivedFiles({ files, read: (f) => fs.readFileSync(path.join(root, f), 'utf8'), catalog: loadRuleCatalog({ root }), classify });
  const write = process.argv.includes('--write');
  let problems = 0;
  for (const item of stale) {
    for (const problem of item.problems) { process.stdout.write(`${item.file}: ${problem}\n`); problems += 1; }
    if (item.after !== item.before) {
      if (write) fs.writeFileSync(path.join(root, item.file), item.after);
      else process.stdout.write(`stale: ${item.file}\n`);
    }
  }
  process.exitCode = problems || (!write && stale.some((item) => item.after !== item.before)) ? 1 : 0;
}
