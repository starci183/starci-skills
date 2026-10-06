import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit } from '../../lib/list.mjs';

/**
 * R106 `i18n-keys` (FE_I18N_KEYS). The catalogs of an app (`apps/<app>/src/modules/i18n/messages/<locale>.json`, slot fe.modules.i18n) and
 * the source that reads them agree, both ways. The key sets of the locales agree with each other (FE_I18N_CATALOG, `starci app check`); this
 * rule holds the source to the catalogs:
 *
 *   - a key read with a literal is in every locale: `useTranslations("ns")` / `getTranslations("ns")` (also `{ namespace }`, `await`)
 *     imported from `next-intl` or `next-intl/server`, then `t("key")`, `t.rich("key")`, `t.raw("key")`, `t.markup("key")` inside the app's
 *     own source (both branches of a conditional key are read). A key no locale's catalog holds is FE_I18N_KEYS, once per call. A computed
 *     key (a template with an interpolation, a variable) is not judged here; it counts as a read.
 *   - a key nobody reads is dead: a leaf of the app's catalogs that no string in the app's or the shared packages' source can be reading.
 *     A leaf counts as read when a string literal or a template pattern (each interpolation a wildcard segment) of that source equals a
 *     tail of its dotted path (`"title"`, `"card.title"`, `"orders.card.title"` all read `orders.card.title`); the test is deliberately loose
 *     so a key handed through props or a table of keys is never reported, and only a key that appears nowhere is.
 *
 * Reads the source of the program and the JSON catalogs on disk; the wording of a translation is the product owner's.
 */
export const I18N_KEYS_RULE_IDS = ['FE_I18N_KEYS'];

const RULE = 'FE_I18N_KEYS';
const MODULES = new Set(['next-intl', 'next-intl/server']);
const FACTORIES = new Set(['useTranslations', 'getTranslations']);
const READERS = new Set(['rich', 'raw', 'markup']);
const APP_SOURCE = /^apps\/([^/]+)\/src\//u;

const leavesOf = (value, prefix = '') => (value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length
  ? Object.entries(value).flatMap(([key, child]) => leavesOf(child, prefix ? `${prefix}.${key}` : key))
  : [prefix]);

const readCatalog = (root, rel) => {
  try { return new Set(leavesOf(JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))).filter(Boolean)); } catch { return null; }
};

/** True when the key `full` is a leaf of `leaves` or a namespace above one (an object read by `rich`, `raw` or a nested `t`). */
const held = (leaves, full) => leaves.has(full) || [...leaves].some(leaf => leaf.startsWith(`${full}.`));

// A pattern that is only wildcards (`${a}`, `${a}.${b}`) names nothing: it would read every key, so it reads none.
const tailMatches = (pattern, leafSegments) => pattern.some(segment => segment !== '*' && segment !== '') && pattern.length <= leafSegments.length
  && pattern.every((segment, index) => segment === '*' || segment === leafSegments[leafSegments.length - pattern.length + index]);

export function checkI18nKeys({ config, graph, context }) {
  const ts = context.ts;
  const violations = [];
  const report = (file, node, message, extra = {}) => {
    const at = file.sourceFile.getLineAndCharacterOfPosition(node.getStart(file.sourceFile));
    violations.push({ ruleId: RULE, path: file.rel, line: at.line + 1, column: at.character + 1, message, ...extra });
  };

  const catalogsByApp = new Map();
  const seen = new Set();
  for (const file of graph.files.values()) {
    const app = APP_SOURCE.exec(file.rel)?.[1];
    if (!app || seen.has(app)) continue;
    seen.add(app);
    const dir = `apps/${app}/src/modules/i18n/messages/`;
    let names = [];
    try { names = fs.readdirSync(path.join(config.root, dir)).filter(name => name.endsWith('.json')).sort(byCodeUnit); } catch { /* the app has no catalog directory: FE_I18N_PLACEMENT's finding */ }
    if (names.length) catalogsByApp.set(dir, names.map(name => ({ rel: `${dir}${name}`, locale: name.slice(0, -5) })));
  }

  let apps = 0;
  for (const [dir, catalogs] of catalogsByApp) {
    const app = /^apps\/([^/]+)\//u.exec(dir)?.[1];
    const loaded = catalogs.map(catalog => ({ ...catalog, leaves: readCatalog(config.root, catalog.rel) })).filter(catalog => catalog.leaves);
    if (!app || !loaded.length) continue;
    apps += 1;
    const own = [...graph.files.values()].filter(file => file.rel.startsWith(`apps/${app}/src/`));
    const shared = [...graph.files.values()].filter(file => /^packages\/[^/]+\/src\//u.test(file.rel));
    const patterns = [];

    for (const file of [...own, ...shared]) {
      const visit = node => {
        if (ts.isStringLiteralLike(node)) patterns.push(node.text.split('.'));
        else if (ts.isTemplateExpression(node)) patterns.push([node.head.text, ...node.templateSpans.map(span => span.literal.text)].join('\u0000').replaceAll('\u0000', '*').split('.'));
        ts.forEachChild(node, visit);
      };
      visit(file.sourceFile);
    }

    for (const file of own) {
      const factories = new Set();
      for (const statement of file.sourceFile.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !MODULES.has(statement.moduleSpecifier.text)) continue;
        const named = statement.importClause?.namedBindings;
        if (!named || !ts.isNamedImports(named)) continue;
        for (const element of named.elements) if (!element.isTypeOnly && FACTORIES.has((element.propertyName ?? element.name).text)) factories.add(element.name.text);
      }
      if (!factories.size) continue;
      const checker = context.checkerFor(file.sourceFile.fileName);
      const namespaces = new Map();   // translator variable declaration -> namespace ('' = none); a computed namespace is left out
      const collect = node => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
          let init = node.initializer;
          if (ts.isAwaitExpression(init)) init = init.expression;
          if (ts.isCallExpression(init) && ts.isIdentifier(init.expression) && factories.has(init.expression.text)) {
            const [first] = init.arguments;
            if (first === undefined) namespaces.set(node, '');
            else if (ts.isStringLiteralLike(first)) namespaces.set(node, first.text);
            else if (ts.isObjectLiteralExpression(first)) {
              const property = first.properties.find(candidate => ts.isPropertyAssignment(candidate) && candidate.name.getText(file.sourceFile) === 'namespace');
              if (!property) namespaces.set(node, '');
              else if (ts.isStringLiteralLike(property.initializer)) namespaces.set(node, property.initializer.text);
            }
          }
        }
        ts.forEachChild(node, collect);
      };
      collect(file.sourceFile);
      if (!namespaces.size) continue;
      const keysOf = argument => {
        if (ts.isConditionalExpression(argument)) return [...keysOf(argument.whenTrue), ...keysOf(argument.whenFalse)];
        if (ts.isParenthesizedExpression(argument) || ts.isAsExpression(argument) || ts.isSatisfiesExpression(argument)) return keysOf(argument.expression);
        return ts.isStringLiteralLike(argument) ? [argument] : [];
      };
      const read = node => {
        if (ts.isCallExpression(node)) {
          const callee = node.expression;
          let owner = ts.isIdentifier(callee) ? callee : null;
          if (ts.isPropertyAccessExpression(callee) && READERS.has(callee.name.text) && ts.isIdentifier(callee.expression)) owner = callee.expression;
          const [first] = node.arguments;
          const declaration = owner ? checker.getSymbolAtLocation(owner)?.valueDeclaration : null;
          if (owner && first !== undefined && namespaces.has(declaration)) {
            for (const literal of keysOf(first)) {
              const namespace = namespaces.get(declaration);
              const full = namespace ? `${namespace}.${literal.text}` : literal.text;
              const lacking = loaded.filter(catalog => !held(catalog.leaves, full)).map(catalog => catalog.locale);
              if (lacking.length) report(file, literal, `${file.rel} reads "${full}" and ${lacking.join(', ')} ${lacking.length === 1 ? 'holds' : 'hold'} no such key; add it to every catalog of ${app} or read a key that exists`, { key: full, locales: lacking });
            }
          }
        }
        ts.forEachChild(node, read);
      };
      read(file.sourceFile);
    }

    const [primary] = [...loaded].sort((a, b) => a.locale.localeCompare(b.locale));
    const every = new Set(loaded.flatMap(catalog => [...catalog.leaves]));
    for (const leaf of [...every].sort(byCodeUnit)) {
      const segments = leaf.split('.');
      if (patterns.some(pattern => tailMatches(pattern, segments))) continue;
      violations.push({ ruleId: RULE, path: primary.rel, line: 1, column: 1, message: `${primary.rel} holds the key "${leaf}" and no source of ${app} or the shared packages reads it; delete the key from every catalog`, key: leaf });
    }
  }
  return { violations, coverage: { status: 'checked', apps } };
}
