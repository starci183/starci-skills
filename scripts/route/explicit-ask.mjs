// explicit-ask.mjs — whether an owner goal text explicitly asks for a manual-only proof (owner ruling 2026-09-29:
// e2e/UAT and live integration verification run on explicit request / before release, never in a default chain).
//
// The phrase sets are data in modules/goal/archetypes.yaml signalMatching.phraseSets: `<kind>Intent` says the ask,
// `proofNegation` lists the negation cues and `proofStateCue` the current-state cues that turn a mention into a description.
// The planner (route-plan.mjs) and the kernel (spec-deferral.mjs) read the same sets through this one module, so a leg is
// planned and dispatched under one rule.
//
// A mention is an ask only when it states a wish. It is not one when its clause carries a negation cue ("no UAT",
// "skip e2e"), or when its sentence describes the state of the repository ("the end-to-end tests are still to be built").
// A cue cancels the mentions of its own clause and sentence only: another kind and another sentence keep their ask.

import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { phraseHits } from './phrase-match.mjs';
import { normalizeText } from '../lib/normalize.mjs';

const HERE = path.resolve(import.meta.dirname, '..', '..');
const cache = new Map();
const SENTENCE_BREAK = /[.!?;]+(?=\s|$)|[\r\n]+/;
const CLAUSE_BREAK = /[,:()]/;

function phraseSetsOf(skillRoot) {
  const file = path.join(skillRoot, 'modules', 'goal', 'archetypes.yaml');
  let stamp;
  try { const stat = fs.statSync(file); stamp = `${stat.mtimeMs}:${stat.size}`; } catch { return {}; }
  const cached = cache.get(file);
  if (cached?.stamp === stamp) return cached.sets;
  let sets = {};
  try { sets = parseYaml(fs.readFileSync(file, 'utf8'))?.signalMatching?.phraseSets ?? {}; } catch { sets = {}; }
  cache.set(file, { stamp, sets });
  return sets;
}

const hitsAny = (text, phrases) => Array.isArray(phrases) && phrases.some((p) => phraseHits(text, p));

/**
 * True when a raw goal/prompt `text` holds a mention of one of the `intent` phrases that states a wish: its sentence has no
 * `state` cue and its clause (a sentence cut at commas, colons and parentheses) has no `negation` cue. Each is a phrase list.
 */
export function asksFor(text, { intent, negation, state }) {
  return String(text ?? '').split(SENTENCE_BREAK).some((sentence) => {
    const norm = normalizeText(sentence);
    if (hitsAny(norm, state)) return false;
    return norm.split(CLAUSE_BREAK).some((clause) => hitsAny(clause, intent) && !hitsAny(clause, negation));
  });
}

/** True when `text` asks for `kind` (`e2e`, `uat`, `integration`): a mention of `<kind>Intent` that is not negated or a description. */
export function explicitAsk(kind, text, { skillRoot = HERE } = {}) {
  const sets = phraseSetsOf(skillRoot);
  return asksFor(text, { intent: sets[`${kind}Intent`], negation: sets.proofNegation, state: sets.proofStateCue });
}
