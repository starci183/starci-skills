// release-terminal-shape.mjs — the narrow native call admitted by the host boundary, not a whole-file exemption.
import { skillRoot } from '../../../engine/runtime-root.mjs';
import { loadTypescript } from '../../lib/package-at.mjs';

const VERB = 'terminal' + '-' + 'create';
const ADAPTER = 'scripts/api/orca/terminal-create.mjs';
const CONSUMER = 'scripts/supervisor/release-terminal.mjs';
const FACTORY = 'create' + 'ReleaseTerminal';
const identifier = (ts, node, text) => ts.isIdentifier(node) && node.text === text;
const literal = (ts, node, text) => ts.isStringLiteralLike(node) && node.text === text;

/**
 * Locate only the terminal-create literal in the adapter's single fixed native call.
 * Aliases, rebinding, destructuring, a second runner call and spread/computed/extra properties refuse the exemption.
 * @param {string} text - One source file's actual bytes.
 * @param {string} file - Its repository-relative path.
 * @returns {object|null} The literal's start/end range; null leaves every create occurrence red.
 */
export function releaseTerminalCallRange(text, file) {
  if (file !== ADAPTER) return null;
  const ts = loadTypescript(skillRoot);
  if (!ts) return null;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (source.parseDiagnostics.length) return null;
  const references = [], calls = [], imports = [];
  const visit = (node) => {
    if (identifier(ts, node, 'orcaCall')) references.push(node);
    if (ts.isCallExpression(node) && identifier(ts, node.expression, 'orcaCall')) calls.push(node);
    if (ts.isImportDeclaration(node) && literal(ts, node.moduleSpecifier, './lib.mjs')) imports.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (imports.length !== 1 || calls.length !== 1 || references.length !== 2) return null;
  const binding = imports[0].importClause?.namedBindings;
  if (!binding || !ts.isNamedImports(binding) || binding.elements.length !== 1
    || binding.elements[0].propertyName || !identifier(ts, binding.elements[0].name, 'orcaCall')) return null;
  const call = calls[0];
  if (call.arguments.length !== 2 || !literal(ts, call.arguments[0], VERB) || !ts.isObjectLiteralExpression(call.arguments[1])) return null;
  if (!ts.isReturnStatement(call.parent)) return null;
  const owner = call.parent.parent?.parent;
  if (!owner || !ts.isFunctionDeclaration(owner) || !identifier(ts, owner.name, FACTORY) || owner.parameters.length) return null;
  const properties = call.arguments[1].properties;
  if (properties.length !== 3 || properties.some((prop) => !ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name))) return null;
  if (!identifier(ts, properties[0].name, 'worktree') || !ts.isPropertyAccessExpression(properties[0].initializer)
    || !identifier(ts, properties[0].initializer.expression, 'selected') || !identifier(ts, properties[0].initializer.name, 'id')) return null;
  if (!identifier(ts, properties[1].name, 'shell') || !literal(ts, properties[1].initializer, 'powershell.exe')) return null;
  if (!identifier(ts, properties[2].name, 'title') || !literal(ts, properties[2].initializer, '[Release] StarCi runtime')) return null;
  return { start: call.arguments[0].getStart(source), end: call.arguments[0].end,
    identifierRanges: [{ start: owner.name.getStart(source), end: owner.name.end }] };
}

/**
 * Admit the factory import and zero-argument call only in its real release consumer.
 * Another file, import alias, rebound/destructured factory or extra call has no admitted identifiers.
 * @param {string} text - The consumer's source text.
 * @param {string} file - Repository-relative path.
 * @returns {Array<object>} The two exact identifier ranges, or none.
 */
export function releaseTerminalConsumerRanges(text, file) {
  if (file !== CONSUMER) return [];
  const ts = loadTypescript(skillRoot);
  if (!ts) return [];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (source.parseDiagnostics.length) return [];
  const references = [], calls = [], imports = [];
  const visit = (node) => {
    if (identifier(ts, node, FACTORY)) references.push(node);
    if (ts.isCallExpression(node) && identifier(ts, node.expression, FACTORY)) calls.push(node);
    if (ts.isImportDeclaration(node) && literal(ts, node.moduleSpecifier, '../api/orca/terminal-create.mjs')) imports.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (imports.length !== 1 || references.length !== 2 || calls.length !== 1 || calls[0].arguments.length) return [];
  const binding = imports[0].importClause?.namedBindings;
  if (!binding || !ts.isNamedImports(binding) || binding.elements.length !== 1
    || binding.elements[0].propertyName || !identifier(ts, binding.elements[0].name, FACTORY)) return [];
  let owner = calls[0].parent;
  while (owner && !ts.isFunctionDeclaration(owner)) owner = owner.parent;
  if (!owner || !identifier(ts, owner.name, 'prepareReleaseTerminal')) return [];
  return references.map((node) => ({ start: node.getStart(source), end: node.end }));
}
