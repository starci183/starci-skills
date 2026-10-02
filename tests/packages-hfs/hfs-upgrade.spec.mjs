import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { main } from "../../packages/hfs/bin/hfs.mjs";
import {
  UpgradeError,
  upgradeEdition,
} from "../../packages/hfs/upgrade/index.mjs";
import {
  imageFiles,
  renderTargets,
  writeTargets,
} from "../../packages/hfs/sync/index.mjs";
import { checkRepo, trackedFiles } from "../../scripts/hfs/check.mjs";
import {
  createSlotResolver,
  loadSlotManifest,
  resolveRepoDeclaration,
} from "../../scripts/hfs/slots.mjs";
import {
  FE_APP_SCRIPTS,
  PACKAGE_MANAGER,
  WORKSPACES,
  feAppPackageName,
} from "../../scripts/hfs/rules/monorepo.mjs";
import {
  FORMATTED,
  gitAdd,
  installTypeScript,
} from "../helpers/hfs-cli-fixture.mjs";

const MANIFEST = loadSlotManifest();
const ROOT = path.resolve(import.meta.dirname, "..", "..");
const PRESETS = {
  sonarExclusions: ["**/node_modules/**", "fe/**"],
  coverageSources: ["src/**/*.service.ts", "src/features/cli/**/*.cli.ts"],
};
const LITE = {
  hfs: MANIFEST.major,
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
};
const TYPE_TEXT =
  "export type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };\nexport interface Database { public: { Tables: Record<string, never> } }\n";

const posix = (value) => value.split(path.sep).join("/");
const put = (root, file, text = "export {};\n") => {
  const target = path.join(root, ...file.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

function fakeLock(root) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  put(
    root,
    "package-lock.json",
    json({
      name: pkg.name,
      version: pkg.version,
      lockfileVersion: 3,
      requires: true,
      packages: {
        "": {
          name: pkg.name,
          version: pkg.version,
          dependencies: pkg.dependencies,
          devDependencies: pkg.devDependencies,
        },
      },
    }),
  );
  return { ok: true };
}

function contents(root) {
  const result = {};
  const walk = (dir) => {
    for (const entry of fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const target = path.join(dir, entry.name);
      const rel = posix(path.relative(root, target));
      if (entry.isDirectory()) {
        result[`${rel}/`] = "directory";
        walk(target);
      } else
        result[rel] = createHash("sha256")
          .update(fs.readFileSync(target))
          .digest("hex");
    }
  };
  walk(root);
  return result;
}

function syntheticLite(t, name = "demo") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hfs-upgrade-lite-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const declaration = { ...structuredClone(LITE), project: name };
  const pkg = {
    name,
    version: "0.0.0",
    private: true,
    packageManager: PACKAGE_MANAGER,
    workspaces: [...WORKSPACES],
    dependencies: {
      "@nestjs/common": "11.1.6",
      "@nestjs/core": "11.1.6",
      "@supabase/supabase-js": "2.117.2",
    },
    devDependencies: {
      "@starci/hfs": "4.0.9",
      supabase: "2.119.0",
      turbo: "2.8.20",
      typescript: "5.9.3",
    },
  };
  put(root, "hfs.json", json(declaration));
  put(root, "package.json", json(pkg));
  writeTargets(
    root,
    renderTargets(declaration, PRESETS, { manifest: MANIFEST }),
  );

  const resolver = createSlotResolver(
    MANIFEST,
    resolveRepoDeclaration(MANIFEST, declaration),
  );
  for (const entry of resolver.requiredPaths().paths) {
    const file = entry.path;
    if (
      file.endsWith("/") ||
      fs.existsSync(path.join(root, ...file.split("/")))
    )
      continue;
    put(
      root,
      file,
      file.endsWith(".json")
        ? "{}\n"
        : file.endsWith(".yaml") || file.endsWith(".yml")
          ? "schema: fixture/v1\n"
          : file.endsWith(".toml")
            ? 'project_id = "demo"\n'
            : file.endsWith(".md")
              ? "# Demo\n"
              : "export {};\n",
    );
  }
  put(
    root,
    "be/nest-cli.json",
    json({
      $schema: "https://json.schemastore.org/nest-cli",
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
    }),
  );
  put(
    root,
    "fe/apps/web/package.json",
    json({
      name: feAppPackageName(name, "web"),
      version: "0.0.0",
      private: true,
      scripts: FE_APP_SCRIPTS,
      dependencies: { "next-intl": "4.3.9" },
    }),
  );
  put(
    root,
    "fe/apps/web/tsconfig.json",
    json({
      extends: "../../tsconfig.json",
      compilerOptions: { paths: { "@/*": ["./src/*"] } },
    }),
  );
  for (const image of imageFiles(resolveRepoDeclaration(MANIFEST, declaration)))
    put(root, image.path, image.content);
  put(root, "supabase/types/database.types.ts", TYPE_TEXT);
  put(
    root,
    "supabase/migrations/20261002000000_baseline.sql",
    "create table public.notes (id uuid primary key);\nalter table public.notes enable row level security;\ncreate policy notes_read on public.notes for select using (true);\n",
  );
  put(
    root,
    ".starcistacks/dev/environment.json",
    json({ environment: "dev", provider: "supabase" }),
  );
  put(root, ".starcistacks/dev/secrets/.gitkeep", "");
  put(root, ".starciwork/shell/index.yaml", "schema: work/shell@1\n");
  put(
    root,
    "be/apps/api/src/main.ts",
    'export const apiProductMarker = "preserve-api";\n',
  );
  put(
    root,
    "be/src/modules/domain/sample/index.ts",
    'export { SampleService } from "./sample.service";\n',
  );
  put(
    root,
    "be/src/modules/domain/sample/sample.service.ts",
    'export class SampleService { value(): string { return "preserve-service"; } }\n',
  );
  put(
    root,
    "fe/apps/web/src/app/[locale]/page.tsx",
    'export default function Page() { return "preserve-fe"; }\n',
  );
  fakeLock(root);
  return root;
}

const outputOf = async (argv) => {
  let out = "";
  let err = "";
  const code = await main(argv, {
    stdout: (value) => {
      out += value;
    },
    stderr: (value) => {
      err += value;
    },
    presets: PRESETS,
    prettier: FORMATTED,
  });
  return { code, out, err };
};

test("upgrade plan is ordered, printable and byte-for-byte read-only; apply executes that exact plan", async (t) => {
  const root = syntheticLite(t);
  const before = contents(root);
  const plan = await upgradeEdition({
    root,
    to: "full",
    plan: true,
    presets: PRESETS,
  });
  assert.deepEqual(
    contents(root),
    before,
    "--plan writes no file or directory",
  );
  assert.deepEqual(plan[0], {
    op: "remove-field",
    path: "hfs.json",
    why: "Full is the default edition; declare the required cli app without changing the HFS major.",
  });
  assert.equal(
    new Set(plan.map((step) => step.path)).size,
    plan.length,
    "each path has one operation",
  );
  for (const file of [
    ".github/workflows/ci.yml",
    ".husky/pre-push",
    "be/jest.config.js",
    "codecov.yml",
    "sonar-project.properties",
    ".starcistacks/application-stacks.yaml",
    ".starcistacks/dev/infra/compose/compose.yaml",
    ".starciwork/features/index.yaml",
    "be/apps/cli/src/main.ts",
    "be/src/features/cli/migrate/subs/run.cli.ts",
    "be/src/tests/world/",
    "package-lock.json",
  ])
    assert.ok(
      plan.some((step) => step.path === file),
      `${file} is planned`,
    );
  assert.equal(
    plan.at(-1).path,
    "package-lock.json",
    "the lock is resolved after every source and manifest write",
  );

  const cli = await outputOf([
    "upgrade",
    "--edition",
    "full",
    "--plan",
    "--repo",
    root,
  ]);
  assert.equal(cli.code, 0, cli.err);
  assert.equal(cli.err, "");
  assert.match(cli.out, /^remove-field hfs\.json:/m);
  assert.match(cli.out, /planned; no file written/);
  assert.deepEqual(contents(root), before, "the CLI plan is read-only too");

  const preserved = Object.fromEntries(
    [
      "supabase/types/database.types.ts",
      "supabase/migrations/20261002000000_baseline.sql",
      "be/apps/api/src/main.ts",
      "be/src/modules/domain/sample/sample.service.ts",
      "fe/apps/web/src/app/[locale]/page.tsx",
    ].map((file) => [
      file,
      fs.readFileSync(path.join(root, ...file.split("/"))),
    ]),
  );
  const applied = await upgradeEdition({
    root,
    to: "full",
    presets: PRESETS,
    lock: fakeLock,
  });
  assert.deepEqual(applied, plan);
  for (const [file, bytes] of Object.entries(preserved))
    assert.deepEqual(
      fs.readFileSync(path.join(root, ...file.split("/"))),
      bytes,
      `${file} is not rewritten`,
    );

  const declaration = JSON.parse(
    fs.readFileSync(path.join(root, "hfs.json"), "utf8"),
  );
  assert.equal("edition" in declaration, false);
  assert.deepEqual(declaration.sides.be.apps.at(-1), {
    name: "cli",
    kind: "cli",
  });
  assert.ok(declaration.sides.be.kinds.includes("cli"));
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  for (const dependency of ["nest-commander"])
    assert.equal(typeof pkg.dependencies[dependency], "string", dependency);
  for (const dependency of [
    "@nestjs/testing",
    "@starci/jest-preset",
    "@starci/test-world",
    "@types/jest",
    "jest",
    "ts-jest",
  ])
    assert.equal(typeof pkg.devDependencies[dependency], "string", dependency);
  const migrate = fs.readFileSync(
    path.join(root, "be/src/features/cli/migrate/subs/run.cli.ts"),
    "utf8",
  );
  assert.match(migrate, /"supabase\.cmd" : "supabase"/);
  assert.match(migrate, /spawnSync\(command, \["db", "push"\]/);
  for (const directory of [
    "world",
    "fixtures",
    "integration",
    "e2e",
    "contract",
  ]) {
    const files = fs.readdirSync(path.join(root, "be/src/tests", directory));
    assert.deepEqual(
      files,
      [],
      `tests/${directory} is empty: no placeholder or invented spec`,
    );
  }
});

test("the committed lite example has a read-only, additions-only full upgrade plan", async () => {
  const root = path.join(ROOT, "examples", "lite-app");
  assert.ok(fs.existsSync(path.join(root, "hfs.json")), "examples/lite-app is present");
  const before = contents(root);
  const plan = await upgradeEdition({ root, to: "full", plan: true, presets: PRESETS });
  assert.deepEqual(contents(root), before, "planning the example changes no byte");
  assert.ok(plan.length > 0, "the full edition has additions to make");
  const managed = new Set(["hfs.json", "sonar-project.properties", ".husky/pre-commit", ".husky/pre-push", ".github/workflows/ci.yml", ".github/workflows/images.yml", ".gitignore", "package.json", "package-lock.json"]);
  for (const step of plan) {
    if (step.op === "add") {
      assert.equal(before[step.path], undefined, `${step.path} is a new full-edition path`);
      continue;
    }
    assert.ok(managed.has(step.path), `${step.op} touches only a managed declaration: ${step.path}`);
  }
  const product = /^(?:supabase\/(?:migrations|types)\/|be\/src\/(?:features|modules)\/|fe\/apps\/[^/]+\/src\/)/;
  assert.deepEqual(plan.filter(step => product.test(step.path)), [], "the plan never replaces lite product source");
});

test("the full-edition override judges a lite tree without writing it, and the applied structure has no slot, forbidden or monorepo finding", async (t) => {
  const root = syntheticLite(t);
  installTypeScript(root);
  gitAdd(root);
  const before = contents(root);
  const checked = await outputOf([
    "check",
    "--edition",
    "full",
    "--repo",
    root,
    "--json",
  ]);
  assert.equal(checked.code, 1, checked.err);
  assert.equal(checked.err, "");
  const viewed = JSON.parse(checked.out);
  assert.deepEqual(viewed.editionOverride, {
    declared: "lite",
    judged: "full",
  });
  assert.ok(
    viewed.findings.some(
      (finding) =>
        finding.code === "BE_CLI_REQUIRED" ||
        finding.code === "HFS_MONO_NEST_PROJECTS",
    ),
  );
  assert.deepEqual(contents(root), before, "check --edition full is read-only");

  await upgradeEdition({ root, to: "full", presets: PRESETS, lock: fakeLock });
  fs.rmSync(path.join(root, ".git"), { recursive: true, force: true });
  gitAdd(root);
  const declaration = JSON.parse(
    fs.readFileSync(path.join(root, "hfs.json"), "utf8"),
  );
  const result = checkRepo({
    repoRoot: root,
    declaration,
    files: trackedFiles(root),
    tree: false,
  });
  const structural = result.findings.filter((finding) =>
    /^HFS_SLOT_|^HFS_FORBIDDEN(?:_|$)|^HFS_MONO_/.test(finding.code),
  );
  assert.deepEqual(structural, [], JSON.stringify(structural, null, 2));
  assert.equal(
    result.findings.some((finding) => finding.code === "BE_CLI_REQUIRED"),
    false,
  );
});

test("already-full and invalid targets refuse with exit 2, and a failed lock restores every touched byte", async (t) => {
  const root = syntheticLite(t);
  await upgradeEdition({ root, to: "full", presets: PRESETS, lock: fakeLock });
  await assert.rejects(
    upgradeEdition({ root, to: "full", plan: true, presets: PRESETS }),
    (error) =>
      error instanceof UpgradeError &&
      error.code === "HFS_UPGRADE_ALREADY_FULL",
  );
  const second = await outputOf([
    "upgrade",
    "--edition",
    "full",
    "--repo",
    root,
  ]);
  assert.equal(second.code, 2);
  assert.match(second.err, /^HFS_UPGRADE_ALREADY_FULL:/);
  const mismatch = await outputOf([
    "check",
    "--edition",
    "lite",
    "--repo",
    root,
    "--fast",
  ]);
  assert.equal(mismatch.code, 2);
  assert.match(mismatch.err, /^HFS_EDITION_INVALID:/);

  const conflicted = syntheticLite(t, "conflict-demo");
  put(
    conflicted,
    ".starcistacks/application-stacks.yaml",
    "schema: custom/stack@1\n",
  );
  const conflictBefore = contents(conflicted);
  await assert.rejects(
    upgradeEdition({
      root: conflicted,
      to: "full",
      presets: PRESETS,
      lock: fakeLock,
    }),
    (error) =>
      error instanceof UpgradeError &&
      error.code === "HFS_UPGRADE_FILE_CONFLICT" &&
      /application-stacks\.yaml/.test(error.message),
  );
  assert.deepEqual(
    contents(conflicted),
    conflictBefore,
    "an existing non-canon addition is refused before apply",
  );

  const failed = syntheticLite(t, "rollback-demo");
  const before = contents(failed);
  await assert.rejects(
    upgradeEdition({
      root: failed,
      to: "full",
      presets: PRESETS,
      lock: () => ({ ok: false, detail: "fixture registry unavailable" }),
    }),
    (error) =>
      error instanceof UpgradeError &&
      error.code === "HFS_UPGRADE_LOCK_FAILED" &&
      /restored/.test(error.message),
  );
  assert.deepEqual(
    contents(failed),
    before,
    "lock failure restores files and removes directories created by apply",
  );
  await assert.rejects(
    upgradeEdition({ root: failed, to: "lite", plan: true, presets: PRESETS }),
    /HFS_UPGRADE_TARGET_INVALID/,
  );
});
