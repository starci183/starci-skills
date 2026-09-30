import path from 'node:path';
import { canonical, isInside } from './config.mjs';
import { relativePath, sourceLocation } from './typescript.mjs';

function absolute(root, relative) {
  return canonical(path.resolve(root, ...relative.split('/')));
}

function ownerDeclarations(config) {
  return config.owners.map(owner => ({ ...owner, root: absolute(config.root, owner.root), entry: absolute(config.root, owner.entry) }))
    .sort((a, b) => b.root.length - a.root.length);
}

function ownerOf(owners, file) {
  return owners.find(owner => isInside(owner.root, file)) ?? null;
}

function privateOwnerChain(context, owners, edge) {
  const sourceOwner = ownerOf(owners, edge.from);
  const queue = [{ file: edge.to, chain: [edge.from, edge.to] }];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current.file)) continue;
    visited.add(current.file);
    const owner = ownerOf(owners, current.file);
    if (owner && sourceOwner?.id !== owner.id) return current.file === owner.entry ? null : { owner, chain: current.chain };
    for (const candidate of context.edges.get(current.file) ?? []) if (candidate.reexport) {
      queue.push({ file: candidate.to, chain: [...current.chain, candidate.to] });
    }
  }
  return null;
}

/** Enforce explicit same-source owner entries without constraining imports inside one owner. */
export function checkOwners(config, context) {
  if (!config.owners?.length) return [];
  const owners = ownerDeclarations(config);
  const violations = [];
  const sourceFiles = new Map(context.files.map(file => [canonical(file.fileName), file]));
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
      const bypass = privateOwnerChain(context, owners, edge);
      if (!bypass) continue;
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
