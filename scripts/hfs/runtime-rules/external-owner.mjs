// external-owner.mjs - RT_EXTERNAL_OWNER (knowledge/hfs/rules.yaml, gate runtime): a process, the network, SQLite or an
// external binary is reached only by its owner in ruleParams.runtime.infraOwners of knowledge/hfs/runtime-slots.yaml.
//   modules   an import, re-export, require() or import() of an owned module specifier (node:child_process, node:sqlite...)
//   globals   a call or construction of an owned global (fetch, WebSocket) that the file does not bind itself
//   programs  a child-process call whose command names an owned program (git, npm, orca, powershell...; process.execPath
//             reads as node), read with the TypeScript AST by scripts/lib/spawn-calls.mjs
// The owner of a file comes from its slot, never from its path: a file of the api tier is owned by api/<system> (the
// <system> its slot binds), a file of the db tier by engine/db; any other file owns nothing. Pure.
import { spawnCalls } from '../../lib/spawn-calls.mjs';
import { lineOf, localBindings, moduleRefs, ts } from './source-ast.mjs';

export const CODE = 'RT_EXTERNAL_OWNER';

/** The owner id of `file` under `resolver` (api/<system>, engine/db) or null. */
export function ownerIdOf(resolver, file) {
  const tier = resolver.tierOf(file);
  if (tier === 'db') return 'engine/db';
  if (tier !== 'api') return null;
  const system = resolver.classifyPath(file).bindings?.system ?? resolver.ownerOf(file)?.bindings?.system;
  return system ? `api/${system}` : null;
}

/** True when `owner` is one of `owners` (api/* admits every api system). */
export const ownedBy = (owners, owner) => Boolean(owner) && owners.some((o) => o === owner || (o === 'api/*' && owner.startsWith('api/')));

const describe = (owners) => (owners.length ? owners.join(', ') : 'nowhere in runtime production code');

/** The RT_EXTERNAL_OWNER findings of one source file. */
export function fileExternalFindings({ path: file, text, source, owner, infraOwners }) {
  const t = ts();
  const found = [];
  const add = (line, what, owners) => found.push({ code: CODE, level: 'error', path: file, line, message: `${file}:${line} ${what}; only ${describe(owners)} may (${owner ? `this file is ${owner}` : 'this file owns no external system'}) - move the call into its scripts/api/<system>/ call file and import that` });
  for (const ref of moduleRefs(source)) {
    const owners = infraOwners.modules[ref.module];
    if (owners && !ownedBy(owners, owner)) add(ref.line, `imports ${ref.module}`, owners);
  }
  const globals = Object.keys(infraOwners.globals);
  if (globals.length && globals.some((name) => text.includes(name))) {
    const bound = localBindings(source);
    const visit = (node) => {
      if (t.isCallExpression(node) || t.isNewExpression(node)) {
        const callee = node.expression;
        const name = t.isIdentifier(callee) ? (bound.has(callee.text) ? null : callee.text)
          : (t.isPropertyAccessExpression(callee) && t.isIdentifier(callee.expression) && ['globalThis', 'window', 'global'].includes(callee.expression.text) ? callee.name.text : null);
        const owners = name && Object.hasOwn(infraOwners.globals, name) ? infraOwners.globals[name] : null;
        if (owners && !ownedBy(owners, owner)) add(lineOf(source, node), `calls the global ${name}`, owners);
      }
      t.forEachChild(node, visit);
    };
    visit(source);
  }
  for (const call of spawnCalls(text, file).calls) {
    for (const program of call.programs) {
      const owners = Object.hasOwn(infraOwners.programs, program) ? infraOwners.programs[program] : null;
      if (owners && !ownedBy(owners, owner)) add(call.line, `${call.callee}() starts ${program}`, owners);
    }
  }
  return found;
}

/** RT_EXTERNAL_OWNER over the runtime's production sources (ctx of scripts/hfs/runtime-check.mjs). */
export function externalOwnerFindings(ctx) {
  const { infraOwners } = ctx.params;
  return ctx.sources.flatMap(({ path: file, text }) => fileExternalFindings({ path: file, text, source: ctx.parsed(file), owner: ownerIdOf(ctx.resolver, file), infraOwners }));
}
