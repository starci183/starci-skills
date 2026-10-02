import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseYaml } from "../../engine/yaml.mjs";
import { main } from "../../packages/hfs/bin/hfs.mjs";
import { scaffoldApp } from "../../packages/hfs/scaffold/app.mjs";
import {
  checkTargets,
  renderRepo,
} from "../../packages/hfs/sync/index.mjs";
import { upgradeEdition } from "../../packages/hfs/upgrade/index.mjs";
import { checkRepository } from "../../scripts/hfs/check.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const PINS = parseYaml(
  fs.readFileSync(
    path.join(ROOT, "knowledge", "hfs", "canon-pins.yaml"),
    "utf8",
  ),
).pins;
const CREATED_AT = new Date("2026-10-02T12:34:56.000Z");
const GENERATED_TYPES =
  "export type Database = { public: { Tables: Record<string, never> } };\n";
const jestPreset = createRequire(import.meta.url)(
  "../../packages/jest-preset/index.cjs",
);
const PRESETS = { sonarExclusions: jestPreset.sonarExclusions() };
const PRODUCT_ROOTS = ["supabase", "fe", "be/src"];
const STRUCTURAL_CODE =
  /^(?:HFS_SLOT_(?:UNDECLARED|REQUIRED_MISSING)|HFS_FORBIDDEN(?:_|$)|HFS_MONO_)/u;
const TEST_GAP_CODES = new Set([
  "BE_ASYNC_SPEC_MISSING",
  "BE_INTEGRATION_SPEC_MISSING",
  "BE_PATTERN_SPEC_MISSING",
  "BE_SAGA_E2E_MISSING",
  "BE_TEST_TOPOLOGY",
]);

const posix = (value) => value.split(path.sep).join("/");

function fakeLock(root) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  fs.writeFileSync(
    path.join(root, "package-lock.json"),
    `${JSON.stringify(
      {
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
      },
      null,
      2,
    )}\n`,
  );
  return { ok: true };
}

function scaffold(t, edition) {
  const into = fs.mkdtempSync(path.join(os.tmpdir(), `hfs-upgrade-${edition}-`));
  t.after(() => fs.rmSync(into, { recursive: true, force: true }));
  return scaffoldApp({
    name: "demo",
    into,
    edition,
    pins: PINS,
    presets: PRESETS,
    lock: fakeLock,
    emitTypes: () => GENERATED_TYPES,
    now: () => CREATED_AT,
  }).root;
}

function gitAdd(root) {
  if (!fs.existsSync(path.join(root, ".git")))
    execFileSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["-c", "core.autocrlf=false", "add", "-A"], {
    cwd: root,
    stdio: "ignore",
  });
}

const gitStatus = (root) =>
  execFileSync("git", ["status", "--porcelain=v1", "-z"], {
    cwd: root,
    encoding: "utf8",
  });

function fileHashes(root, prefixes = [""]) {
  const hashes = new Map();
  const walk = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else
        hashes.set(
          posix(path.relative(root, target)),
          createHash("sha256").update(fs.readFileSync(target)).digest("hex"),
        );
    }
  };
  for (const prefix of prefixes) {
    const target = path.join(root, ...prefix.split("/"));
    if (!fs.existsSync(target)) continue;
    if (fs.statSync(target).isFile())
      hashes.set(
        posix(path.relative(root, target)),
        createHash("sha256").update(fs.readFileSync(target)).digest("hex"),
      );
    else walk(target);
  }
  return hashes;
}

async function cliOutput(argv) {
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
  });
  return { code, out, err };
}

test("a real lite scaffold plans and applies the additive full upgrade", async (t) => {
  const root = scaffold(t, "lite");
  gitAdd(root);
  const statusBeforePlan = gitStatus(root);
  const productBefore = fileHashes(root, PRODUCT_ROOTS);
  const readmeBefore = fs.readFileSync(path.join(root, "README.md"), "utf8");

  const firstPlan = await upgradeEdition({
    root,
    to: "full",
    plan: true,
    presets: PRESETS,
  });
  assert.equal(gitStatus(root), statusBeforePlan, "--plan writes nothing");
  assert.ok(firstPlan.length > 0, "the lite scaffold has full-only additions");
  assert.ok(
    firstPlan.every((step) =>
      ["add", "remove-field", "rewrite-managed", "rewrite-readme"].includes(
        step.op,
      ),
    ),
    JSON.stringify(firstPlan, null, 2),
  );
  assert.deepEqual(
    firstPlan.filter((step) => step.op === "remove-field"),
    [
      {
        op: "remove-field",
        path: "hfs.json",
        why: "Full is the default edition; declare the required cli app without changing the HFS major.",
      },
    ],
  );
  assert.deepEqual(
    firstPlan.filter((step) => step.op === "rewrite-readme"),
    [
      {
        op: "rewrite-readme",
        path: "README.md",
        why: "List the full edition's newly managed top-level scripts in Development without changing other README text.",
      },
    ],
  );

  const secondPlan = await upgradeEdition({
    root,
    to: "full",
    plan: true,
    presets: PRESETS,
  });
  assert.deepEqual(secondPlan, firstPlan, "planning twice is deterministic");
  assert.equal(
    gitStatus(root),
    statusBeforePlan,
    "repeated planning remains read-only",
  );

  const applied = await upgradeEdition({
    root,
    to: "full",
    presets: PRESETS,
    lock: fakeLock,
  });
  assert.deepEqual(applied, firstPlan, "apply executes the planned operations");
  assert.equal(
    fs.readFileSync(path.join(root, "README.md"), "utf8"),
    readmeBefore.replace("npm run build:fe\n", "npm run build:fe\nnpm test\n"),
    "upgrade adds only the newly managed full command to Development",
  );
  for (const [file, hash] of productBefore)
    assert.equal(
      fileHashes(root, [file]).get(file),
      hash,
      `${file} keeps its original bytes`,
    );

  gitAdd(root);
  const checked = checkRepository({
    repoRoot: root,
    // This no-install integration spec exercises the repository rules and tree; TypeScript-machine behavior has its own specs.
    machine: () => ({
      ok: true,
      files: 0,
      kinds: [],
      violations: [],
      errors: [],
    }),
  });
  assert.deepEqual(
    checked.findings.filter((finding) => STRUCTURAL_CODE.test(finding.code)),
    [],
    JSON.stringify(checked.findings, null, 2),
  );
  assert.equal(
    checked.findings.some((finding) => finding.code === "BE_CLI_REQUIRED"),
    false,
  );
  assert.ok(checked.findings.length > 0, "the first full check exposes test gaps");
  assert.ok(
    checked.findings.every((finding) => TEST_GAP_CODES.has(finding.code)),
    JSON.stringify(checked.findings, null, 2),
  );

  const declaration = JSON.parse(
    fs.readFileSync(path.join(root, "hfs.json"), "utf8"),
  );
  assert.equal("edition" in declaration, false);
  assert.deepEqual(
    declaration.sides.be.apps.find((app) => app.kind === "cli"),
    { name: "cli", kind: "cli" },
  );
  for (const file of [
    "be/apps/cli/src/main.ts",
    "be/src/features/cli/index.ts",
    "be/src/features/cli/migrate/migrate.cli.ts",
    "be/src/features/cli/migrate/migrate.module.ts",
    "be/src/features/cli/migrate/subs/run.cli.ts",
  ])
    assert.equal(fs.existsSync(path.join(root, ...file.split("/"))), true, file);

  const rendered = await renderRepo(root, { presets: PRESETS });
  assert.deepEqual(
    checkTargets(root, rendered.targets).filter(
      (result) => result.status !== "ok",
    ),
    [],
    "every managed file equals the full render",
  );

  const afterApply = fileHashes(root);
  const repeated = await cliOutput([
    "upgrade",
    "--edition",
    "full",
    "--repo",
    root,
  ]);
  assert.equal(repeated.code, 2);
  assert.equal(repeated.out, "");
  assert.equal(
    repeated.err,
    "HFS_UPGRADE_ALREADY_FULL: hfs.json edition is full; upgrade accepts only an edition lite app\n",
  );
  assert.deepEqual(
    fileHashes(root),
    afterApply,
    "a repeated apply refuses without changing the upgraded tree",
  );
});

test("upgrade refuses a real full scaffold with exit 2 and the documented message", async (t) => {
  const root = scaffold(t, "full");
  const before = fileHashes(root);
  const result = await cliOutput([
    "upgrade",
    "--edition",
    "full",
    "--repo",
    root,
  ]);
  assert.equal(result.code, 2);
  assert.equal(result.out, "");
  assert.equal(
    result.err,
    "HFS_UPGRADE_ALREADY_FULL: hfs.json edition is full; upgrade accepts only an edition lite app\n",
  );
  assert.deepEqual(fileHashes(root), before, "the refusal writes nothing");
});
