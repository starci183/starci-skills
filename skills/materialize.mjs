import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const skills = fs.readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('starci-'));

for (const entry of skills) {
  const directory = path.join(root, entry.name);
  for (const name of ['SKILL.md', 'machine.json', 'input.schema.json', 'output.schema.json']) {
    if (!fs.existsSync(path.join(directory, name))) throw new Error(`${entry.name}: missing ${name}`);
  }
  const machine = JSON.parse(fs.readFileSync(path.join(directory, 'machine.json'), 'utf8'));
  for (const [stateId, state] of Object.entries(machine.states ?? {})) {
    if (state.kind !== 'operator') continue;
    for (const edge of state.on ?? []) {
      if (edge.when?.decision !== undefined) {
        throw new Error(`${entry.name}/${stateId}: legacy operator decision routing would regenerate v6 semantics`);
      }
    }
  }
}

console.log(`preserved ${skills.length} hand-authored state-machine skills; v7 operator routes are not regenerated from legacy templates`);
