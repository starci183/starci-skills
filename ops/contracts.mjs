import fs from 'node:fs';
const read = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'));
export const registry = read('./registry.json');
export const ops = registry.ops.map(id => {
  const contract = read(`./${id}/operator.json`);
  if(contract.id !== id) throw Error('Operator identity differs from its registry: ' + id);
  if(['business.decide','architecture.decide'].includes(id)) contract.specificationPolicy=read(`./${id}/specification.json`);
  return contract;
});
