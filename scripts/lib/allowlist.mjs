// allowlist.mjs — the one reader of the ONE explicit allowlist of the runtime: modules/kernel/allowlist.yaml
// (schema starci/allowlist@1). Every exception list a runtime check keeps is a named section of that file —
// not-codes, json-exceptions, dead-script-entries, the reserved export-used and the sonar-rules findings of main — and a reader takes its
// section here; no second allowlist, baseline, pending or entries file exists anywhere in the tree
// (scripts/checks/check-one-allowlist.mjs enforces the law by file name).
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

/** The repository-relative path of the one allowlist. */
export const ALLOWLIST_FILE = 'modules/kernel/allowlist.yaml';

/** The schema stamp every allowlist document carries. */
const ALLOWLIST_SCHEMA = 'starci/allowlist@1';

/** The section names of the one allowlist, in file order. */
const ALLOWLIST_SECTIONS = Object.freeze(['not-codes', 'json-exceptions', 'dead-script-entries', 'export-used', 'sonar-rules']);

/** The `kind` section of one already-parsed allowlist document; a malformed document or an unknown section is an error, never a silent empty list. */
export function allowlistSection(doc, kind, at = ALLOWLIST_FILE) {
  if (!ALLOWLIST_SECTIONS.includes(kind)) throw new Error(`${at}: unknown allowlist section "${kind}" (${ALLOWLIST_SECTIONS.join(', ')})`);
  if (!doc || typeof doc !== 'object' || doc.schema !== ALLOWLIST_SCHEMA) throw new Error(`${at} must stamp schema: ${ALLOWLIST_SCHEMA}`);
  if (doc[kind] === undefined || doc[kind] === null) throw new Error(`${at} needs a ${kind} section`);
  return doc[kind];
}

/** The `kind` section of the allowlist document at `file` (absolute or cwd-relative). */
export function readAllowlistFile(kind, file) {
  if (!fs.existsSync(file)) throw new Error(`the one allowlist is required: ${file}`);
  return allowlistSection(parseYaml(fs.readFileSync(file, 'utf8')), kind, file);
}

/** The `kind` section of modules/kernel/allowlist.yaml under `base` (this runtime by default). */
export const readAllowlist = (kind, base = skillRoot) => readAllowlistFile(kind, path.join(base, ...ALLOWLIST_FILE.split('/')));
