// failure-code-catalog.mjs — the one reader of the failure-code catalog (modules/kernel/failure-codes.yaml): a flat map code -> {title, title_vi, meaning_vi, causes_vi[],
// nextStep_vi, owner, kind}. Parsed once per process; why.mjs (the owner's explanation) and failure-class.mjs (work or runtime) read it here.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYamlCached } from './yaml-cached.mjs';

const CATALOG_FILE = path.join(skillRoot, 'modules', 'kernel', 'failure-codes.yaml');
let shipped = null;

/** The catalog of the shipped runtime (or of `file`, read afresh each time). */
export function failureCodeCatalog(file = CATALOG_FILE) {
  if (file !== CATALOG_FILE) return parseYamlCached(fs.readFileSync(file, 'utf8')) ?? {};
  shipped ??= parseYamlCached(fs.readFileSync(CATALOG_FILE, 'utf8')) ?? {};
  return shipped;
}
