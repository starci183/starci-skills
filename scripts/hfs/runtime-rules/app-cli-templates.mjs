// app-cli-templates.mjs - RT_CLI_APP_ONLY_TEMPLATES (R200): app-managed templates invoke product actions only through
// `starci app ...`. Generated runtime copies of those templates are checked too; examples are re-rendered by the release lead.
const APP_ONLY_TEMPLATES = 'RT_CLI_APP_ONLY_TEMPLATES';

const ROOTS = [
  'packages/hfs/templates/',
  'packages/eslint/be/runtime/packages/hfs/templates/',
  'packages/eslint/fe/runtime/packages/hfs/templates/',
];
const WRONG_STARCI_GROUP = /\b(?:npx\s+)?starci\s+(?!app\b)[a-z][a-z0-9-]*\b/;

/** Findings for managed template source and generated copies that invoke a non-app CLI surface. */
export function appCliTemplateFindings({ files, read }) {
  const findings = [];
  for (const file of files) {
    if (!ROOTS.some((root) => file.startsWith(root))) continue;
    const text = read(file);
    if (text === null) continue;
    const lines = text.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const match = WRONG_STARCI_GROUP.exec(line);
      if (!match) continue;
      findings.push({
        code: APP_ONLY_TEMPLATES,
        level: 'error',
        path: file,
        line: index + 1,
        message: `${file}:${index + 1} invokes ${JSON.stringify(match[0])}; managed app templates invoke product actions only through "starci app <verb>"`,
      });
    }
  }
  return findings;
}
