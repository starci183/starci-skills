// Generates src/catalog.generated.json directly from source YAML (distless: source YAML is the contract).
// Sources: workflows/catalog.yaml + workflows/jobs.yaml + workflows/matrix.yaml for the workflow
// list and definitions, workflows/gates.yaml + schemas/work-layout.yaml for the docs page, and
// modules/ops/ops/<id>.yaml for operator contracts (goal + steps + reads/writes). Secondary
// authority, when an op declares it, comes from legacy/ops/<id>/secondary.yaml.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../core/yaml.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const read = (...parts) => parseYaml(fs.readFileSync(path.join(root, ...parts), 'utf8'));

const catalog = read('workflows', 'catalog.yaml');
const jobs = read('workflows', 'jobs.yaml');
const frontend = read('workflows', 'matrix.yaml');

const opsDir = path.join(root, 'modules', 'ops', 'ops');
const operators = fs.readdirSync(opsDir).filter(f => f.endsWith('.yaml')).sort().map(f => {
  const op = parseYaml(fs.readFileSync(path.join(opsDir, f), 'utf8'));
  const secondaryFile = path.join(root, 'legacy', 'ops', op.id, 'secondary.yaml');
  const secondary = fs.existsSync(secondaryFile) ? parseYaml(fs.readFileSync(secondaryFile, 'utf8')) : null;
  return { id: op.id, goal: op.goal?.en ?? '', contract: op, authority: null, secondary };
});

const data = {
  schema: 'starci/site-catalog@1',
  entry: 'starci',
  layout: read('schemas', 'work-layout.yaml'),
  gates: read('workflows', 'gates.yaml'),
  limits: catalog.limits ?? null,
  workflows: (catalog.workflows ?? []).map(w => ({
    ...w,
    definition: w.id === 'implement-frontend' ? frontend : (jobs.workflows ?? []).find(j => j.id === w.id) ?? null,
  })),
  operators,
};

const out = path.resolve(here, '../src/catalog.generated.json');
fs.writeFileSync(out, JSON.stringify(data) + '\n');
process.stdout.write(JSON.stringify({ ok: true, workflows: data.workflows.length, operators: data.operators.length }) + '\n');
