// op-gate.mjs — one section of the runtime's knowledge/op-gate.yaml (testWorld, unitKit, ...):
// {required, forbidden, outage, ...} as authored. An absent section reads as {}.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';

/** The `section` object of knowledge/op-gate.yaml under `runtime`, {} when the doc omits it. Throws when the file is unreadable. */
export const opGateSection = (runtime, section) =>
  (parseYaml(fs.readFileSync(path.join(runtime, 'knowledge', 'op-gate.yaml'), 'utf8'))?.[section]) ?? {};

/** The {required, forbidden, outage} rule lists of a gate `section` (absent lists read as []). */
export const opGateRules = (runtime, section) => {
  const rules = opGateSection(runtime, section);
  return { required: rules.required ?? [], forbidden: rules.forbidden ?? [], outage: rules.outage ?? [] };
};
