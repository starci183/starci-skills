import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../../engine/yaml.mjs';

// An integration credential has one shape in every work schema: {name, providedBy: owner, custody:
// identity:<slug>}; the retired `where` (a place, not a custody) is refused, and so is a declaration without custody.
const root = path.resolve(import.meta.dirname, '..', '..');
const schemaDir = path.join(root, 'modules', 'schemas');
const Ajv2020 = createRequire(path.join(root, 'package.json'))('ajv/dist/2020.js').default;

const credentialsIn = (node, at = '', out = []) => {
  if (!node || typeof node !== 'object') return out;
  if (node.properties?.credential?.properties?.providedBy) out.push({ at: `${at}/properties/credential`, schema: node.properties.credential });
  for (const [key, child] of Object.entries(node)) credentialsIn(child, `${at}/${key}`, out);
  return out;
};
const blocks = fs.readdirSync(schemaDir).filter((name) => /^work.*\.schema\.yaml$/.test(name))
  .flatMap((name) => credentialsIn(parseYaml(fs.readFileSync(path.join(schemaDir, name), 'utf8'))).map((block) => ({ file: name, ...block })));

test('every work schema declares the integration credential with the one shape', () => {
  assert.ok(blocks.length >= 17, `found ${blocks.length} credential blocks`);
  for (const block of blocks) assert.deepEqual(block.schema, blocks[0].schema, `${block.file}${block.at}`);
});

test('the credential shape requires custody and refuses the retired where', () => {
  const validate = new Ajv2020({ strict: false, allErrors: true }).compile(blocks[0].schema);
  const base = { name: 'TELEGRAM_BOT_TOKEN', providedBy: 'owner' };
  assert.equal(validate({ ...base, custody: 'identity:chatbot-telegram-bot' }), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...base, where: '.starcistacks/dev/runtime/env/app.env.enc' }), false, 'where is refused');
  assert.equal(validate({ ...base, custody: 'identity:chatbot-telegram-bot', where: 'a place' }), false, 'where is refused next to custody');
  assert.equal(validate(base), false, 'a declaration without custody is refused');
  assert.equal(validate({ ...base, custody: '.starcistacks/dev/app.env.enc' }), false, 'custody is an identity resource, never a path');
  assert.equal(validate({ ...base, providedBy: 'agent', custody: 'identity:x' }), false, 'the credential belongs to the owner');
});
