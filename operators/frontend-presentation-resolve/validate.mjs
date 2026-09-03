// frontend.presentation.resolve's own law over one branch, on top of the shared step check: every rule the
// inventory carries is one @knowledge/ui/presentation actually publishes; every class the inventory
// carries appears in the resolved tree; a Grammar-owned property emits no application class while an
// application-owned one emits a class whose step matches the ordinal of its rule; the gaps the
// receipt lists are exactly the gaps the inventory records; and with emission on every claimed rule
// reaches the tree as a data-contract token, except a rule whose every node the receipt records under
// `## Gaps`, which has no attribute to reach.
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const list = (v) => (Array.isArray(v) ? v : empty(v) ? [] : [v]);

// The scale topics publish an ordinal rule identifier while the utility scale publishes a step
// number, and the two diverge above the fourth value. Writing the ordinal as the class is the defect
// this map exists to catch: GAP-5 renders `gap-6`, never `gap-5`.
const ORDINAL_TO_STEP = { 0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '6', 6: '8' };
const SCALE_PATTERN = {
  GAP: /^gap(?:-[xy])?-([0-9]+)$/,
  PADDING: /^p(?:[xytrbse])?-([0-9]+)$/,
  MARGIN: /^-?m(?:[xytrbse])?-([0-9]+)$/,
};
const prefixOf = (ruleId) => ruleId.slice(0, ruleId.lastIndexOf('-'));
const ordinalOf = (ruleId) => Number(ruleId.slice(ruleId.lastIndexOf('-') + 1));

// The bound inventory is what @knowledge/ui/presentation publishes: one `## PREFIX-n` heading per rule.
export async function publishedRuleIds(root = ROOT) {
  const dir = path.join(root, 'knowledge', 'ui', 'presentation');
  const ids = new Set();
  if (!existsSync(dir)) return ids;
  for (const name of (await readdir(dir)).filter((f) => f.endsWith('.md') && !f.endsWith('.vi.md') && f !== 'INDEX.md')) {
    const text = await readFile(path.join(dir, name), 'utf8');
    for (const m of text.matchAll(/^##\s+([A-Z][A-Z0-9-]*-[0-9]+)\b/gm)) ids.add(m[1]);
  }
  return ids;
}

export async function validateResolutionStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'frontend.presentation.resolve') return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');

  const maxRounds = Number(requirements.maxRounds ?? 2);
  if (!Number.isInteger(maxRounds) || maxRounds < 1) errors.push(`request.json: maxRounds must be a positive whole number, not ${requirements.maxRounds}`);
  const emission = requirements.contractEmission ?? 'on';

  let inventory = null;
  if (present.has('inventory') && has('response/data/inventory.json')) {
    try { inventory = JSON.parse(await read('response/data/inventory.json')); } catch { inventory = null; }
  }
  if (!inventory) {
    if (response.status === 'done') errors.push('response/data/inventory.json: a done branch needs the inventory');
    return { errors };
  }
  const at = 'response/data/inventory.json';

  const published = await publishedRuleIds(root);
  for (const ruleId of inventory.ruleIds) {
    if (!published.has(ruleId)) errors.push(`${at}: rule ${ruleId} is outside the published presentation inventory (UNKNOWN_RULE)`);
  }

  // The receipt is read before the tree, because a rule recorded under `## Gaps` is a rule whose node
  // publishes no path for the attribute: the emission check below must know that before it accuses the
  // tree of hiding a claim that could never have been written.
  const receiptText = present.has('frontend-presentation-resolution') && has('response/response.md') ? await read('response/response.md') : null;
  const gapRows = receiptText === null ? [] : (tableUnder(receiptText, '## Gaps') ?? []);
  const gapNodes = new Set(gapRows.map(([node]) => node));
  const chosenRows = receiptText === null ? [] : (tableUnder(receiptText, '## Rules chosen') ?? []);
  // A rule is exempt only when every node that chose it is a gap node; one ordinary node still owes
  // its attribute.
  const gapOnlyRules = new Set();
  for (const [, rule] of chosenRows) {
    const nodes = chosenRows.filter(([, r]) => r === rule).map(([n]) => n);
    if (nodes.length && nodes.every((n) => gapNodes.has(n))) gapOnlyRules.add(String(rule).replace(/`/g, ''));
  }

  // The resolved tree is the only place the classes may land, so every class the inventory claims
  // must actually be in it.
  const treeRefs = list(response.fields?.['resolved-tree']);
  let tree = null;
  for (const ref of treeRefs) if (has(ref)) tree = await read(ref);
  if (tree === null) { if (response.status === 'done') errors.push('response/artifacts: the resolved tree is missing'); }
  else {
    for (const className of inventory.classNames) {
      if (!tree.includes(className)) errors.push(`${at}: class ${className} is in the inventory and not in the resolved tree`);
    }
    if (emission === 'on') {
      for (const ruleId of inventory.ruleIds) {
        // A property the application owns on a Grammar component's className carries no attribute:
        // the component forwards className and nothing else, so the claim is recorded under `## Gaps`
        // instead of being demanded of a tree that cannot carry it.
        if (gapOnlyRules.has(ruleId)) continue;
        const claimed = [...tree.matchAll(/data-contract="([^"]*)"/g)].some((m) => m[1].split(/\s+/).includes(ruleId));
        if (!claimed) errors.push(`${at}: rule ${ruleId} is applied and no node claims it under data-contract`);
      }
    } else if (/data-contract=/.test(tree)) errors.push('response/artifacts: contract emission is off and the resolved tree carries a data-contract attribute');
  }

  if (receiptText !== null) {
    const text = receiptText;
    const rel = 'response/response.md';
    const owners = tableUnder(text, '## Owner map') ?? [];
    const chosen = chosenRows;
    const removed = tableUnder(text, '## Removed') ?? [];
    const gaps = gapRows;

    const appRules = new Set();
    const grammarRules = new Set();
    const seen = new Set();
    for (const [node, property, owner, rule] of owners) {
      const key = `${node}|${property}`;
      if (seen.has(key)) errors.push(`${rel}: ${node} decides ${property} more than once in the owner map`);
      seen.add(key);
      (owner === 'app' ? appRules : grammarRules).add(`${node}|${rule}`);
    }
    for (const [node, rule, className] of chosen) {
      if (grammarRules.has(`${node}|${rule}`)) { errors.push(`${rel}: ${node} chooses a class for ${rule}, which Grammar already owns`); continue; }
      if (!appRules.has(`${node}|${rule}`)) { errors.push(`${rel}: ${node} chooses ${rule} without an application-owned row in the owner map`); continue; }
      if (!inventory.ruleIds.includes(rule)) errors.push(`${rel}: ${node} chooses ${rule}, which the inventory does not carry`);
      if (!inventory.classNames.includes(className)) errors.push(`${rel}: ${node} writes ${className}, which the inventory does not carry`);
      const pattern = SCALE_PATTERN[prefixOf(rule)];
      if (pattern) {
        const expected = ORDINAL_TO_STEP[ordinalOf(rule)];
        const steps = className.split(/\s+/).map((token) => pattern.exec(token)).filter(Boolean).map((m) => m[1]);
        if (expected !== undefined) {
          if (steps.length === 0) errors.push(`${rel}: ${node} emits no class for ${rule}`);
          else if (!steps.includes(expected)) errors.push(`${rel}: ${node} renders ${rule} as ${className}, expected step ${expected}`);
        }
      }
    }
    for (const key of appRules) {
      const [node, rule] = key.split('|');
      if (!chosen.some(([n, r]) => n === node && r === rule)) errors.push(`${rel}: ${node} owns ${rule} and chooses no class for it`);
    }
    for (const [node, className] of removed) {
      if (inventory.classNames.includes(className)) errors.push(`${rel}: ${node} removed ${className} and the inventory still carries it`);
    }

    // The gaps a reader sees and the gaps the machine carries are one list.
    const receiptGaps = gaps.map(([node, property, missing]) => `${node}|${property}|${missing}`).sort();
    const dataGaps = inventory.gaps.map((g) => `${g.nodePath}|${g.property}|${g.missingPath}`).sort();
    if (receiptGaps.join('\n') !== dataGaps.join('\n')) {
      // Two counts say nothing about which row is wrong, so the first row that differs is named.
      const width = Math.max(receiptGaps.length, dataGaps.length);
      let first = 0;
      while (first < width && receiptGaps[first] === dataGaps[first]) first += 1;
      errors.push(`${rel}: the Gaps table and inventory.gaps differ (${receiptGaps.length} rows against ${dataGaps.length}); the first differing row is the receipt's ${receiptGaps[first] ?? '(absent)'} against the inventory's ${dataGaps[first] ?? '(absent)'}`);
    }
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateResolutionStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid frontend.presentation.resolve branch\n');
}
