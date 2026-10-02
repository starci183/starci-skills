import path from 'node:path';
import { canonical, isInside } from './config.mjs';
import { relativePath, workspaceExportSources } from './typescript.mjs';
import { sourceLocation } from '../../lib/ts-ast.mjs';
import { isServerActionModule } from './server-action.mjs';

function absolute(root, relative) {
  return canonical(path.resolve(root, ...relative.split('/')));
}

/** The owner's public entries: its declared entry, plus every source file its package.json `exports` maps when the owner is a workspace package. */
function ownerDeclarations(config, context) {
  return config.owners.map(owner => {
    const root = absolute(config.root, owner.root);
    const entry = absolute(config.root, owner.entry);
    const workspace = context.workspaces?.find(item => item.root === root);
    const entries = new Set([entry, ...(workspace ? workspaceExportSources(context.ts, workspace) : [])]);
    return { ...owner, root, entry, entries };
  }).sort((a, b) => b.root.length - a.root.length);
}

function ownerOf(owners, file) {
  return owners.find(owner => isInside(owner.root, file)) ?? null;
}

function privateOwnerChain(context, owners, actionEntries, edge) {
  const sourceOwner = ownerOf(owners, edge.from);
  const queue = [{ file: edge.to, chain: [edge.from, edge.to] }];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current.file)) continue;
    visited.add(current.file);
    const owner = ownerOf(owners, current.file);
    if (owner && sourceOwner?.id !== owner.id) return owner.entries.has(current.file) || actionEntries.has(current.file) ? null : { owner, chain: current.chain };
    for (const candidate of context.edges.get(current.file) ?? []) if (candidate.reexport) {
      queue.push({ file: candidate.to, chain: [...current.chain, candidate.to] });
    }
  }
  return null;
}

/**
 * A `*.builder.ts` of slot be.tests.fixtures.builders arranges data at the schema level: it may deep-import the persistence
 * entity classes and connection entity lists (slot be.persistence) of any capability. No other file may.
 */
function arrangesSchema(config, from, to) {
  const resolver = config.hfs;
  if (!resolver?.classifyPath) return false;
  return resolver.classifyPath(relativePath(config.root, from)).slot === 'be.tests.fixtures.builders'
    && resolver.classifyPath(relativePath(config.root, to)).slot === 'be.persistence';
}

/** Enforce explicit same-source owner entries without constraining imports inside one owner. */
export function checkOwners(config, context) {
  if (!config.owners?.length) return [];
  const owners = ownerDeclarations(config, context);
  const violations = [];
  const sourceFiles = new Map(context.files.map(file => [canonical(file.fileName), file]));
  const actionEntries = new Set(config.kinds.includes('frontend')
    ? [...sourceFiles].filter(([, file]) => isServerActionModule(context.ts, file)).map(([name]) => name)
    : []);
  for (const owner of owners) {
    const sourceFile = sourceFiles.get(owner.entry);
    if (!sourceFile) {
      violations.push({ ruleId: 'ARCH_OWNER_EXPORT_BYPASS', path: relativePath(config.root, owner.entry), line: 1, column: 1, owner: owner.id,
        message: `Owner ${owner.id} public entry is outside the configured TypeScript programs, so its boundary cannot be checked.` });
      continue;
    }
    for (const statement of sourceFile.statements) if (context.ts.isExportDeclaration(statement) && !statement.exportClause) {
      violations.push({
        ruleId: 'ARCH_OWNER_EXPORT_STAR',
        path: relativePath(config.root, owner.entry),
        ...sourceLocation(sourceFile, statement),
        owner: owner.id,
        message: `Owner ${owner.id} public entry must use explicit named exports rather than export *.`
      });
    }
  }
  for (const sourceFile of context.files) {
    const from = canonical(sourceFile.fileName);
    for (const edge of context.edges.get(from) ?? []) {
      const bypass = privateOwnerChain(context, owners, actionEntries, edge);
      if (!bypass) continue;
      if (arrangesSchema(config, from, bypass.chain.at(-1))) continue;
      violations.push({
        ruleId: 'ARCH_OWNER_EXPORT_BYPASS',
        path: relativePath(config.root, from),
        line: edge.line,
        column: edge.column,
        owner: bypass.owner.id,
        specifier: edge.specifier,
        resolvedPath: relativePath(config.root, bypass.chain.at(-1)),
        dependencyChain: bypass.chain.map(file => relativePath(config.root, file)),
        message: `Cross-owner dependency must enter ${bypass.owner.id} through ${relativePath(config.root, bypass.owner.entry)}.`
      });
    }
  }
  return violations;
}
