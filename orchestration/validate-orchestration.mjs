import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatorFor } from '../operators/validation.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const modeValidator = validatorFor(new URL('./mode.schema.json', import.meta.url));
const providerValidator = validatorFor(new URL('./provider.schema.json', import.meta.url));
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const fail = (message) => { throw new Error(message); };

const modeNames = ['economical', 'balanced', 'parallel'];
const modes = Object.fromEntries(modeNames.map((name) => {
  const value = readJson(path.join(root, 'modes', `${name}.json`));
  const result = modeValidator(value);
  if (!result.valid) fail(`${name}: ${result.errors.join('; ')}`);
  if (value.id !== name) fail(`${name}: file/id mismatch`);
  if (value.activation.minIndependentItems > value.maxWorkers) fail(`${name}: activation threshold exceeds worker limit`);
  if (name === 'economical' && value.activation.minIndependentItems !== 0) fail(`${name}: sequential mode must have zero activation threshold`);
  if (name !== 'economical' && value.activation.minIndependentItems < 2) fail(`${name}: parallel mode needs at least two independent items`);
  return [name, value];
}));

const providers = fs.readdirSync(path.join(root, 'providers')).filter((name) => name.endsWith('.json')).sort();
if (providers.length === 0) fail('at least one provider mapping is required');
for (const file of providers) {
  const value = readJson(path.join(root, 'providers', file));
  const result = providerValidator(value);
  if (!result.valid) fail(`${file}: ${result.errors.join('; ')}`);
  if (`${value.provider}.json` !== file) fail(`${file}: provider/file mismatch`);
  for (const [mode, mapping] of Object.entries(value.modeMappings)) {
    if (mapping.maxWorkers > modes[mode].maxWorkers) fail(`${file}/${mode}: provider exceeds mode worker limit`);
    if (mapping.maxWorkers === 0 && mapping.workerModel !== null) fail(`${file}/${mode}: zero-worker mode cannot select a worker model`);
    if (mapping.maxWorkers > 0 && mapping.workerModel === null) fail(`${file}/${mode}: worker mode needs a runtime model alias`);
    if (mode !== 'economical' && (mapping.workerModel !== 'gpt-5.6-sol' || mapping.maxWorkers !== 1)) fail(`${file}/${mode}: material AI review/brainstorm orchestration requires exactly one Sol worker for every provider`);
  }
}

console.log(`orchestration valid: ${modeNames.length} modes and ${providers.length} provider mappings`);
