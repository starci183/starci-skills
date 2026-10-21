// The schema of a stack declaration's `operations` block, composed once for its two readers: the provision target owner and the
// stacks gate. provision-operation.schema.yaml refers to the service credential of application-stacks.schema.yaml; the composition
// inlines that definition so the self-contained walker of json-schema.mjs resolves every reference.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';

/** The `$ref` application-stacks.schema.yaml uses for its `operations` block. */
export const PROVISION_OPERATION_SCHEMA_REF = 'provision-operation.schema.yaml';

/** The composed `operations` schema, read from this runtime's modules/schemas. */
export function provisionOperationSchema() {
  const schema = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules/schemas', PROVISION_OPERATION_SCHEMA_REF), 'utf8'));
  const stacks = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules/schemas/application-stacks.schema.yaml'), 'utf8'));
  return { ...schema, $defs: { ...schema.$defs, serviceCredential: stacks.$defs.serviceCredential } };
}
