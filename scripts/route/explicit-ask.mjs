// explicit-ask.mjs — whether an owner goal text explicitly asks for a manual-only proof (owner ruling 2026-09-29:
// e2e/UAT and live integration verification run on explicit request / before release, never in a default chain).
//
// The phrase sets are data in modules/goal/archetypes.yaml signalMatching.phraseSets: `<kind>Intent` says the ask,
// `<kind>Negation` (optional) cancels it. The planner (route-plan.mjs) and the kernel (spec-deferral.mjs) read the
// same sets through this one function, so a leg is planned and dispatched under one rule.

import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { phraseHits } from './phrase-match.mjs';
import { normalizeText } from '../lib/normalize.mjs';

const HERE = path.resolve(import.meta.dirname, '..', '..');
const cache = new Map();

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

/** True when `text` hits `<kind>Intent` and does not hit `<kind>Negation`. `text` is a raw goal/prompt string. */
export function explicitAsk(kind, text, { skillRoot = HERE } = {}) {
  const sets = phraseSetsOf(skillRoot);
  const norm = normalizeText(text);
  const hit = (list) => Array.isArray(list) && list.some((p) => phraseHits(norm, p));
  return hit(sets[`${kind}Intent`]) && !hit(sets[`${kind}Negation`]);
}
