import path from 'node:path';
import { machineKit } from './machine-ast.mjs';

/**
 * R54 `route-files-thin` (FE_ROUTE_FILES_THIN, knowledge/hfs/README.md 6.2). A route file only mounts an owner: it holds no
 * inline component, no drawing and no hook. For every file of the route slot (fe.route, apps/<app>/src/app) named
 * `layout`, `template`, `loading` or `not-found`:
 *
 *   - no host element (`<div>`, `<main>`): drawing belongs to the feature the file mounts;
 *   - no function other than the default export that returns JSX: an inline component is a feature in the wrong folder;
 *   - JSX, when present, mounts exactly one feature owner (a component resolved to a file of tier `feature`); a file with no
 *     JSX re-exports or delegates and needs none. Package components (a locale shell) may wrap the owner.
 *
 * and, for every such file and every `page`: no hook call. A hook is an imported `use<Name>` function or any function of
 * hooks/. The page's own mount, redirect and decision rules are the existing FE_ROUTE_ONE_PAGE, FE_ROUTE_DRAWING_DECISION,
 * FE_ROUTE_CLIENT_BOUNDARY and FE_ROUTE_CLIENT_HOOK checks of frontend.mjs and are not judged a second time here.
 */
export const ROUTE_FILES_THIN_RULE_IDS = ['FE_ROUTE_FILES_THIN'];

const RULE = 'FE_ROUTE_FILES_THIN';
const ROUTE_SLOT = 'fe.route';
const MOUNTING_ROUTES = new Set(['layout', 'template', 'loading', 'not-found']);
const HOOK_ROUTES = new Set([...MOUNTING_ROUTES, 'page']);
const HOOK_NAME = /^use[A-Z0-9]/u;
const HOOKS_SLOT = 'fe.hooks';

export function checkRouteFilesThin(input) {
  const { graph } = input;
  const kit = machineKit(input);
  const { ts } = kit;
  const violations = [];
  let routes = 0;

  for (const file of graph.files.values()) {
    if (file.slot !== ROUTE_SLOT) continue;
    const stem = path.posix.basename(file.rel).replace(/\.[cm]?[jt]sx?$/u, '');
    if (!HOOK_ROUTES.has(stem)) continue;
    routes += 1;
    const mounting = MOUNTING_ROUTES.has(stem);
    const checker = kit.checkerOf(file.sourceFile);
    const report = (node, message, extra = {}) => violations.push({ ruleId: RULE, path: file.rel, ...kit.at(file.rel, file.sourceFile, node), message, route: stem, ...extra });

    // The default export function: `export default function X`, `export default X` (X a function), `export default () => ...`.
    const defaults = new Set();
    for (const statement of file.sourceFile.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.modifiers?.some(item => item.kind === ts.SyntaxKind.DefaultKeyword)) defaults.add(statement);
      if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
        const target = statement.expression;
        if (ts.isIdentifier(target)) for (const declaration of kit.declarationsOf(checker, target)) defaults.add(ts.isVariableDeclaration(declaration) ? declaration.initializer ?? declaration : declaration);
        else defaults.add(target);
      }
    }
    const isFunction = node => ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node);
    const jsxOf = node => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
    const tagOf = node => (ts.isJsxElement(node) ? node.openingElement.tagName : ts.isJsxSelfClosingElement(node) ? node.tagName : null);
    /** True when the function contains JSX that is not inside a nested function. */
    const drawsDirectly = fn => {
      let found = false;
      const visit = node => {
        if (found) return;
        if (node !== fn && isFunction(node)) return;
        if (jsxOf(node)) { found = true; return; }
        ts.forEachChild(node, visit);
      };
      visit(fn);
      return found;
    };

    let hasJsx = false;
    let owners = 0;
    kit.walk(file.sourceFile, node => {
      if (jsxOf(node)) hasJsx = true;
      const tag = tagOf(node);
      if (mounting && tag) {
        if (ts.isIdentifier(tag) && /^[a-z]/u.test(tag.text)) report(tag, `<${tag.text}> is drawing in a ${stem} route file; a route file mounts one feature and draws nothing. Move the markup into the feature.`);
        else if (kit.declarationsOf(checker, ts.isPropertyAccessExpression(tag) ? tag.name : tag).some(declaration => graph.files.get(kit.graphPath(declaration) ?? '')?.tier === 'feature')) owners += 1;
      }
      if (mounting && isFunction(node) && !defaults.has(node) && drawsDirectly(node)) {
        report(node, `A function other than the default export draws JSX in a ${stem} route file; that is an inline component. Move it into the feature the route mounts.`);
      }
      if (ts.isCallExpression(node)) {
        const callee = ts.isIdentifier(node.expression) ? node.expression : null;
        if (callee && HOOK_NAME.test(callee.text)) {
          const binding = kit.importBinding(checker, callee);
          const inHooks = kit.declarationsOf(checker, callee).some(declaration => graph.files.get(kit.graphPath(declaration) ?? '')?.slot === HOOKS_SLOT);
          if (binding || inHooks) report(callee, `${callee.text} is a hook called in a ${stem} route file; a route file is a server adapter and holds no hook. Read the data in the feature it mounts.`);
        }
      }
      return true;
    });
    if (mounting && hasJsx && owners !== 1) {
      violations.push({ ruleId: RULE, path: file.rel, line: 1, column: 1, route: stem, owners,
        message: `${file.rel} mounts ${owners} feature owners; a ${stem} route file mounts exactly one feature (a layouts- or pages-tier component of the app), optionally inside a package shell.` });
    }
  }
  return { violations, coverage: { status: 'checked', routes } };
}
