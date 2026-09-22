// Helpers for asserting what an op manifest SAYS, not how it worded it.
//
// A contract spec that pins a sentence turns every rewording into a red test and
// every red test into a reason not to rewrite. These helpers assert structure —
// the sections, the params, the proof ids, the blocker codes — and, for a rule
// whose presence matters, that the manifest states it exactly once: a sentence
// carrying every distinctive term of the rule, found in one place and no other.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';

export const root = path.resolve(import.meta.dirname, '..', '..');
export const opsDir = path.join(root, 'modules', 'ops', 'ops');

export const loadOp = (id) => parseYaml(fs.readFileSync(path.join(opsDir, `${id}.yaml`), 'utf8'));
export const opIds = () => fs.readdirSync(opsDir).filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, '')).sort();

const flatten = (s) => String(s).replace(/\s+/g, ' ').trim();
const sentencesOf = (text) => flatten(text).split(/(?<=[.!?])\s+(?=[A-Z`])/).map((s) => s.trim()).filter(Boolean);

/** Every prose sentence in the manifest, with the section that holds it. */
export function sentences(doc, at = '$', out = []) {
  if (typeof doc === 'string') { if (at.endsWith('.en')) for (const s of sentencesOf(doc)) out.push({ at, text: s }); }
  else if (Array.isArray(doc)) doc.forEach((item, i) => sentences(item, `${at}[${i}]`, out));
  else if (doc && typeof doc === 'object') for (const [k, v] of Object.entries(doc)) sentences(v, at === '$' ? `$.${k}` : `${at}.${k}`, out);
  return out;
}

const holds = (text, terms) => { const low = text.toLowerCase(); return terms.every((t) => low.includes(String(t).toLowerCase())); };

/** The sentences that carry every one of `terms`, optionally inside one section
 *  (a `$.` prefix such as `$.steps` or `$.proofs`). */
export function sentencesStating(doc, terms, { section } = {}) {
  return sentences(doc).filter((s) => (!section || s.at.startsWith(section)) && holds(s.text, terms));
}

/** Assert the manifest states a rule exactly once. `terms` are the words that
 *  make the rule that rule; the sentence around them may be rewritten freely. */
export function statesOnce(assert, doc, terms, { section, label = terms.join(' + ') } = {}) {
  const hits = sentencesStating(doc, terms, { section });
  assert.equal(hits.length, 1,
    `${doc.id} should state "${label}" exactly once${section ? ` under ${section}` : ''}, found ${hits.length}${hits.length ? `:\n${hits.map((h) => `  ${h.at}: ${h.text.slice(0, 110)}`).join('\n')}` : ''}`);
  return hits[0];
}

/** Assert the manifest states a rule somewhere — its place is the step, its
 *  restatement in a proof is allowed at most once more. */
export function states(assert, doc, terms, { section, label = terms.join(' + ') } = {}) {
  const hits = sentencesStating(doc, terms, { section });
  assert.ok(hits.length >= 1, `${doc.id} should state "${label}"${section ? ` under ${section}` : ''}, found none`);
  return hits;
}

export const proof = (doc, id) => (doc.proofs ?? []).find((p) => p.id === id);
export const blocker = (doc, code) => (doc.blockers ?? []).find((b) => b.code === code);
export const readOf = (doc, id) => (doc.reads ?? []).find((r) => r.id === id);
export const writeOf = (doc, id) => (doc.writes ?? []).find((w) => w.id === id);

/** Every op manifest holds the one shape, so a spec can say "this op declares a
 *  param" without re-checking the whole schema. */
export function assertParam(assert, doc, name, expected = {}) {
  const def = doc.params?.[name];
  assert.ok(def, `${doc.id} declares no param ${name}`);
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(def[key], value, `${doc.id}.params.${name}.${key}`);
  assert.ok(Object.hasOwn(def, 'default'), `${doc.id}.params.${name} has no default`);
  assert.ok(def.doc?.en, `${doc.id}.params.${name} has no doc`);
  return def;
}
