// work-schemas.mjs — the work-*.schema.yaml family shares its repeated blocks through
// modules/schemas/work-common.schema.yaml ($id urn:work:common:1). An Ajv instance compiles a
// `urn:work:common:1#/$defs/<name>` reference only when that schema has been added to it first:
// call addWorkCommon(ajv) before compiling any modules/schemas/work*.schema.yaml.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

export const WORK_COMMON_ID = 'urn:work:common:1';

/** Register the shared work-schema vocabulary on an Ajv instance (once per instance). `root` is the
 *  runtime root the rest of the caller reads schemas from; it defaults to this checkout. */
export function addWorkCommon(ajv, root = skillRoot) {
  if (ajv.getSchema?.(WORK_COMMON_ID)) return ajv;
  const file = path.join(root, 'modules', 'schemas', 'work-common.schema.yaml');
  ajv.addSchema(parseYaml(fs.readFileSync(file, 'utf8')));
  return ajv;
}

/** `work-common.schema.yaml`'s `$defs.<name>` for callers that read a shape out of the shared
 *  vocabulary (an enum list, a const table) instead of compiling a schema. `undefined` when the
 *  def does not exist. */
export function workCommonDef(name, root = skillRoot) {
  const file = path.join(root, 'modules', 'schemas', 'work-common.schema.yaml');
  return parseYaml(fs.readFileSync(file, 'utf8'))?.$defs?.[name];
}
