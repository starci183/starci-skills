import path from 'node:path';
import { machineKit } from './machine-ast.mjs';

/**
 * R50 `transport-owner` (FE_TRANSPORT_OWNER), the machine half of the eslint rules `fetch-only-in-api-client` and
 * `client-fetch-has-signal`. ESLint judges one file at a time by the spelling of a call; the machine judges the app by what
 * the checker resolves. Per app of hfs.json (client module `ruleParams.fe.clientModule`, apps/<app>/src/modules/api/client.ts):
 *
 *   - the client calls the global `fetch` (an app whose client never calls it has its transport somewhere else);
 *   - no other file of the app references the global `fetch`: a call, `globalThis.fetch`, `window.fetch`, or a reference passed
 *     as a value (`useSWR(key, fetch)`, `const send = fetch`), all of which a spelling-based rule misses;
 *   - no file of the app imports an HTTP library, by static import, `import()` or `require()`;
 *   - every server reader (`modules/api/<domain>/read-*.ts`) imports the client, so a reader is a caller of the one
 *     transport and not a second one.
 */
export const TRANSPORT_OWNER_RULE_IDS = ['FE_TRANSPORT_OWNER'];

const RULE = 'FE_TRANSPORT_OWNER';
/** Packages that send HTTP requests: a second transport when an app imports one. */
const HTTP_LIBRARIES = new Set(['axios', 'ky', 'ky-universal', 'got', 'node-fetch', 'undici', 'cross-fetch', 'isomorphic-fetch', 'superagent', 'ofetch', 'whatwg-fetch']);
const GLOBAL_OBJECTS = new Set(['globalThis', 'window', 'self', 'global']);
const API_SLOT = 'fe.modules.api';

export function checkTransportOwner(input) {
  const { graph } = input;
  const kit = machineKit(input);
  const { ts, resolver } = kit;
  const violations = [];
  const report = (file, node, message, extra = {}) => violations.push({ ruleId: RULE, path: file.rel, ...kit.at(file.rel, file.sourceFile, node), message, ...extra });
  const clientPattern = resolver.ruleParams().clientModule;
  let apps = 0;
  let readers = 0;

  /** True when `node` names the global fetch: no import, and no declaration outside a lib declaration file. */
  const isGlobalFetch = (checker, node) => {
    if (ts.isIdentifier(node)) {
      if (node.text !== 'fetch' || kit.importBinding(checker, node)) return false;
      const parent = node.parent;
      if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
      // A type position (`typeof fetch`, `typeof globalThis.fetch`) names the type of fetch and sends nothing.
      if (ts.isTypeQueryNode(parent) || ts.isQualifiedName(parent)) return false;
      if ((ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent) || ts.isMethodDeclaration(parent) || ts.isBindingElement(parent) || ts.isParameter(parent) || ts.isVariableDeclaration(parent)) && parent.name === node) return false;
      if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isPropertySignature(parent)) return false;
      const declarations = kit.declarationsOf(checker, node);
      return declarations.every(declaration => declaration.getSourceFile().isDeclarationFile);
    }
    return ts.isPropertyAccessExpression(node) && node.name.text === 'fetch' && ts.isIdentifier(node.expression) && GLOBAL_OBJECTS.has(node.expression.text);
  };

  for (const app of resolver.repo.apps.filter(item => item.kind === 'next')) {
    const clientRel = clientPattern.replace('<app>', app.name);
    const appPrefix = `apps/${app.name}/`;
    const files = [...graph.files.values()].filter(file => file.rel.startsWith(appPrefix));
    if (!files.length) continue;
    apps += 1;
    let clientCalls = 0;
    for (const file of files) {
      const checker = kit.checkerOf(file.sourceFile);
      const isClient = file.rel === clientRel;
      kit.walk(file.sourceFile, node => {
        if (ts.isPropertyAccessExpression(node) && isGlobalFetch(checker, node)) {
          if (isClient) clientCalls += 1;
          else report(file, node, `${node.getText(file.sourceFile)} reaches the global fetch outside ${clientRel}; the app has one transport. Call the client and take its Outcome.`, { app: app.name });
          return false;
        }
        if (ts.isIdentifier(node) && isGlobalFetch(checker, node)) {
          if (isClient) clientCalls += 1;
          else report(file, node, `fetch is used outside ${clientRel} (called, aliased or passed as a value); the app has one transport. Call the client and take its Outcome.`, { app: app.name });
          return false;
        }
        const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
          : ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) ? node.arguments[0] : null;
        if (specifier && ts.isStringLiteralLike(specifier) && HTTP_LIBRARIES.has(specifier.text.split('/')[0])) {
          report(file, node, `${specifier.text} is a second HTTP transport in app ${app.name}; the app's one transport is ${clientRel}, built on fetch. Use the client.`, { app: app.name, library: specifier.text });
        }
        return true;
      });
      if (file.slot === API_SLOT && path.posix.basename(file.rel).startsWith('read-') && file.rel.slice(file.rel.indexOf('/modules/api/') + '/modules/api/'.length).includes('/')) {
        readers += 1;
        if (!graph.edges.some(edge => edge.from === file.rel && edge.to === clientRel && edge.runtime)) {
          report(file, file.sourceFile, `${file.rel} is a server reader that does not import ${clientRel}; a reader fetches through the app's one client, never through its own transport.`, { app: app.name });
        }
      }
    }
    const client = graph.files.get(clientRel);
    if (client && clientCalls === 0) report(client, client.sourceFile, `${clientRel} never calls the global fetch; the client is the one module that owns fetch, with its timeout and abort signal.`, { app: app.name });
  }
  return { violations, coverage: { status: 'checked', apps, readers } };
}
