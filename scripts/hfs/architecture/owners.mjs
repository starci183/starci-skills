import path from 'node:path';
import { canonical, isInside } from './config.mjs';
import { relativePath, workspaceExportSources } from './typescript.mjs';
import { sourceLocation } from '../../lib/ts-ast.mjs';
import { isServerActionModule } from './server-action.mjs';

function absolute(root, relative) {
  return canonical(path.resolve(root, ...relative.split('/')));
}

/** The extra public entries the slot manifest declares for the owner (slot field `entries`, on the slot that holds its entry file), as absolute paths. */
function slotEntries(config, owner) {
  const found = config.hfs?.classifyPath?.(owner.entry);
  const names = found?.slot ? config.hfs.slot(found.slot)?.entries ?? [] : [];
  return names.map(name => absolute(config.root, `${found.root}/${name}`));
}

/** The owner's public entries: its declared entry, the `entries` its slot declares, plus every source file its package.json `exports` maps when the owner is a workspace package. */
function ownerDeclarations(config, context) {
  return config.owners.map(owner => {
    const root = absolute(config.root, owner.root);
    const entry = absolute(config.root, owner.entry);
    const workspace = context.workspaces?.find(item => item.root === root);
    const declared = slotEntries(config, owner);
    const entries = new Set([entry, ...declared, ...(workspace ? workspaceExportSources(context.ts, workspace) : [])]);
    return { ...owner, root, entry, entries, declared };
  }).sort((a, b) => b.root.length - a.root.length);
}

function ownerOf(owners, file) {
  return owners.find(owner => isInside(owner.root, file)) ?? null;
}

function reexportSteps(context, current) {
  return (context.edges.get(current.file) ?? []).filter(candidate => candidate.reexport).map(candidate => ({ file: candidate.to, chain: [...current.chain, candidate.to] }));
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
    queue.push(...reexportSteps(context, current));
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

function publicEntryViolations(config, context, owners, sourceFiles, actionEntries) {
  const violations = [];
  for (const owner of owners) {
    const sourceFile = sourceFiles.get(owner.entry);
    if (!sourceFile) {
      violations.push({ ruleId: 'ARCH_OWNER_EXPORT_BYPASS', path: relativePath(config.root, owner.entry), line: 1, column: 1, owner: owner.id,
        message: `Owner ${owner.id} public entry is outside the configured TypeScript programs, so its boundary cannot be checked.` });
      continue;
    }
    const publicFiles = new Set([
      sourceFile,
      ...owner.declared.map(file => sourceFiles.get(file)).filter(Boolean),
      ...[...actionEntries].filter(file => isInside(owner.root, file)).map(file => sourceFiles.get(file)).filter(Boolean),
    ]);
    for (const entryFile of publicFiles) {
      for (const statement of entryFile.statements) if (context.ts.isExportDeclaration(statement) && !statement.exportClause) {
        violations.push({
          ruleId: 'ARCH_OWNER_EXPORT_STAR',
          path: relativePath(config.root, canonical(entryFile.fileName)),
          ...sourceLocation(entryFile, statement),
          owner: owner.id,
          message: `Owner ${owner.id} public entry must use explicit named exports rather than export *.`,
        });
      }
    }
  }
  return violations;
}

function ownerImportViolations(config, context, owners, actionEntries) {
  const violations = [];
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
        message: `Cross-owner dependency must enter ${bypass.owner.id} through ${relativePath(config.root, bypass.owner.entry)}.`,
      });
    }
  }
  return violations;
}

/** Enforce explicit same-source owner entries without constraining imports inside one owner. */
export function checkOwners(config, context) {
  if (!config.owners?.length) return [];
  const owners = ownerDeclarations(config, context);
  const sourceFiles = new Map(context.files.map(file => [canonical(file.fileName), file]));
  const actionEntries = new Set(config.kinds.includes('frontend')
    ? [...sourceFiles].filter(([, file]) => isServerActionModule(context.ts, file)).map(([name]) => name)
    : []);
  return [
    ...publicEntryViolations(config, context, owners, sourceFiles, actionEntries),
    ...ownerImportViolations(config, context, owners, actionEntries),
  ];
}
