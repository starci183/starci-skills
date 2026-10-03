import fs from "node:fs";
import path from "node:path";
import { resolveRepoDeclaration } from "../runtime/scripts/hfs/slots.mjs";
import { parseYaml } from "../runtime/engine/yaml.mjs";
import { appScripts, imageFiles, TEMPLATES_DIR } from "../sync/index.mjs";
import { ScaffoldError } from "./service.mjs";
import { jsonText, packageJsonText } from "./app.mjs";
import { registerLiteExports } from "./lite-exports.mjs";

const read = (relative) =>
  fs
    .readFileSync(path.join(TEMPLATES_DIR, ...relative.split("/")), "utf8")
    .replace(/\r\n/g, "\n");
const PINS_FILE = path.join(import.meta.dirname, "..", "runtime", "knowledge", "hfs", "canon-pins.yaml");

/** Lite has no test world, so the existing cli tree is selected without its colocated full-edition specs. */
export const selectLiteCliEntries = (entries) =>
  entries.filter((entry) => !entry.path.endsWith(".spec.ts"));

const managedScripts = (repo) => {
  const fragment = appScripts(repo).replace(/,\s*$/, "");
  return fragment === "" ? {} : JSON.parse(`{${fragment}}`);
};

const CLI_OPTIONS = `import type { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionOptions } from "@modules/platform/database"

/** Everything the lite cli needs: the least-privilege Supabase PostgreSQL connection. */
export interface CliAppOptions {
    /** The connections the built-in migrate and seed groups operate on. */
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
}

/** Reads the one declared connection without adding entities or TypeORM migrations. */
export const parseCliAppOptions = (env: EnvSource): CliAppOptions => ({
    connections: [parsePrimaryDatabaseConfig(env)],
})
`;

const MIGRATE_RUN = `import { CommandRunner, SubCommand } from "nest-commander"
import { MigrationRunnerService } from "@modules/platform/database"

@SubCommand({ name: "run", description: "Push the pending Supabase migrations" })
/** \`cli migrate run\`: delegates schema authority to the managed Supabase db:push script. */
export class RunCli extends CommandRunner {
    constructor(private readonly migrations: MigrationRunnerService) {
        super()
    }

    /** Runs the one managed migration wrapper and propagates its failure. */
    async run(): Promise<void> {
        await this.migrations.run()
    }
}
`;

const SEED_RUN = `import { CommandRunner, SubCommand } from "nest-commander"
import { SeedRunnerService } from "@modules/platform/database"

@SubCommand({ name: "run", description: "Run the tracked Supabase seed through the application role" })
/** \`cli seed run\`: executes the one tracked seed through the shared least-privilege EntityManager. */
export class RunSeedsCli extends CommandRunner {
    constructor(private readonly seeds: SeedRunnerService) {
        super()
    }

    /** Executes the tracked seed when it contains at least one statement. */
    async run(): Promise<void> {
        await this.seeds.run()
    }
}
`;

const SEED_MODULE = `import { Module } from "@nestjs/common"
import { SeedCli } from "./seed.cli"
import { RunSeedsCli } from "./subs/run.cli"

@Module({ providers: [SeedCli, RunSeedsCli] })
/** The lite seed group: the command and its one tracked Supabase seed runner. */
export class SeedModule {}
`;

function enableLiteCliDatabase(root) {
  const relative = "be/src/modules/platform/database/database.module.ts";
  const file = path.join(root, ...relative.split("/"));
  if (!fs.existsSync(file)) {
    throw new ScaffoldError("HFS_ADD_CLI_DATABASE", `add cli needs the scaffolded ${relative}`);
  }
  let text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  if (!text.includes('import { MigrationRunnerService } from "./migration-runner.service"')) {
    const anchor = 'import { ConfigurableModuleClass, OPTIONS_TYPE } from "./database.module-definition"';
    if (!text.includes(anchor)) throw new ScaffoldError("HFS_ADD_CLI_DATABASE", `${relative} has an unknown import shape`);
    text = text.replace(anchor, `${anchor}\nimport { MigrationRunnerService } from "./migration-runner.service"`);
  }
  if (!text.includes('import { SeedRunnerService } from "./seed-runner.service"')) {
    const anchor = 'import { PRIMARY_ENTITY_MANAGER } from "./primary.decorators"';
    if (!text.includes(anchor)) throw new ScaffoldError("HFS_ADD_CLI_DATABASE", `${relative} has an unknown import shape`);
    text = text.replace(anchor, `${anchor}\nimport { SeedRunnerService } from "./seed-runner.service"`);
  }
  const providers = "providers: [...(base.providers ?? []), ...managers]";
  if (text.includes(providers)) {
    text = text.replace(providers, "providers: [...(base.providers ?? []), ...managers, MigrationRunnerService, SeedRunnerService]");
  }
  const bareExports = "exports: [DATABASE_OPTIONS, ...managers.map((manager) => manager.provide)],";
  if (text.includes(bareExports)) {
    text = text.replace(
      bareExports,
      [
        "exports: [",
        "                DATABASE_OPTIONS,",
        "                ...managers.map((manager) => manager.provide),",
        "                MigrationRunnerService,",
        "                SeedRunnerService,",
        "            ],",
      ].join("\n"),
    );
  } else if (!text.includes("                MigrationRunnerService,")) {
    const anchor = "                ...managers.map((manager) => manager.provide),";
    if (!text.includes(anchor)) throw new ScaffoldError("HFS_ADD_CLI_DATABASE", `${relative} has an unknown exports shape`);
    text = text.replace(anchor, `${anchor}\n                MigrationRunnerService,\n                SeedRunnerService,`);
  }
  fs.writeFileSync(file, text);
  registerLiteExports({ root, generator: "cli" });
}

/**
 * Creates the optional lite cli app and its Supabase migrate/seed groups on first `add cli`.
 * Existing cli trees are never repaired or overwritten: drift remains a check finding.
 */
export function ensureLiteCli({ root, manifest, repo }) {
  if (repo.edition !== "lite") return [];
  const declarationFile = path.join(root, "hfs.json");
  const declaration = JSON.parse(fs.readFileSync(declarationFile, "utf8"));
  const cliApps = declaration.sides.be.apps.filter((app) => app.kind === "cli");
  if (cliApps.length > 1 || cliApps.some((app) => app.name !== "cli")) {
    throw new ScaffoldError(
      "HFS_ADD_CLI_DRIFT",
      `hfs.json declares the cli app${cliApps.length === 1 ? "" : "s"} named ${cliApps.map((app) => app.name).join(", ")}; lite has one cli app named cli`,
    );
  }
  const declared = cliApps.length === 1;
  const cliRoot = path.join(root, "be", "apps", "cli");
  if (declared) {
    if (!fs.existsSync(cliRoot))
      throw new ScaffoldError(
        "HFS_ADD_CLI_DRIFT",
        "hfs.json declares the cli app but be/apps/cli is missing; restore the declared tree before adding a group",
      );
    return [];
  }
  if (
    fs.existsSync(cliRoot) ||
    fs.existsSync(path.join(root, "be", "src", "features", "cli"))
  ) {
    throw new ScaffoldError(
      "HFS_ADD_EXISTS",
      "a cli tree exists but hfs.json does not declare it; hfs add never adopts an unowned tree",
    );
  }

  const files = [
    ["be/apps/cli/src/main.ts", read("be/skeleton/apps/cli/src/main.ts")],
    [
      "be/apps/cli/src/app.module.ts",
      read("be/skeleton/apps/cli/src/app.module.ts"),
    ],
    ["be/apps/cli/src/cli.options.ts", CLI_OPTIONS],
    [
      "be/src/features/cli/index.ts",
      read("be/skeleton/src/features/cli/index.ts"),
    ],
    [
      "be/src/features/cli/cli.module.ts",
      read("be/skeleton/src/features/cli/cli.module.ts"),
    ],
    [
      "be/src/features/cli/migrate/migrate.cli.ts",
      read("be/skeleton/src/features/cli/migrate/migrate.cli.ts"),
    ],
    [
      "be/src/features/cli/migrate/migrate.module.ts",
      read("be/skeleton/src/features/cli/migrate/migrate.module.ts"),
    ],
    [
      "be/src/modules/platform/database/migration-runner.service.ts",
      read("be/skeleton-lite/src/modules/platform/database/migration-runner.service.ts"),
    ],
    ["be/src/features/cli/migrate/subs/run.cli.ts", MIGRATE_RUN],
    [
      "be/src/features/cli/seed/seed.cli.ts",
      read("be/skeleton/src/features/cli/seed/seed.cli.ts"),
    ],
    [
      "be/src/features/cli/seed/seed.module.ts",
      SEED_MODULE,
    ],
    [
      "be/src/modules/platform/database/seed-runner.service.ts",
      read("be/skeleton-lite/src/modules/platform/database/seed-runner.service.ts"),
    ],
    ["be/src/features/cli/seed/subs/run.cli.ts", SEED_RUN],
  ];
  declaration.sides.be.apps.push({ name: "cli", kind: "cli" });
  declaration.sides.be.kinds = [
    ...new Set([...(declaration.sides.be.kinds ?? []), "cli"]),
  ].sort();
  const resolved = resolveRepoDeclaration(manifest, declaration);
  const image = imageFiles(resolved).find(
    (file) => file.path === "be/apps/cli/Dockerfile",
  );
  if (!image)
    throw new ScaffoldError(
      "HFS_ADD_TEMPLATE_MISSING",
      "the cli Dockerfile template did not render",
    );
  files.push([image.path, image.content]);

  const nestFile = path.join(root, "be", "nest-cli.json");
  const packageFile = path.join(root, "package.json");
  if (!fs.existsSync(nestFile))
    throw new ScaffoldError(
      "HFS_ADD_CLI_NEST_CONFIG",
      "add cli needs be/nest-cli.json",
    );
  const nest = JSON.parse(fs.readFileSync(nestFile, "utf8"));
  nest.projects = {
    ...(nest.projects ?? {}),
    cli: {
      type: "application",
      root: "apps/cli",
      entryFile: "main",
      sourceRoot: "apps/cli/src",
    },
  };
  if (!fs.existsSync(packageFile))
    throw new ScaffoldError("HFS_ADD_NOT_AN_APP", "add cli needs the app root package.json");
  const packageManifest = JSON.parse(fs.readFileSync(packageFile, "utf8"));
  const pin = parseYaml(fs.readFileSync(PINS_FILE, "utf8")).pins?.["nest-commander"]?.version;
  if (typeof pin !== "string" || pin === "")
    throw new ScaffoldError("HFS_ADD_CANON_PIN_MISSING", "add cli needs the nest-commander canon pin");
  packageManifest.dependencies = { ...(packageManifest.dependencies ?? {}), "nest-commander": pin };
  packageManifest.scripts = {
    ...(packageManifest.scripts ?? {}),
    ...managedScripts(resolved),
  };
  for (const [relative, body] of files) {
    const target = path.join(root, ...relative.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  }
  enableLiteCliDatabase(root);
  fs.writeFileSync(nestFile, jsonText(nest));
  fs.writeFileSync(declarationFile, jsonText(declaration));
  fs.writeFileSync(packageFile, packageJsonText(packageManifest));
  return files.map(([relative]) => relative);
}
