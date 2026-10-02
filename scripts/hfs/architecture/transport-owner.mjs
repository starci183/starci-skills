import path from 'node:path';
import { machineKit } from './machine-ast.mjs';

/**
 * R50 `transport-owner` (FE_TRANSPORT_OWNER), the machine half of the eslint rules `fetch-only-in-api-client` and
 * `client-fetch-has-signal`. ESLint judges one file at a time by the spelling of a call; the machine judges the repository by
 * what the checker resolves. A repository has exactly ONE transport client and ONE Outcome union, both named by slot (never
 * by a path spelled here): the api package's (`fe.package.api.client`, `fe.package.api.outcome`) when the repository shares
 * it, or the only app's (`fe.transport.client`, `fe.transport.outcome`) when the repository declares exactly one app. The
 * Outcome homes are the slots the manifest marks `outcomeHome` (the lite edition adds `fe.modules.db.outcome`), not a list kept here.
 *
 *   - two or more clients, or two or more Outcome unions, in the repository (two apps each keeping one, or a package one plus
 *     an app one) are findings on every copy;
 *   - an app client or app Outcome union in a repository that declares more than one app is a finding (it belongs to the package);
 *   - the client calls the global `fetch` (a client that never calls it has its transport somewhere else);
 *   - no other file references the global `fetch`: a call, `globalThis.fetch`, `window.fetch`, or a reference passed as a value
 *     (`useSWR(key, fetch)`, `const send = fetch`), all of which a spelling-based rule misses; with no client at all every such
 *     reference is a finding that says the repository has no client;
 *   - no file imports an HTTP library, by static import, `import()` or `require()`;
 *   - every server reader (`modules/api/<domain>/read-*.ts`) imports the client (or the api package that holds it), so a reader
 *     is a caller of the one transport and not a second one.
 */
export const TRANSPORT_OWNER_RULE_IDS = ['FE_TRANSPORT_OWNER'];

const RULE = 'FE_TRANSPORT_OWNER';
/** Packages that send HTTP requests: a second transport when a file imports one. */
const HTTP_LIBRARIES = new Set(['axios', 'ky', 'ky-universal', 'got', 'node-fetch', 'undici', 'cross-fetch', 'isomorphic-fetch', 'superagent', 'ofetch', 'whatwg-fetch']);
const GLOBAL_OBJECTS = new Set(['globalThis', 'window', 'self', 'global']);
const API_SLOT = 'fe.modules.api';
const APP_CLIENT_SLOT = 'fe.transport.client';
const APP_OUTCOME_SLOT = 'fe.transport.outcome';
const PACKAGE_API_SLOT = 'fe.package.api';
const CLIENT_SLOTS = new Set([APP_CLIENT_SLOT, 'fe.package.api.client']);
const NO_CLIENT = "the repository has no transport client. Create the one client (packages/<family>-api/src/client.ts, or the only app's modules/api/client.ts) and call it.";

export function checkTransportOwner(input) {
  const { graph } = input;
  const kit = machineKit(input);
  const { ts, resolver } = kit;
  const violations = [];
  const report = (file, node, message, extra = {}) => violations.push({ ruleId: RULE, path: file.rel, ...kit.at(file.rel, file.sourceFile, node), message, ...extra });
  const nextApps = resolver.repo.apps.filter(item => item.kind === 'next');
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

  const files = [...graph.files.values()].filter(file => file.slot && file.tier !== 'e2e');
  const clients = files.filter(file => CLIENT_SLOTS.has(file.slot));
  const outcomes = files.filter(file => resolver.slot(file.slot)?.outcomeHome === true);
  const clientRels = new Set(clients.map(file => file.rel));
  const list = items => items.map(item => item.rel).join(', ');
  const owned = clients.length ? `the repository has one transport (${list(clients)}). Call the client and take its Outcome.` : NO_CLIENT;

  // Exactly one client and one Outcome union per repository.
  for (const [items, noun] of [[clients, 'transport client'], [outcomes, 'Outcome union']]) {
    for (const file of items) {
      if (items.length > 1) report(file, file.sourceFile, `The repository has ${items.length} ${noun}s (${list(items)}); it has exactly one: the api package's (packages/<family>-api/src/) when the apps share it, or the only app's. Keep one and delete the others.`);
      else if ((file.slot === APP_CLIENT_SLOT || file.slot === APP_OUTCOME_SLOT) && nextApps.length > 1) {
        report(file, file.sourceFile, `${file.rel} is an app's ${noun} in a repository of ${nextApps.length} apps; a repository with several apps keeps its one ${noun} in the api package (packages/<family>-api/src/).`);
      }
    }
  }

  const appsWithFiles = new Set();
  for (const file of files) {
    const bindings = resolver.classifyPath(file.rel).bindings;
    if (bindings?.app) appsWithFiles.add(bindings.app);
    const checker = kit.checkerOf(file.sourceFile);
    const isClient = clientRels.has(file.rel);
    let clientCalls = 0;
    kit.walk(file.sourceFile, node => {
      if (ts.isPropertyAccessExpression(node) && isGlobalFetch(checker, node)) {
        if (isClient) clientCalls += 1;
        else report(file, node, `${node.getText(file.sourceFile)} reaches the global fetch outside the transport client; ${owned}`);
        return false;
      }
      if (ts.isIdentifier(node) && isGlobalFetch(checker, node)) {
        if (isClient) clientCalls += 1;
        else report(file, node, `fetch is used outside the transport client (called, aliased or passed as a value); ${owned}`);
        return false;
      }
      const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
        : ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) ? node.arguments[0] : null;
      if (specifier && ts.isStringLiteralLike(specifier) && HTTP_LIBRARIES.has(specifier.text.split('/')[0])) {
        report(file, node, `${specifier.text} is a second HTTP transport; the repository's one transport is built on fetch (${clients.length ? list(clients) : 'no client exists yet'}). Use the client.`, { library: specifier.text });
      }
      return true;
    });
    if (isClient && clientCalls === 0) report(file, file.sourceFile, `${file.rel} never calls the global fetch; the client is the one module that owns fetch, with its timeout and abort signal.`);
    if (file.slot === API_SLOT && bindings?.app && path.posix.basename(file.rel).startsWith('read-')) {
      readers += 1;
      const reachesClient = graph.edges.some(edge => edge.from === file.rel && edge.runtime
        && (clientRels.has(edge.to) || graph.files.get(edge.to)?.slot === PACKAGE_API_SLOT));
      if (!reachesClient) report(file, file.sourceFile, `${file.rel} is a server reader that does not import the transport client; a reader fetches through the repository's one client, never through its own transport.`);
    }
  }
  return { violations, coverage: { status: 'checked', apps: appsWithFiles.size, readers, clients: clients.length, outcomes: outcomes.length } };
}
