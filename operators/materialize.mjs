import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const contractFiles = [
  'execute.md',
  'input.md',
  'input.schema.json',
  'operator.json',
  'output.md',
  'output.schema.json',
  'validate-input.mjs',
  'validate-output.mjs'
].sort();
const allowedContracts = [
  contractFiles,
  [...contractFiles, 'icon.svg'].sort(),
];

const domains = fs.readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const operators = domains.flatMap((domain) => fs.readdirSync(path.join(root, domain), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({ id: `${domain}/${entry.name}`, directory: path.join(root, domain, entry.name) })));

for (const operator of operators) {
  const files = fs.readdirSync(operator.directory).sort();
  if (!allowedContracts.some((contract) => JSON.stringify(files) === JSON.stringify(contract))) {
    throw new Error(`${operator.id}: operator must keep the exact hand-authored eight-file contract plus optional icon.svg`);
  }
}

console.log(`preserved ${operators.length} hand-authored operators; semantic contracts are never generated from a shared prose template`);
