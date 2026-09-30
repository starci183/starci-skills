import path from 'node:path';
import { treeOf } from './required-files.mjs';

/**
 * R24 `arch-config-unread` (HFS_ARCH_CONFIG_UNREAD). The machine reads `hfs.json` and nothing else; a config file it
 * no longer reads is dead text that says a rule is tuned when it is not, and a declaration that yields no analysed file
 * is a machine that judged nothing. Both are red:
 *
 *   - a tracked `architecture.json` (the retired per-repository config; the declaration is hfs.json, the rest is derived
 *     from the slot manifest);
 *   - a repository whose declaration and tsconfig load but whose program holds no production source file.
 */
export const CONFIG_UNREAD_RULE_IDS = ['HFS_ARCH_CONFIG_UNREAD'];

const RULE = 'HFS_ARCH_CONFIG_UNREAD';
/** Config file names an earlier machine read and this one never does. */
const RETIRED_CONFIG_NAMES = ['architecture.json'];

export function checkConfigUnread({ config, context }) {
  const violations = [];
  const tree = treeOf(config.root);
  let retired = 0;
  for (const file of [...tree.files].sort()) {
    if (!RETIRED_CONFIG_NAMES.includes(path.posix.basename(file))) continue;
    retired += 1;
    violations.push({ ruleId: RULE, path: file, line: 1, column: 1,
      message: `${file} is a config the architecture machine no longer reads. hfs.json declares the repository; owners, roots, tiers and budgets come from the slot manifest. Delete ${file}.` });
  }
  const analysed = context.files.length;
  if (analysed === 0) {
    violations.push({ ruleId: RULE, path: 'hfs.json', line: 1, column: 1,
      message: 'hfs.json and the TypeScript projects load but the machine analysed no production source file, so it judged nothing. Declare the apps that hold source in hfs.json, or fix the tsconfig include so the source is in the program.' });
  }
  return { violations, coverage: { status: 'checked', retired, analysed } };
}
