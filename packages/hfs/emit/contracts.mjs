/**
 * `hfs emit-contracts`: writes `contracts/<app>/schema.graphql` for every api app of hfs.json that serves GraphQL.
 *
 * The snapshot is `printSchema(lexicographicSortSchema(schema))`, nothing else, so it is deterministic and never carries a
 * generator banner. It needs no environment, no database and no network, and never boots the app.
 *
 * What an app serves is decided from its source (`static-graph.mjs`): the module graph is walked from `AppModule` of
 * `apps/<app>/src/app.module.ts` through every import (imports of imports, `register`/`forRoot`/`forRootAsync` dynamic modules,
 * `forwardRef`, spreads and both branches of a conditional), and the resolver providers of the modules the GraphQL server reads
 * (all of them, or the `include` whitelist and its imports) are the resolvers of the contract. The schema itself comes from
 * Nest's own `GraphQLSchemaFactory` (the builder the running server uses) over those classes, compiled the way `tsc` compiles
 * them. An app whose graph holds no GraphQL server is skipped; an app whose graph cannot be decided is an error.
 *
 * TypeScript, Nest and graphql are the repository's own packages; nothing is added to the managed devDependencies. Every app
 * runs in its own child process (`schema-worker.mjs`) because Nest GraphQL's type metadata is process-global.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The stderr prefix of a dependency the worker could not load and stood in for. */
export const STAND_IN = 'stand-in ';
const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema-worker.mjs');

/** The repository-relative path of an app's root module. */
export const appModulePath = (app) => `apps/${app}/src/app.module.ts`;

/** The repository-relative path of an app's snapshot. */
export const snapshotPath = (app) => `contracts/${app}/schema.graphql`;

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

/** Runs the worker of one app; answers `{ printed, standIns }`, or null when the app composes no GraphQL server. */
function emitApp(repoRoot, app) {
  const result = spawnSync(process.execPath, [WORKER, repoRoot, app], { encoding: 'utf8', cwd: repoRoot, env: { PATH: process.env.PATH ?? '' }, maxBuffer: 256 * 1024 * 1024 });
  if (result.status === 3) return null;
  const lines = (result.stderr ?? '').split(/\r?\n/).filter(Boolean);
  if (result.status !== 0) throw new Error(`hfs emit-contracts: ${app} failed (exit ${result.status}): ${(lines.join('\n') || result.stdout).trim()}`);
  return { printed: result.stdout, standIns: lines.filter((line) => line.startsWith(STAND_IN)) };
}

/**
 * Writes the snapshot of every api app that serves GraphQL; answers `{ written: [paths], skipped: [apps], standIns: { app: [lines] } }`.
 * `declaration` is the parsed hfs.json. `outDir` (absolute) redirects the snapshots to another root, keeping their relative paths.
 */
export function emitContracts({ repoRoot, declaration, outDir = repoRoot }) {
  const written = [];
  const skipped = [];
  const standIns = {};
  for (const app of apiApps(declaration)) {
    const emitted = emitApp(repoRoot, app);
    if (emitted === null) {
      skipped.push(app);
      continue;
    }
    const target = path.join(outDir, snapshotPath(app));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, snapshotText(emitted.printed));
    written.push(snapshotPath(app));
    if (emitted.standIns.length) standIns[app] = emitted.standIns;
  }
  return { written, skipped, standIns };
}
