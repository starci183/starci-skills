// base-pure.mjs - RT_BASE_IMPURE (knowledge/hfs/rules.yaml, gate runtime): the base tier (engine foundation, scripts/lib)
// never writes the filesystem and reads process.env only in a declared seam (ruleParams.runtime.baseEnvSeams).
//   a write   a call of a member of ruleParams.runtime.baseWriteMembers reached through a node:fs or node:fs/promises
//             binding: a named import (aliases kept), the module itself (fs.writeFileSync, fs.promises.rm), a require()
//   an env    a read of process.env outside the seams
// The tier comes from the file's slot (resolver.tierOf), never from its path. Pure.
import { fsBindings, fsMemberAccess, lineOf, ts } from './source-ast.mjs';

export const CODE = 'RT_BASE_IMPURE';

/** The RT_BASE_IMPURE findings of one base-tier source. */
export function fileBaseFindings({ path: file, source, writeMembers, envSeam }) {
  const t = ts();
  const members = new Set(writeMembers);
  const { namespaces, members: functions } = fsBindings(source, (imported) => members.has(imported));
  const found = [];
  /** The fs write member `callee` reaches, or null: fs.X, fs.promises.X, a named import of X. */
  const writeOf = (callee) => t.isIdentifier(callee) ? functions.get(callee.text) ?? null : fsMemberAccess(t, callee, namespaces, (name) => members.has(name));
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
