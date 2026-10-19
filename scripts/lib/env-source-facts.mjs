// The shared AST owner of named environment reads and injected environment aliases. No source is executed.
import {lineOf, parseSource, ts} from '../hfs/runtime-rules/source-ast.mjs';

const OWN_NAMESPACE = /^STARCI_[A-Z0-9_]+$/;
/** An injected env may contain unrelated lower-case fields; only these names are environment variables. */
const VARIABLE_NAME = /^[A-Z][A-Z0-9_]*$/;

/** Environment reads, dynamic reads, mentions, literal names and the existing injected/process environment aliases. */
export function envFacts(text, rel = 'x.mjs') {
  const t = ts();
  const source = parseSource(text, rel);
  const aliases = new Set(['env']);
  const isProcessEnv = (node) => t.isPropertyAccessExpression(node) && t.isIdentifier(node.expression) && node.expression.text === 'process' && node.name.text === 'env';
  // aliases: `const e = process.env`, `function f(e = process.env)`, `{ env: e = process.env }`
  const collect = (node) => {
    if ((t.isVariableDeclaration(node) || t.isParameter(node) || t.isBindingElement(node)) && node.initializer && isProcessEnv(node.initializer) && t.isIdentifier(node.name)) aliases.add(node.name.text);
    t.forEachChild(node, collect);
  };
  collect(source);
  const reads = [];
  const dynamic = [];
  const mentions = [];
  const literals = [];
  const kindOf = (object) => {
    if (isProcessEnv(object)) return 'direct';
    return t.isIdentifier(object) && aliases.has(object.text) ? 'injected' : null;
  };
  const assignedOrDeleted = (node) => {
    const p = node.parent;
    return (t.isBinaryExpression(p) && p.left === node && p.operatorToken.kind >= t.SyntaxKind.FirstAssignment && p.operatorToken.kind <= t.SyntaxKind.LastAssignment)
      || (t.isDeleteExpression(p) && p.expression === node);
  };
  const elementRead = (node) => {
    const kind = kindOf(node.expression);
    if (!kind || assignedOrDeleted(node)) return;
    if (t.isStringLiteralLike(node.argumentExpression)) {
      if (kind === 'direct' || VARIABLE_NAME.test(node.argumentExpression.text)) reads.push({ name: node.argumentExpression.text, line: lineOf(source, node), direct: kind === 'direct' });
    } else if (kind === 'direct') dynamic.push({ line: lineOf(source, node), direct: true });
  };
  const bindingReads = (node) => {
    for (const el of node.name.elements) if (t.isIdentifier(el.propertyName ?? el.name) && (kindOf(node.initializer) === 'direct' || VARIABLE_NAME.test((el.propertyName ?? el.name).text))) reads.push({ name: (el.propertyName ?? el.name).text, line: lineOf(source, node), direct: kindOf(node.initializer) === 'direct' });
  };
  const visit = (node) => {
    if (t.isPropertyAccessExpression(node)) {
      const kind = kindOf(node.expression);
      if (kind && !assignedOrDeleted(node) && (kind === 'direct' || VARIABLE_NAME.test(node.name.text))) reads.push({ name: node.name.text, line: lineOf(source, node), direct: kind === 'direct' });
    } else if (t.isElementAccessExpression(node)) elementRead(node);
    else if (t.isVariableDeclaration(node) && node.initializer && t.isObjectBindingPattern(node.name) && kindOf(node.initializer)) bindingReads(node);
    else if (t.isCallExpression(node) && t.isIdentifier(node.expression) && node.expression.text === 'readEnv' && node.arguments.length > 0 && t.isStringLiteralLike(node.arguments[0])) {
      reads.push({ name: node.arguments[0].text, line: lineOf(source, node), direct: false });
    } else if ((t.isStringLiteralLike(node) || t.isIdentifier(node)) && OWN_NAMESPACE.test(node.text)) mentions.push({ name: node.text, line: lineOf(source, node) });
    if (t.isStringLiteralLike(node) && VARIABLE_NAME.test(node.text)) literals.push(node.text);
    t.forEachChild(node, visit);
  };
  visit(source);
  return { reads, dynamic, mentions, literals, aliases };
}
