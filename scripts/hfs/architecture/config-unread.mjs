/**
 * R24 `arch-config-unread` (HFS_ARCH_CONFIG_UNREAD). The machine reads `hfs.json`; a declaration that yields no analysed
 * file is a machine that judged nothing, and that is red: a repository whose declaration and tsconfig load but whose
 * program holds no production source file.
 */
export const CONFIG_UNREAD_RULE_IDS = ['HFS_ARCH_CONFIG_UNREAD'];

const RULE = 'HFS_ARCH_CONFIG_UNREAD';

export function checkConfigUnread({ context }) {
  const violations = [];
  const analysed = context.files.length;
  if (analysed === 0) {
    violations.push({ ruleId: RULE, path: 'hfs.json', line: 1, column: 1,
      message: 'hfs.json and the TypeScript projects load but the machine analysed no production source file, so it judged nothing. Declare the apps that hold source in hfs.json, or fix the tsconfig include so the source is in the program.' });
  }
  return { violations, coverage: { status: 'checked', analysed } };
}
