import test from 'node:test';
import assert from 'node:assert/strict';
import { requireRole } from '../../scripts/cli/roles.mjs';
import { loadCatalog } from '../../scripts/cli/catalog.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';

const rolesOf = (group, verb) => loadCatalog(skillRoot).groups.find((g) => g.group === group).verbs.find((v) => v.verb === verb).roles;

test('an Op running a verb that messages the Supervisor is refused with a code naming the Kernel', () => {
  for (const verb of ['tell', 'channel']) {
    const text = requireRole({ role: 'worker', group: 'supervisor', verb, roles: rolesOf('supervisor', verb) });
    assert.match(text, /OP_REPORTS_TO_KERNEL/);
    assert.match(text, /reports only to its Kernel/);
    assert.match(text, /starci kernel report/);
  }
});

test('the Kernel, the Supervisor and the owner still run those verbs', () => {
  for (const role of ['lead', 'coordinator', 'owner']) assert.equal(requireRole({ role, group: 'supervisor', verb: 'tell', roles: rolesOf('supervisor', 'tell') }), null);
});

test('a refusal outside the groups an Op may not address keeps the plain text', () => {
  assert.equal(requireRole({ role: 'worker', group: 'git', verb: 'land', roles: ['coordinator', 'owner'] }), 'starci git land: role worker may not run this (allowed: coordinator, owner)');
});
