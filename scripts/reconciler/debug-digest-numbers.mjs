// debug-digest-numbers.mjs — the numbers of `starci debug digest`, read from modules/reconciler/debug-digest.yaml; a ref is
// resolved through the hold policy reader (scripts/kernel/op-incident-policy.mjs), so a bound has one owner.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { refValue } from '../kernel/op-incident-policy.mjs';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'modules', 'reconciler', 'debug-digest.yaml');

/** The digest numbers as plain numbers; a ref that does not resolve to a finite number is refused. */
export function digestNumbers() {
  const doc = parseYaml(fs.readFileSync(FILE, 'utf8'));
  return Object.fromEntries(Object.entries(doc).map(([key, value]) => {
    const number = value?.ref === undefined ? value : refValue(value.ref);
    if (!Number.isFinite(number)) throw new Error(`debug-digest.yaml ${key} is not a number`);
    return [key, number];
  }));
}
