import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const operatorsRoot = path.join(runtimeRoot, 'operators');
const write = process.argv.includes('--write');
const changed = [];

for (const domain of fs.readdirSync(operatorsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
  for (const operation of fs.readdirSync(path.join(operatorsRoot, domain.name), { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const directory = path.join(operatorsRoot, domain.name, operation.name);
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'operator.json'), 'utf8'));
    if (manifest.schemaVersion !== 7) continue;
    const inputSchema = JSON.parse(fs.readFileSync(path.join(directory, 'input.schema.json'), 'utf8'));
    const outputSchema = JSON.parse(fs.readFileSync(path.join(directory, 'output.schema.json'), 'utf8'));
    const plans = [
      ['input.md', [
        ...Object.entries(inputSchema.properties.context.properties).map(([name, rule]) => [`context.${name}`, rule.description]),
        ...Object.entries(inputSchema.properties.input.properties).map(([name, rule]) => [`input.${name}`, rule.description])
      ]],
      ['output.md', Object.entries(outputSchema.properties.output.properties).map(([name, rule]) => [`output.${name}`, rule.description])]
    ];
    for (const [name, fields] of plans) {
      const file = path.join(directory, name);
      const source = fs.readFileSync(file, 'utf8');
      const missing = fields.filter(([field]) => !source.includes(field));
      if (missing.length === 0) continue;
      const appendix = `\n## Contract fields\n\n${missing.map(([field, description]) => `- \`${field}\`: ${description ?? 'Typed field bound to this single operator job.'}`).join('\n')}\n`;
      if (write) fs.writeFileSync(file, `${source.trimEnd()}\n${appendix}`);
      changed.push(`${manifest.id}/${name}`);
    }
  }
}

console.log(JSON.stringify({ write, changedCount: changed.length, changed }, null, 2));
if (!write && changed.length > 0) process.exitCode = 1;
