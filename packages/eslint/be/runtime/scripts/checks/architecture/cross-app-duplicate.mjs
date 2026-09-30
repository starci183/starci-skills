import { createHash } from 'node:crypto';
import path from 'node:path';

/**
 * R21 `cross-app-duplicate` (FE_CROSS_APP_DUPLICATE): the slot manifest's `crossApp` law says apps never import each other and
 * shared code is a `packages/<pkg>` slot. `HFS_DUPLICATE_CODE` sees blocks of a size inside the owner graph; this sees whole
 * files of any size, route-tree files included: two TypeScript files under different apps whose token-normalised content is
 * equal (comments and whitespace do not exist in the token sequence; identifiers and literals are kept) are one file copied
 * instead of moved to a package.
 *
 * Exempt: a file made only of import and export statements. It is the sanctioned shape of a Next route file that must exist
 * per app and re-exports one package symbol (`export { default } from "@family/ui/global-error"`), and it holds nothing to move.
 * Not source, so not judged: declaration files and everything that is not .ts/.tsx (JSON catalogs, CSS).
 */
export const CROSS_APP_DUPLICATE_RULE_IDS = ['FE_CROSS_APP_DUPLICATE'];

const RULE = 'FE_CROSS_APP_DUPLICATE';
const SOURCE = /\.[cm]?tsx?$/u;

export function checkCrossAppDuplicate({ graph, context }) {
  const ts = context.ts;
  const { SyntaxKind } = ts;
  const resolver = graph.resolver;
  const declaredApps = resolver.repo.apps.map(app => app.name);
  /** The app a file belongs to: the slot binding when a slot owns it, else the declared app whose directory holds it. */
  const appOf = rel => resolver.classifyPath(rel).bindings?.app ?? declaredApps.find(name => rel.startsWith(`apps/${name}/`)) ?? null;
  const onlyModuleEdges = file => file.sourceFile.statements.every(statement => ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)
    || (ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression)));

  const tokens = sourceFile => {
    const parts = [];
    const visit = node => {
      if (node.kind >= SyntaxKind.FirstJSDocNode && node.kind <= SyntaxKind.LastJSDocNode) return;
      if (node.kind === SyntaxKind.JsxText && node.containsOnlyTriviaWhiteSpaces) return;
      const children = node.getChildren(sourceFile);
      if (!children.length) {
        if (node.kind !== SyntaxKind.EndOfFileToken) parts.push(node.kind === SyntaxKind.JsxText ? node.getText(sourceFile).replace(/\s+/gu, ' ').trim() : node.getText(sourceFile));
        return;
      }
      for (const child of children) visit(child);
    };
    visit(sourceFile);
    return parts.join('\u0000');
  };

  const groups = new Map();
  let files = 0;
  for (const file of graph.files.values()) {
    if (!SOURCE.test(file.rel) || /\.d\.[cm]?tsx?$/u.test(file.rel)) continue;
    const app = appOf(file.rel);
    if (!app || onlyModuleEdges(file) || !file.sourceFile.statements.length) continue;
    files += 1;
    const key = createHash('sha256').update(tokens(file.sourceFile)).digest('hex');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ rel: file.rel, app });
  }

  const violations = [];
  let duplicated = 0;
  for (const group of groups.values()) {
    if (new Set(group.map(item => item.app)).size < 2) continue;
    duplicated += 1;
    group.sort((a, b) => a.rel.localeCompare(b.rel));
    for (const item of group) {
      const twins = group.filter(other => other.app !== item.app).map(other => other.rel);
      violations.push({
        ruleId: RULE, path: item.rel, line: 1, column: 1, twins,
        message: `${item.rel} is token-for-token the same file as ${twins.join(', ')} in another app (comments and whitespace ignored); shared code is a packages/<pkg> slot. Move it to a package (packages/<pkg>) and let each app re-export it (${path.posix.basename(item.rel)} keeps only an import or export statement).`,
      });
    }
  }
  return { violations, coverage: { status: 'checked', files, duplicatedGroups: duplicated } };
}
