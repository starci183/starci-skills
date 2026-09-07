import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { landingCompositionErrors } from './validate.mjs';

const skeleton = readFileSync(new URL('../../templates/kinds/landing-composition.skeleton.md', import.meta.url), 'utf8');
const receipt = skeleton
  .replace('# landing-composition — landing-id', '# landing-composition — nivo-landing')
  .replace('the concrete promise the landing makes credible', 'turn a founder goal into owned and verified responsibility')
  .replace('the bound family and version', 'starci 0.4.13')
  .replace('canonical asset, brand system or explicit identity description', 'canonical NIVO unicorn asset')
  .replace('canonical mascot asset', 'canonical NIVO unicorn asset');

const requirements = { surface: 'nivo-landing' };
const response = { status: 'done', commits: [], next: ['interface.generate'] };
assert.deepEqual(landingCompositionErrors(receipt, requirements, response), []);
assert.ok(landingCompositionErrors(receipt.replace('canonical NIVO unicorn asset', '—'), requirements, response).some((error) => error.includes('identity')));
assert.ok(landingCompositionErrors(receipt.replace('| `hero` | heading and body copy | grammar | `Heading` and `Text` |', '| `hero` | heading and body copy | custom | — |'), requirements, response).some((error) => error.includes('ownership reason')));
assert.ok(landingCompositionErrors(receipt.replace('| 03 | `roles`', '| 02 | `roles`'), requirements, response).some((error) => error.includes('repeats an order')));
assert.ok(landingCompositionErrors(receipt.replace('show final state immediately; no drift', '—'), requirements, response).some((error) => error.includes('reduced-motion')));
assert.ok(landingCompositionErrors(receipt, requirements, { ...response, commits: ['a'.repeat(40)] }).some((error) => error.includes('read-only')));
assert.ok(landingCompositionErrors(receipt, requirements, { ...response, next: ['git.publish'] }).some((error) => error.includes('exactly to interface.generate')));

process.stdout.write('landing.compose self-test: one lawful contract and six ownership or completeness mutations refused\n');
