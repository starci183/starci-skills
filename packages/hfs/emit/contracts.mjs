/**
 * `hfs emit-contracts`: writes `contracts/<app>/schema.graphql` for every api app of hfs.json that serves GraphQL.
 *
 * The snapshot is `printSchema(lexicographicSortSchema(schema))`, nothing else, so it is deterministic and never carries a
 * generator banner. It needs no environment, no database and no network: the schema is built from the RESOLVER CLASSES the
 * app composes, never by booting the app (`AppModule.register(options)` needs the options of a deployment).
 *
 * Which resolvers an app composes (the exact variant, chosen over "every resolver file of every feature"): the app root
 * imports the feature transport modules by name (`import { CheckoutGraphqlModule } from "@features/checkout"`). This command
 * reads those import declarations of `apps/<app>/src/app.module.ts`, loads each imported class and keeps the ones that are
 * Nest modules; the resolvers are the providers of those modules that carry Nest GraphQL's resolver metadata. A resolver a
 * module does not provide is not served by the app and therefore not in its contract. The schema itself comes from Nest's
 * own `GraphQLSchemaFactory` (the builder the running server uses), so the printed text is what the server answers.
 *
 * TypeScript is loaded by the `typescript` package the repository already pins (`transpileModule` behind a `.ts` require
 * hook and the `paths` aliases of its tsconfig.json); nothing is added to the managed devDependencies. Every app runs in its
 * own child process (`schema-worker.mjs`) because Nest GraphQL's type metadata is process-global.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema-worker.mjs');

/** The repository-relative path of an app's root module. */
export const appModulePath = (app) => `apps/${app}/src/app.module.ts`;

/** The repository-relative path of an app's snapshot. */
export const snapshotPath = (app) => `contracts/${app}/schema.graphql`;

/**
 * The named bindings an app root imports: [{ name, specifier }] in source order. `import type` declarations and type-only
 * specifiers are skipped (they load nothing). Pure: takes the TypeScript module and the source text.
 */
export function importedBindings(ts, sourceText) {
  const sourceFile = ts.createSourceFile('app.module.ts', sourceText, ts.ScriptTarget.Latest, true);
  const bindings = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;
    for (const element of clause.namedBindings.elements) {
      if (!element.isTypeOnly) bindings.push({ name: (element.propertyName ?? element.name).text, specifier: statement.moduleSpecifier.text });
    }
  }
  return bindings;
}

/** The `paths` aliases of a tsconfig as [{ prefix, targets }], `@modules/*` giving prefix `@modules/`. Pure. */
export function aliasesOf(paths, baseDir) {
  return Object.entries(paths ?? {})
    .filter(([pattern]) => pattern.endsWith('/*'))
    .map(([pattern, targets]) => ({ prefix: pattern.slice(0, -1), targets: targets.map((target) => path.resolve(baseDir, target.replace(/\*$/, ''))) }));
}

/** The absolute base a specifier resolves to through the aliases, or null when it is not aliased. Pure. */
export function aliasTarget(aliases, specifier) {
  const alias = aliases.find((item) => specifier.startsWith(item.prefix));
  return alias ? path.join(alias.targets[0], specifier.slice(alias.prefix.length)) : null;
}

/** The api apps of a declaration that can serve GraphQL: kind `api`. Pure. */
export const apiApps = (declaration) => (declaration.apps ?? []).filter((app) => app.kind === 'api').map((app) => app.name);

/** The text written to a snapshot file: the printed schema and one final newline. Pure. */
export const snapshotText = (printed) => `${printed.replace(/\n+$/, '')}\n`;

/** Runs the worker of one app and answers its printed schema, or null when the app composes no resolver. */
function emitApp(repoRoot, app) {
  const result = spawnSync(process.execPath, [WORKER, repoRoot, app], { encoding: 'utf8', cwd: repoRoot, env: { PATH: process.env.PATH ?? '' }, maxBuffer: 64 * 1024 * 1024 });
  if (result.status === 3) return null;
  if (result.status !== 0) throw new Error(`hfs emit-contracts: ${app} failed (exit ${result.status}): ${(result.stderr || result.stdout).trim()}`);
  return result.stdout;
}

/**
 * Writes the snapshot of every api app that serves GraphQL; answers `{ written: [paths], skipped: [apps] }`.
 * `declaration` is the parsed hfs.json.
 */
export function emitContracts({ repoRoot, declaration }) {
  const written = [];
  const skipped = [];
  for (const app of apiApps(declaration)) {
    const printed = emitApp(repoRoot, app);
    if (printed === null) {
      skipped.push(app);
      continue;
    }
    const target = path.join(repoRoot, snapshotPath(app));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, snapshotText(printed));
    written.push(snapshotPath(app));
  }
  return { written, skipped };
}
