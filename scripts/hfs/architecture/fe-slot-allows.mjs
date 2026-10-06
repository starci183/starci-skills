import { treeOf } from './required-files.mjs';
import { allowsFile } from '../allows.mjs';
import { isFeTestPath } from '../rules/fe-no-tests.mjs';
import { byCodeUnit } from '../../lib/list.mjs';

/**
 * R94 `fe-slot-allows` (FE_SLOT_FILE_ROLE). A front-end slot that owns a whole directory (`fe.route`, `fe.feature`,
 * `fe.components`, `fe.hooks`, `fe.modules.api`) also says what its instances hold (`allows` in knowledge/hfs/slots.yaml).
 * Every tracked file of such a slot is matched against the `requires` and `allows` entries of its slot; a file no entry names is a
 * finding - `page.tsx` in a hooks domain, a `[lang]` segment under `app/`, a stray file beside a component or at a feature
 * root. A file that sits where the slot expects a folder (`hooks/useX.ts`, so the "domain" is a file name) is one too.
 * Files no slot owns are HFS_PATH_NO_SLOT's (`starci app check`), so together every front-end file is placed by exactly one slot and
 * named by it. A test path (a `.spec.tsx` or `.test.tsx` beside a component, a test directory or test tooling) is FE_NO_TESTS's
 * (R97 FE_NO_TESTS): that rule is the one finding of such a file, so this check leaves it alone, as
 * HFS_PATH_NO_SLOT does (scripts/hfs/path-findings.mjs).
 */
export const FE_SLOT_ALLOWS_RULE_IDS = ['FE_SLOT_FILE_ROLE'];

const RULE = 'FE_SLOT_FILE_ROLE';

export function checkFeSlotAllows({ config, graph }) {
  const resolver = graph.resolver;
  const tree = treeOf(config.root);
  const violations = [];
  let files = 0;
  const report = (file, message, extra = {}) => violations.push({ ruleId: RULE, path: file, line: 1, column: 1, message, ...extra });
  for (const file of [...tree.files].sort(byCodeUnit)) {
    if (isFeTestPath(file)) continue;   // FE_NO_TESTS's, the one finding of that file
    const classified = resolver.classifyPath(file);
    if (classified.status !== 'owned') continue;
    const slot = resolver.slot(classified.slot);
    if (!slot?.allows?.length) continue;
    files += 1;
    if (slot.owner === true && classified.root === classified.path) {
      report(file, `${file} sits where slot ${slot.id} expects a folder (${slot.path}); it holds ${slot.allows.join(', ')} inside a folder of its own. Move it into one.`, { slot: slot.id });
      continue;
    }
    const verdict = allowsFile(resolver, file);
    if (!verdict || verdict.allowed) continue;
    report(file, `${file} is not allowed in ${verdict.slot} (${verdict.root}); that slot holds only ${verdict.allows.join(', ')}. Rename it to an allowed role or move it to the slot it belongs to.`, { slot: verdict.slot });
  }
  return { violations, coverage: { status: 'checked', files } };
}
