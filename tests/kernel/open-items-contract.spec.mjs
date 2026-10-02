import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { loadContractChanges, changeById } from '../../scripts/machine/contract-version.mjs';

const ROOT = new URL('../..', import.meta.url);

// A product Collab incident: backend.implement and interface.implement workers filed `partial`
// for a Sonar 401, a whole-repository lint that could not run, and backend E2E they said a
// later e2e.verify leg owns; each cost a procedural fail and a retry, since partial never settles
// pass. The shared op contract now says what an open item is and what is only a note.
test('the shared op contract separates open items from environment and later-leg notes', () => {
  const common = parseYaml(fs.readFileSync(new URL('modules/ops/_common.yaml', ROOT), 'utf8'));
  const text = JSON.stringify(common);
  assert.match(text, /Open items are unfinished work/);
  assert.doesNotMatch(text, /inc-[0-9a-f]{12}/, 'the contract states the rule, never a product incident id (legacy purge)');
  assert.match(text, /whole-repository starci app lint\s+that cannot run beside a gate\.json with exit 0/, 'a whole-repository lint that cannot run beside a green gate is a note');
  assert.match(text, /e2e\.verify/, 'a proof another leg owns is cited with its op');
  assert.match(text, /sonar-local\.mjs[\s\S]*401 means run it\s+again/, 'Sonar 401 is a rerun, never an open item');
  assert.match(text, /backend\.implement's scoped unit gate for its selected operations/, "the op's own required proofs stay its own");
  assert.match(text, /`blocked`\s+`environment` with its evidence, never `partial`/);
});

test('the change is registered for new legs only', () => {
  const change = changeById(loadContractChanges(fileURLToPath(ROOT)), 'open-items-not-notes');
  assert.ok(change, 'modules/kernel/contract-changes.yaml registers open-items-not-notes');
  assert.equal(change.reach, 'new-legs');
});
