import { treeOf } from './required-files.mjs';
import { allowsFile } from '../../lib/hfs-allows.mjs';

/**
 * R47 `test-world-files` (BE_TEST_TOPOLOGY). `src/tests/world/` is the only test infrastructure location, and it holds only
 * what its slot `allows` (knowledge/hfs/slots.yaml be.tests.world: global-setup.ts, global-teardown.ts, use-test-world.ts,
 * and fakes/; kit/ is its own slot, be.tests.world.kit) plus files at its root whose role suffix is in ruleParams.be.suffixes (`stripe.client.ts`,
 * `checkout.contracts.ts`, ...). Every tracked file below the world root is matched by the slot's own entries through
 * `allowsFile`; nothing else is listed here.
 */
export const TEST_WORLD_FILES_RULE_IDS = ['BE_TEST_TOPOLOGY'];

const RULE = 'BE_TEST_TOPOLOGY';
const WORLD_SLOT = 'be.tests.world';
const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function checkTestWorldFiles({ config, graph }) {
  const resolver = graph.resolver;
  const { suffixes } = resolver.ruleParams();
  const tree = treeOf(config.root);
  const violations = [];
  let files = 0;
  for (const file of [...tree.files].sort()) {
    if (!file.endsWith('.ts')) continue;
    const verdict = allowsFile(resolver, file);
    if (!verdict || verdict.slot !== WORLD_SLOT) continue;
    files += 1;
    if (verdict.allowed) continue;
    const parts = verdict.relative.slice(0, -'.ts'.length).split('.');
    const roleFileAtRoot = !verdict.relative.includes('/') && parts.length >= 2 && parts.every(part => KEBAB.test(part)) && suffixes.includes(parts.at(-1));
    if (roleFileAtRoot) continue;
    violations.push({
      ruleId: RULE, path: file, line: 1, column: 1,
      message: `${file} is not allowed in the test world; src/tests/world/ holds only ${verdict.allows.join(', ')} and role-suffixed files (<name>.<role>.ts) at its root. Move it to fakes/ or kit/ (be.tests.world.kit), give it a role suffix, or delete it.`,
      slot: verdict.slot,
    });
  }
  return { violations, coverage: { status: 'checked', files } };
}
