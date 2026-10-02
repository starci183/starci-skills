// source-phrases.mjs - the Vietnamese phrase lists runtime source matches against owner or product text are DATA,
// not source: they live in modules/goal/source-phrases.yaml (its leaf keys are declared Vietnamese fields,
// scripts/lib/language.mjs DECLARED_VIETNAMESE_FIELDS - like the archetypes.yaml phrase lists) so the matchers'
// source stays English. A list is plain words or regex alternatives, per its comment in the lexicon.
//
//   phrasesOf('owed.ownerWord')   -> the list as written (['<owner word>', ...])
//   altOf('owed.ownerWord')       -> the regex alternation 'a|b|c'; '(?!)' - never matches - when absent
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

export const SOURCE_PHRASES_FILE = 'modules/goal/source-phrases.yaml';

const cache = new Map();

/** The lexicon's `phrases` map ({<group>: {<list>: string[]}}), cached per root. */
export function sourcePhrases(root = skillRoot) {
  if (!cache.has(root)) {
    let doc = null;
    try { doc = parseYaml(fs.readFileSync(path.join(root, ...SOURCE_PHRASES_FILE.split('/')), 'utf8')); } catch { doc = null; }
    cache.set(root, doc && typeof doc.phrases === 'object' && doc.phrases ? doc.phrases : {});
  }
  return cache.get(root);
}

/** The phrase list `dotKey` (`<group>.<list>`) of `root`, [] when absent. */
export function phrasesOf(dotKey, root = skillRoot) {
  const value = dotKey.split('.').reduce((v, k) => (v && typeof v === 'object' ? v[k] : undefined), sourcePhrases(root));
  return (Array.isArray(value) ? value : []).map(String);
}

/** The regex alternation of `dotKey` ('a|b|c'); '(?!)' - a never-match - when the list is empty. */
export const altOf = (dotKey, root = skillRoot) => phrasesOf(dotKey, root).join('|') || '(?!)';
