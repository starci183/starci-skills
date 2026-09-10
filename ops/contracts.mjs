import fs from 'node:fs';
import { parseYaml } from '../core/yaml.mjs';
const read = name => parseYaml(fs.readFileSync(new URL(name, import.meta.url), 'utf8'));
export const registry = read('./registry.yaml');
export const ops = registry.ops.map(id => {
  const contract = read(`./${id}/operator.yaml`);
  if(contract.id !== id) throw Error('Operator identity differs from its registry: ' + id);
  if(['business.decide','architecture.decide'].includes(id)) contract.specificationPolicy=read(`./${id}/specification.yaml`);
  return contract;
});
