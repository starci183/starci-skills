// fe-contract-documents.mjs - FE_GRAPHQL_CONTRACT (R113): every GraphQL document a front end sends is one its back end
// serves. An app keeps the contract of each GraphQL service it runs as a snapshot, `be/contracts/<service>/schema.graphql`
// (`starci app emit`, HFS_CONTRACT_SNAPSHOT_DRIFT keeps it current), and its front end keeps every operation it sends
// in a `.graphql` file or a `gql` template under `fe/`. Each operation is judged against the contract of the service that serves its first
// root field (the one snapshot whose root type declares it): a root field no contract declares, a field, argument or input
// field the contract does not declare, a required argument left out, a variable of another type, a leaf with a selection or
// an object without one is a finding on the document. The finding names the service and every problem.
import { operationProblems, parseDocument, parseSchema, rootFieldsOf } from '../../lib/graphql-contract.mjs';
import { found, readText } from './read.mjs';
import { byCodeUnit } from '../../lib/list.mjs';
import { fileURLToPath } from 'node:url';
import { loadTypescript } from '../../lib/package-at.mjs';
import { isConstVariable, sourceLocation } from '../../lib/ts-ast.mjs';

export const FE_GRAPHQL_CONTRACT = 'FE_GRAPHQL_CONTRACT';

const CONTRACT = /^be\/contracts\/([^/]+)\/schema\.graphql$/;
const isFrontend = (file) => file.startsWith('fe/') && !file.includes('/__generated__/') && !file.includes('/node_modules/');
const isDocument = (file) => isFrontend(file) && file.endsWith('.graphql');
const isSource = (file) => isFrontend(file) && /\.[cm]?[jt]sx?$/.test(file) && !file.endsWith('.d.ts');
const HERE = fileURLToPath(new URL('.', import.meta.url));

/** Local names of gql imports (including a graphql-tag default import), alongside the canonical gql spelling. */
function addGqlImportNames(ts, statement, names) {
  if (!ts.isImportDeclaration(statement)) return;
  const clause = statement.importClause;
  if (statement.moduleSpecifier.text === 'graphql-tag' && clause?.name) names.add(clause.name.text);
  const bindings = clause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) return;
  for (const entry of bindings.elements) {
    if ((entry.propertyName ?? entry.name).text === 'gql') names.add(entry.name.text);
  }
}

function gqlNames(ts, source) {
  const names = new Set(['gql']);
  for (const statement of source.statements) addGqlImportNames(ts, statement, names);
  return names;
}

const isGqlTag = (ts, tag, names) => (ts.isIdentifier(tag) && names.has(tag.text)) || (ts.isPropertyAccessExpression(tag) && tag.name.text === 'gql');

/** Resolve literal fragment substitutions without evaluating source code. Unknown or cyclic values cannot be judged. */
function templateText(ts, node, checker, names, visiting = new Set()) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isIdentifier(node)) {
    const symbol = checker.getSymbolAtLocation(node);
    const declaration = symbol?.valueDeclaration;
    if (symbol?.declarations?.length !== 1 || !declaration || !ts.isVariableDeclaration(declaration)
      || !ts.isIdentifier(declaration.name) || !isConstVariable(ts, declaration) || !declaration.initializer || visiting.has(declaration)) return null;
    return templateText(ts, declaration.initializer, checker, names, new Set([...visiting, declaration]));
  }
  if (ts.isTaggedTemplateExpression(node) && isGqlTag(ts, node.tag, names)) return templateText(ts, node.template, checker, names, visiting);
  if (!ts.isTemplateExpression(node)) return null;
  let text = node.head.text;
  for (const span of node.templateSpans) {
    const value = templateText(ts, span.expression, checker, names, visiting);
    if (value === null) return null;
    text += value + span.literal.text;
  }
  return text;
}

/** Bind this file in isolation: the compiler resolves lexical names, but imports and library files are never loaded. */
function lexicalChecker(ts, source) {
  const options = { noLib: true, noResolve: true, allowJs: true };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (file) => file === source.fileName ? source : undefined;
  host.fileExists = () => false;
  host.readFile = () => undefined;
  return ts.createProgram([source.fileName], options, host).getTypeChecker();
}

/** Actual tagged-template AST nodes: comments, quoted examples and other template tags are not operations. */
function gqlDocuments(ts, file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const names = gqlNames(ts, source);
  const templates = [];
  const visit = (node) => {
    if (ts.isTaggedTemplateExpression(node) && isGqlTag(ts, node.tag, names)) templates.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (templates.length === 0) return [];
  const checker = lexicalChecker(ts, source);
  return templates.map((node) => ({ text: templateText(ts, node.template, checker, names), ...sourceLocation(source, node) }));
}

/** The parsed contracts of the app: [{ service, path, schema }], or a finding for a snapshot that does not parse. */
function contractsOf(repoRoot, files, findings) {
  const contracts = [];
  for (const file of files) {
    const match = CONTRACT.exec(file);
    if (!match) continue;
    const text = readText(repoRoot, file);
    if (text === null) continue;
    try {
      contracts.push({ service: match[1], path: file, schema: parseSchema(text) });
    } catch (error) {
      findings.push(found(FE_GRAPHQL_CONTRACT, file, `${file} is not a GraphQL schema the front-end documents can be judged against: ${error.message}. Run \`npm run contract:emit\`.`));
    }
  }
  return contracts;
}

function operationFindings(file, document, operation, contracts) {
  const label = operation.name ?? `anonymous ${operation.operation}`;
  const [first] = rootFieldsOf(operation);
  const serving = contracts.filter(({ schema }) => schema.types.get(schema.roots[operation.operation])?.fields?.has(first));
  if (serving.length === 0) {
    const where = contracts.length === 0 ? 'the app keeps no be/contracts/<service>/schema.graphql' : `no contract of ${contracts.map((c) => c.path).join(', ')} declares ${operation.operation} ${first}`;
    return [found(FE_GRAPHQL_CONTRACT, file, `${file}: ${label} asks ${operation.operation} ${first}, but ${where}; the front end sends only what a back end serves.`, { operation: label, service: null })];
  }
  const [contract] = serving;
  const problems = operationProblems(contract.schema, document, operation);
  if (problems.length > 0) return [found(FE_GRAPHQL_CONTRACT, file, `${file}: ${label} does not match the ${contract.service} contract (${contract.path}): ${problems.join('; ')}.`, { operation: label, service: contract.service, problems })];
  return [];
}

function documentFindings(file, text, contracts) {
  let document;
  try {
    document = parseDocument(text);
  } catch (error) {
    return [found(FE_GRAPHQL_CONTRACT, file, `${file} is not a GraphQL document: ${error.message}.`)];
  }
  return document.operations.flatMap((operation) => operationFindings(file, document, operation, contracts));
}

function sourceDocuments(ts, file, text, findings) {
  if (!ts) {
    findings.push(found(FE_GRAPHQL_CONTRACT, file, `${file} gql templates cannot be judged: no TypeScript resolves from the app; install the app's dependencies.`));
    return [];
  }
  const documents = [];
  for (const template of gqlDocuments(ts, file, text)) {
    if (template.text === null) findings.push(found(FE_GRAPHQL_CONTRACT, file, `${file}:${template.line} gql template has a substitution that cannot be resolved to static GraphQL text.`, { line: template.line, column: template.column }));
    else documents.push({ file, ...template });
  }
  return documents;
}

function documentsOf(repoRoot, files, findings) {
  const candidates = files.filter((file) => isDocument(file) || isSource(file)).sort(byCodeUnit);
  const ts = candidates.some(isSource) ? loadTypescript(repoRoot, HERE) : null;
  const documents = [];
  for (const file of candidates) {
    const text = readText(repoRoot, file);
    if (text === null) continue;
    if (isDocument(file)) documents.push({ file, text });
    else documents.push(...sourceDocuments(ts, file, text, findings));
  }
  return documents;
}

/** The findings of R113 over the tracked paths `files` of the app at `repoRoot`. */
export function feContractFindings({ repoRoot, files }) {
  const findings = [];
  const documents = documentsOf(repoRoot, files, findings);
  if (documents.length === 0) return findings;
  const contracts = contractsOf(repoRoot, files, findings);
  for (const { file, text, line, column } of documents) {
    const entries = documentFindings(file, text, contracts);
    findings.push(...entries.map((entry) => line ? { ...entry, line, column } : entry));
  }
  return findings;
}
