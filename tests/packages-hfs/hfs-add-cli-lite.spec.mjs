import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { ensureLiteCli } from "../../packages/hfs/scaffold/add-cli-lite.mjs";
import { render } from "../../packages/hfs/sync/index.mjs";
import {
  loadSlotManifest,
  readRepoDeclaration,
} from "../../packages/hfs/runtime/scripts/hfs/slots.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const made = [];
const ts = createRequire(import.meta.url)("typescript");
const manifest = loadSlotManifest();

test.after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

const declaration = () => ({
  hfs: 3,
  kind: "app",
  edition: "lite",
  project: "demo",
  sides: {
    be: {
      apps: [{ name: "api", kind: "api" }],
      kinds: ["api"],
      connections: [
        {
          name: "primary",
          envPrefix: "PRIMARY_DB",
          owner: "api",
          isolation: "schema",
          provider: "supabase",
        },
      ],
    },
    fe: {
      apps: [{ name: "web", kind: "next" }],
      reads: ["be/contracts/", "supabase/types/"],
    },
  },
});

function appRoot(mutator = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hfs-add-cli-lite-"));
  made.push(root);
  const hfs = declaration();
  mutator(hfs);
  fs.writeFileSync(path.join(root, "hfs.json"), `${JSON.stringify(hfs, null, 2)}\n`);
  fs.writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "demo", private: true, scripts: { format: "prettier --write ." }, dependencies: {} }, null, 2)}\n`,
  );
  fs.mkdirSync(path.join(root, "be"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "be", "nest-cli.json"),
    `${JSON.stringify(
      {
        collection: "@nestjs/schematics",
        monorepo: true,
        root: "apps/api",
        sourceRoot: "apps/api/src",
        projects: {
          api: {
            type: "application",
            root: "apps/api",
            entryFile: "main",
            sourceRoot: "apps/api/src",
          },
        },
      },
      null,
      2,
    )}\n`,
  );
  for (const relative of [
    "src/modules/platform/database/database.module.ts",
    "src/modules/platform/database/index.ts",
  ]) {
    const target = path.join(root, "be", ...relative.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(ROOT, "packages", "hfs", "templates", "be", "skeleton-lite", ...relative.split("/")), target);
  }
  return root;
}

const read = (root, relative) =>
  fs.readFileSync(path.join(root, ...relative.split("/")), "utf8");
const repoAt = (root) => readRepoDeclaration(manifest, root);
const parses = (text) =>
  ts.transpileModule(text, {
    reportDiagnostics: true,
    compilerOptions: { experimentalDecorators: true },
  }).diagnostics.length === 0;

test("ensureLiteCli writes the unit spec of every built-in command, each parseable and naming its command (owner ruling 2026-10-12)", () => {
  const root = appRoot();
  const created = ensureLiteCli({ root, manifest, repo: repoAt(root) });
  const specs = created.filter((relative) => relative.endsWith(".cli.spec.ts")).sort();
  assert.deepEqual(specs, [
    "be/src/features/cli/migrate/migrate.cli.spec.ts",
    "be/src/features/cli/migrate/subs/run.cli.spec.ts",
    "be/src/features/cli/seed/seed.cli.spec.ts",
    "be/src/features/cli/seed/subs/run.cli.spec.ts",
  ]);
  for (const spec of specs) {
    assert.equal(parses(read(root, spec)), true, `${spec} parses`);
    assert.match(read(root, spec), /from "\.\/(?:migrate|seed|run)\.cli"/, `${spec} imports the command beside it`);
  }
  assert.match(read(root, "be/src/features/cli/seed/subs/run.cli.spec.ts"), /RunSeedsCli[\s\S]*seeds\.run\)\.toHaveBeenCalledTimes\(1\)/);
});

test("ensureLiteCli bootstraps the canonical app and groups once, registers configs and scripts, and does not overwrite owned files", () => {
  const root = appRoot();
  const created = ensureLiteCli({ root, manifest, repo: repoAt(root) });

  for (const relative of [
    "be/apps/cli/src/main.ts",
    "be/apps/cli/src/app.module.ts",
    "be/apps/cli/src/cli.env.ts",
    "be/apps/cli/src/cli.options.ts",
    "be/apps/cli/Dockerfile",
    "be/src/features/cli/migrate/subs/run.cli.ts",
    "be/src/features/cli/seed/subs/run.cli.ts",
    "be/src/modules/platform/database/migration-runner.service.ts",
    "be/src/modules/platform/database/seed-runner.service.ts",
  ]) {
    assert.ok(created.includes(relative), relative);
  }
  // Owner ruling 2026-10-12: each built-in cli command carries its unit spec, as in full.
  for (const command of created.filter((relative) => relative.endsWith(".cli.ts")))
    assert.ok(created.includes(command.replace(/\.ts$/, ".spec.ts")), `${command} has its unit spec`);
  for (const relative of created.filter((entry) => entry.endsWith(".ts"))) {
    assert.equal(parses(read(root, relative)), true, `${relative} parses`);
  }
  assert.match(
    read(root, "be/src/features/cli/migrate/subs/run.cli.ts"),
    /await this\.migrations\.run\(\)/,
  );
  assert.match(read(root, "be/src/modules/platform/database/index.ts"), /MigrationRunnerService/);
  assert.match(read(root, "be/src/modules/platform/database/index.ts"), /SeedRunnerService/);
  assert.match(read(root, "be/src/modules/platform/database/database.module.ts"), /MigrationRunnerService/);
  assert.match(read(root, "be/src/modules/platform/database/database.module.ts"), /SeedRunnerService/);
  assert.match(
    read(root, "be/src/features/cli/seed/subs/run.cli.ts"),
    /await this\.seeds\.run\(\)/,
  );

  const hfs = JSON.parse(read(root, "hfs.json"));
  assert.deepEqual(hfs.sides.be.apps.at(-1), { name: "cli", kind: "cli" });
  assert.deepEqual(hfs.sides.be.kinds, ["api", "cli"]);
  assert.deepEqual(JSON.parse(read(root, "be/nest-cli.json")).projects.cli, {
    type: "application",
    root: "apps/cli",
    entryFile: "main",
    sourceRoot: "apps/cli/src",
  });
  const pkg = JSON.parse(read(root, "package.json"));
  assert.equal(pkg.dependencies["nest-commander"], "3.21.0");
  assert.equal(pkg.scripts.format, "prettier --write .");
  assert.equal(pkg.scripts.cli, "node be/dist/apps/cli/src/main.js");
  assert.equal(
    pkg.scripts.migrate,
    "node be/dist/apps/cli/src/main.js migrate run",
  );
  assert.equal(
    pkg.scripts["docker:build:cli"],
    "docker build -f be/apps/cli/Dockerfile -t demo/cli:dev .",
  );

  const main = path.join(root, "be", "apps", "cli", "src", "main.ts");
  fs.writeFileSync(main, "// app-owned sentinel\n");
  assert.deepEqual(
    ensureLiteCli({ root, manifest, repo: repoAt(root) }),
    [],
  );
  assert.equal(fs.readFileSync(main, "utf8"), "// app-owned sentinel\n");
});

test("ensureLiteCli separates fail-fast environment parsing from its connection options", () => {
  const root = appRoot();
  ensureLiteCli({ root, manifest, repo: repoAt(root) });

  const main = read(root, "be/apps/cli/src/main.ts");
  const env = read(root, "be/apps/cli/src/cli.env.ts");
  const options = read(root, "be/apps/cli/src/cli.options.ts");
  assert.match(main, /from "\.\/cli\.env"/);
  assert.match(main, /createCliAppOptions\(readCliEnv\(EnvSource\.fromProcess\(\)\)\)/);
  assert.equal((main.match(/EnvSource\.fromProcess\(\)/g) ?? []).length, 1);
  assert.match(env, /export interface CliEnv \{/);
  assert.match(env, /readonly name: string/);
  assert.match(env, /readonly url: Secret/);
  assert.match(env, /readonly provider: "supabase"/);
  assert.match(env, /readonly schema\?: string/);
  assert.doesNotMatch(env, /CliEnv extends/);
  assert.match(env, /export const readCliEnv = \(env: EnvSource\): CliEnv => parsePrimaryDatabaseConfig\(env\)/);
  assert.ok(main.trimEnd().split("\n").length <= 80, "the CLI bootstrap stays within its 80-line budget");
  assert.ok(env.trimEnd().split("\n").length <= 150, "the CLI env reader stays within its 150-line budget");
  assert.doesNotMatch(env, /parseCliEnv|localhost|127\.0\.0\.1|process\.env/);
  assert.doesNotMatch(env, /import type \{ DatabaseConnectionConfig/);
  assert.doesNotMatch(env, /@features\/|@modules\/domain\/|\b(?:register|forRoot)\s*\(|\b[A-Za-z]*Module\b/);
  assert.match(options, /createCliAppOptions = \(primary: DatabaseConnectionOptions\): CliAppOptions/);
  assert.match(options, /connections: \[primary\]/);
  assert.doesNotMatch(options, /EnvSource|parsePrimaryDatabaseConfig|noteEntities|noteMigrations/);
});

test("the full cli template binds domain entities and migrations after environment parsing", () => {
  const cli = "packages/hfs/templates/be/skeleton/apps/cli/src";
  const env = read(ROOT, `${cli}/cli.env.ts`);
  const options = read(ROOT, `${cli}/cli.options.ts`);
  assert.equal(parses(env), true);
  assert.equal(parses(options), true);
  assert.match(env, /export interface CliEnv \{/);
  assert.match(env, /readonly name: string/);
  assert.match(env, /readonly url: Secret/);
  assert.doesNotMatch(env, /CliEnv extends/);
  assert.match(env, /export const readCliEnv = \(env: EnvSource\): CliEnv/);
  assert.match(env, /parsePrimaryDatabaseConfig\(env\)/);
  assert.doesNotMatch(env, /noteEntities|noteMigrations/);
  assert.match(options, /primaryConnectionOf = \(primary: DatabaseConnectionConfig\): DatabaseConnectionOptions/);
  assert.match(options, /\.\.\.primary,[\s\S]*entities: noteEntities,[\s\S]*migrations: noteMigrations/);
  assert.match(options, /connections: \[primaryConnectionOf\(primary\)\]/);
  assert.doesNotMatch(options, /EnvSource|parsePrimaryDatabaseConfig/);
});

test("the full HTTP template gives a named app a typed, bounded environment reader", () => {
  const app = "packages/hfs/templates/be/skeleton/apps/__app__/src";
  const variables = { app: "catalog-api", appPascal: "CatalogApi" };
  const env = render(read(ROOT, `${app}/__app__.env.ts`).replace(/\r\n/g, "\n"), variables);
  const main = render(read(ROOT, `${app}/main.ts`).replace(/\r\n/g, "\n"), variables);

  assert.equal(parses(env), true);
  assert.equal(parses(main), true);
  assert.match(env, /export interface CatalogApiEnv \{/);
  for (const [field, parser] of [["server", "parseServerConfig"], ["httpSecurity", "parseHttpSecurityConfig"], ["database", "parsePrimaryDatabaseConfig"]])
    assert.ok(env.includes(`readonly ${field}: ReturnType<typeof ${parser}>`));
  assert.doesNotMatch(env, /CatalogApiEnv extends|from "\.\/catalog-api\.options"/);
  assert.match(env, /export const readCatalogApiEnv = \(env: EnvSource\): CatalogApiEnv/);
  assert.match(main, /import \{ readCatalogApiEnv \} from "\.\/catalog-api\.env"/);
  assert.match(main, /readCatalogApiEnv\(env\)/);
  assert.equal((main.match(/EnvSource\.fromProcess\(\)/g) ?? []).length, 1);
  assert.ok(main.trimEnd().split("\n").length <= 80, "the HTTP bootstrap stays within its 80-line budget");
  assert.ok(env.trimEnd().split("\n").length <= 150, "the HTTP env reader stays within its 150-line budget");
  assert.doesNotMatch(main, /parse(?:Server|HttpSecurity|PrimaryDatabase)Config/);
  assert.doesNotMatch(env, /localhost|127\.0\.0\.1|process\.env|@features\/|@modules\/domain\/|\b[A-Za-z]*Module\b/);
});

test("ensureLiteCli refuses undeclared or foreign cli trees instead of adopting them", () => {
  const undeclared = appRoot();
  const main = path.join(undeclared, "be", "apps", "cli", "src", "main.ts");
  fs.mkdirSync(path.dirname(main), { recursive: true });
  fs.writeFileSync(main, "// foreign tree\n");
  assert.throws(
    () => ensureLiteCli({ root: undeclared, manifest, repo: repoAt(undeclared) }),
    (error) => error?.code === "HFS_ADD_EXISTS",
  );
  assert.equal(fs.readFileSync(main, "utf8"), "// foreign tree\n");

  const foreign = appRoot((hfs) => {
    hfs.sides.be.apps.push({ name: "ops", kind: "cli" });
    hfs.sides.be.kinds.push("cli");
  });
  assert.throws(
    () => ensureLiteCli({ root: foreign, manifest, repo: repoAt(foreign) }),
    (error) =>
      error?.code === "HFS_ADD_CLI_DRIFT" && /named ops/.test(error.message),
  );
  assert.equal(fs.existsSync(path.join(foreign, "be", "apps", "cli")), false);
});
