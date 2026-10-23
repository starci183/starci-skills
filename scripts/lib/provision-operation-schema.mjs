// The schema of a stack declaration's `operations` block, composed once for its two readers: the provision target owner and the
// stacks gate. provision-operation.schema.yaml refers to the service credential of application-stacks.schema.yaml; the composition
// inlines that definition so the self-contained walker of json-schema.mjs resolves every reference.
// Both schemas are read through `new URL(<literal>, import.meta.url)`: that is the form sync-runtime follows, so the copy
// bundled in @starci/hfs carries them beside this module (a skillRoot join left provision-operation.schema.yaml out of it).
import fs from 'node:fs';
import { parseYaml } from '../../engine/yaml.mjs';

/** The `$ref` application-stacks.schema.yaml uses for its `operations` block. */
export const PROVISION_OPERATION_SCHEMA_REF = 'provision-operation.schema.yaml';

/** The composed `operations` schema, read from this runtime's modules/schemas. */
export function provisionOperationSchema() {
  const schema = parseYaml(fs.readFileSync(new URL('../../modules/schemas/provision-operation.schema.yaml', import.meta.url), 'utf8'));
  const stacks = parseYaml(fs.readFileSync(new URL('../../modules/schemas/application-stacks.schema.yaml', import.meta.url), 'utf8'));
  return { ...schema, $defs: { ...schema.$defs, serviceCredential: stacks.$defs.serviceCredential } };
}
