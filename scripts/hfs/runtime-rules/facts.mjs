// facts.mjs - RT_FACT_FALSE (knowledge/hfs/rules.yaml, gate runtime): the machine-evaluated claims of knowledge/hfs/facts.yaml.
// A fact names a slot of knowledge/hfs/slots.yaml (the one source of the product shape) and what the slot must say
// (`requires` an entry, or a `presence`); it is false when the slot does not say it. Prose that states the opposite is false
// too: a line of knowledge/**, docs/** or a README that matches a `contradicts` pattern with its `near` pattern on the line or
// within the three lines above it is a finding, unless the line itself matches `unless` (a back-end line). Generated copies and the facts file itself are not prose. Pure apart from ctx.read.
import { parseYaml } from '../../../engine/yaml.mjs';
import { loadSlotManifest } from '../slots.mjs';

export const CODE = 'RT_FACT_FALSE';
const FACTS_FILE = 'knowledge/hfs/facts.yaml';
const PROSE = /^(?:knowledge\/.+\.(?:ya?ml|md)|docs\/.+\.md|(?:.+\/)?README\.md)$/;
const NEAR_LINES = 3;

const finding = (file, line, message) => {
  const location = line ? `:${line}` : '';
  return { code: CODE, level: 'error', path: file, ...(line ? { line } : {}), message: `${CODE} ${file}${location}: ${message}` };
};

/** The problem a fact's slot evaluation finds in `manifest`, or null when the fact holds. */
export function slotProblem(fact, manifest) {
  const want = fact.slot ?? {};
  const slot = manifest.slots.find((entry) => entry.id === want.id);
  if (!slot) return `fact ${fact.id} names slot ${want.id}, which slots.yaml does not declare`;
  if (want.requires !== undefined && !(slot.requires ?? []).includes(want.requires)) return `fact ${fact.id} (${fact.claim}) is false: slot ${slot.id} does not require ${want.requires}`;
  if (want.presence !== undefined && slot.presence !== want.presence) return `fact ${fact.id} (${fact.claim}) is false: slot ${slot.id} presence is ${slot.presence}, not ${want.presence}`;
  return null;
}

/** The lines of `text` that contradict `fact`, as [{line, pattern}]. */
export function contradictions(fact, text) {
  const lines = text.split('\n');
  const found = [];
  for (const rule of fact.contradicts ?? []) {
    const pattern = new RegExp(rule.pattern, 'i');
    const near = rule.near ? new RegExp(rule.near, 'i') : null;
    const unless = rule.unless ? new RegExp(rule.unless, 'i') : null;
    lines.forEach((line, index) => {
      if (!pattern.test(line) || unless?.test(line)) return;
      const window = lines.slice(Math.max(0, index - NEAR_LINES), index + 1).join('\n');
      if (!near || near.test(window)) found.push({ line: index + 1, pattern: rule.pattern });
    });
  }
  return found;
}

/** RT_FACT_FALSE over the facts file, the product manifest and every tracked prose file (ctx of scripts/hfs/runtime-check.mjs). */
export function factFindings(ctx) {
  const text = ctx.read(FACTS_FILE);
  if (text === null || text === undefined) return [finding(FACTS_FILE, 0, 'the facts file is missing: the knowledge has no machine-evaluated claims')];
  const doc = parseYaml(text);
  const facts = doc?.facts ?? [];
  const manifest = loadSlotManifest({ root: ctx.root });
  const generated = (ctx.params.generated ?? []).map((entry) => `${entry.root}/`);
  const found = [];
  for (const fact of facts) {
    const problem = slotProblem(fact, manifest);
    if (problem) found.push(finding(FACTS_FILE, 0, problem));
  }
  for (const file of ctx.files) {
    if (file === FACTS_FILE || !PROSE.test(file) || generated.some((root) => file.startsWith(root))) continue;
    const prose = ctx.read(file);
    if (prose === null || prose === undefined) continue;
    for (const fact of facts) {
      for (const hit of contradictions(fact, prose)) found.push(finding(file, hit.line, `states the opposite of fact ${fact.id} (${fact.claim}); delete the sentence and quote the fact id or the slot`));
    }
  }
  return found;
}
