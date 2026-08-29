import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const audits = ['flow-coverage-audit', 'behavior-audit', 'ux-audit', 'ui-audit'];

for (const name of audits) {
  const directory = path.join(root, 'test', name);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'operator.json'), 'utf8'));
  if (manifest.schemaVersion !== 7 || manifest.id !== `test/${name}`) {
    throw new Error(`test/${name}: UAT audit must remain a hand-authored strict-v7 operator`);
  }
  const input = JSON.parse(fs.readFileSync(path.join(directory, 'input.schema.json'), 'utf8'));
  const output = JSON.parse(fs.readFileSync(path.join(directory, 'output.schema.json'), 'utf8'));
  if (!input.properties?.context || !input.properties?.input || !output.properties?.output) {
    throw new Error(`test/${name}: strict-v7 context + input -> output boundary is missing`);
  }
}

console.log(`preserved ${audits.length} hand-authored strict-v7 UAT audit operators`);
