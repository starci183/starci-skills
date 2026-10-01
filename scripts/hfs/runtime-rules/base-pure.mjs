// base-pure.mjs - RT_BASE_IMPURE (knowledge/hfs/rules.yaml, gate runtime): the base tier (engine foundation, scripts/lib)
// never writes the filesystem and reads process.env only in a declared seam (ruleParams.runtime.baseEnvSeams).
//   a write   a call of a member of ruleParams.runtime.baseWriteMembers reached through a node:fs or node:fs/promises
//             binding: a named import (aliases kept), the module itself (fs.writeFileSync, fs.promises.rm), a require()
//   an env    a read of process.env outside the seams
// The tier comes from the file's slot (resolver.tierOf), never from its path. Pure.
import { lineOf, ts } from './source-ast.mjs';

export const CODE = 'RT_BASE_IMPURE';
const FS_MODULES = new Set(['fs', 'node:fs', 'fs/promises', 'node:fs/promises']);

/** The RT_BASE_IMPURE findings of one base-tier source. */
export function fileBaseFindings({ path: file, source, writeMembers, envSeam }) {
  const t = ts();
  const members = new Set(writeMembers);
  const namespaces = new Set();
  const functions = new Map();
  const found = [];
  const fsModule = (node) => Boolean(node && t.isStringLiteralLike(node) && FS_MODULES.has(node.text));
  const requireOf = (node) => node && t.isCallExpression(node) && t.isIdentifier(node.expression) && node.expression.text === 'require' && fsModule(node.arguments[0]);
  const bind = (node) => {
    if (t.isImportDeclaration(node) && fsModule(node.moduleSpecifier)) {
      const c = node.importClause;
      if (c?.name) namespaces.add(c.name.text);
      const b = c?.namedBindings;
      if (b && t.isNamespaceImport(b)) namespaces.add(b.name.text);
      if (b && t.isNamedImports(b)) for (const el of b.elements) {
        const imported = (el.propertyName ?? el.name).text;
        if (imported === 'promises') namespaces.add(el.name.text);
        else if (members.has(imported)) functions.set(el.name.text, imported);
      }
    }
    if (t.isVariableDeclaration(node) && requireOf(node.initializer)) {
      if (t.isIdentifier(node.name)) namespaces.add(node.name.text);
      else if (t.isObjectBindingPattern(node.name)) for (const el of node.name.elements) {
        const imported = el.propertyName && t.isIdentifier(el.propertyName) ? el.propertyName.text : t.isIdentifier(el.name) ? el.name.text : null;
        if (imported && members.has(imported) && t.isIdentifier(el.name)) functions.set(el.name.text, imported);
      }
    }
    t.forEachChild(node, bind);
  };
  bind(source);
  /** The fs write member `callee` reaches, or null: fs.X, fs.promises.X, a named import of X. */
  const writeOf = (callee) => {
    if (t.isIdentifier(callee)) return functions.get(callee.text) ?? null;
    if (!t.isPropertyAccessExpression(callee) || !members.has(callee.name.text)) return null;
    const target = callee.expression;
    if (t.isIdentifier(target) && namespaces.has(target.text)) return callee.name.text;
    if (t.isPropertyAccessExpression(target) && target.name.text === 'promises' && t.isIdentifier(target.expression) && namespaces.has(target.expression.text)) return callee.name.text;
    return null;
  };
  const visit = (node) => {
    if (t.isCallExpression(node)) {
      const member = writeOf(node.expression);
      if (member) found.push({ code: CODE, level: 'error', path: file, line: lineOf(source, node), message: `${file}:${lineOf(source, node)} calls fs ${member}(): the base tier writes nothing - move the write into its owner (scripts/api/fs, engine/db or a domain module) and pass the base helper what it needs` });
    }
    if (!envSeam && t.isPropertyAccessExpression(node) && node.name.text === 'env' && t.isIdentifier(node.expression) && node.expression.text === 'process') {
      found.push({ code: CODE, level: 'error', path: file, line: lineOf(source, node), message: `${file}:${lineOf(source, node)} reads process.env: the base tier reads the environment only in its declared seams (ruleParams.runtime.baseEnvSeams) - take the value as a parameter` });
    }
    t.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** RT_BASE_IMPURE over every production source whose slot tier is base. */
export function basePureFindings(ctx) {
  const { baseWriteMembers, baseEnvSeams } = ctx.params;
  const seams = new Set(baseEnvSeams);
  return ctx.sources
    .filter(({ path: file }) => ctx.resolver.tierOf(file) === 'base')
    .flatMap(({ path: file }) => fileBaseFindings({ path: file, source: ctx.parsed(file), writeMembers: baseWriteMembers, envSeam: seams.has(file) }));
}
