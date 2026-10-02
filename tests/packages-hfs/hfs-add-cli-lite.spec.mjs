import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import {
  ensureLiteCli,
  selectLiteCliEntries,
} from "../../packages/hfs/scaffold/add-cli-lite.mjs";
import {
  loadSlotManifest,
  readRepoDeclaration,
} from "../../packages/hfs/runtime/scripts/hfs/slots.mjs";

const made = [];
const ts = createRequire(import.meta.url)("typescript");
const manifest = loadSlotManifest();

test.after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

const declaration = () => ({
  hfs: 2,
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

test("selectLiteCliEntries removes colocated specs without changing the input", () => {
  const entries = [
    { path: "group/group.module.ts" },
    { path: "group/subs/run.cli.ts" },
    { path: "group/subs/run.cli.spec.ts" },
  ];
  assert.deepEqual(selectLiteCliEntries(entries), entries.slice(0, 2));
  assert.equal(entries.length, 3);
});

test("ensureLiteCli bootstraps the canonical app and groups once, registers configs and scripts, and does not overwrite owned files", () => {
  const root = appRoot();
  const created = ensureLiteCli({ root, manifest, repo: repoAt(root) });

  for (const relative of [
    "be/apps/cli/src/main.ts",
    "be/apps/cli/src/app.module.ts",
    "be/apps/cli/src/cli.options.ts",
    "be/apps/cli/Dockerfile",
    "be/src/features/cli/migrate/subs/run.cli.ts",
    "be/src/features/cli/seed/subs/run.cli.ts",
  ]) {
    assert.ok(created.includes(relative), relative);
  }
  assert.equal(created.some((relative) => relative.endsWith(".spec.ts")), false);
  for (const relative of created.filter((entry) => entry.endsWith(".ts"))) {
    assert.equal(parses(read(root, relative)), true, `${relative} parses`);
  }
  assert.match(
    read(root, "be/src/features/cli/migrate/subs/run.cli.ts"),
    /await this\.migrations\.run\(\)/,
  );
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
