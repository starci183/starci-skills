import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { main } from "../../packages/hfs/src/main.mjs";
import {
  UpgradeError,
  fullEditionDeclaration,
  upgradeEdition,
} from "../../packages/hfs/upgrade/index.mjs";
import { renderTargets } from "../../packages/hfs/sync/index.mjs";
import { checkRepo, trackedFiles } from "../../scripts/hfs/check.mjs";
import { withMaterializedExample } from "../../scripts/hfs/example-secrets.mjs";
import {
  FORMATTED,
  gitAdd,
  installTypeScript,
} from "../helpers/hfs-cli-fixture.mjs";

import { MANIFEST, ROOT, PRESETS, put, fakeLock, contents, syntheticLite } from "../helpers/hfs-upgrade-fixture.mjs";

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
  put(root, "fe/apps/web/Dockerfile", "# authored optional lite image\nFROM node:22.14.0-alpine3.21\n");
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
  assert.equal(plan.find(step => step.path === "fe/apps/web/Dockerfile")?.op, "keep", "an authored optional front-end image is preserved");
  for (const file of [
    ".github/workflows/ci.yml",
    "codecov.yml",
    "sonar-project.properties",
    ".starcistacks/application-stacks.yaml",
    ".starcistacks/dev/infra/compose/compose.yaml",
    ".starciwork/index.yaml",
    ".starciwork/features/system-health/index.yaml",
    "be/apps/cli/src/main.ts",
    "be/src/features/cli/migrate/subs/run.cli.ts",
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
    "--cwd",
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
      "be/apps/api/src/app.module.ts",
      "be/apps/api/src/compose/api.ts",
      "be/src/features/api/system-health/index.ts",
      "be/src/features/api/system-health/system-health.module.ts",
      "be/src/features/api/system-health/application/check-liveness.contracts.ts",
      "be/src/features/api/system-health/transport/http/system-health-http.module.ts",
      "be/src/features/api/system-health/transport/http/live.controller.ts",
      "be/src/modules/domain/sample/sample.service.ts",
      "fe/apps/web/src/app/[locale]/page.tsx",
      "fe/apps/web/Dockerfile",
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
  for (const directory of ["world", "fixtures", "integration", "e2e", "contract"])
    assert.equal(
      fs.existsSync(path.join(root, "be/src/tests", directory)),
      false,
      `tests/${directory} is left for authored specs instead of an untracked empty directory`,
    );
});

test("the committed lite example has a read-only, additions-only full upgrade plan", async () => {
  await withMaterializedExample(ROOT, "examples/lite-app", async (root) => {
    assert.ok(fs.existsSync(path.join(root, "hfs.json")), "examples/lite-app is present");
    const before = contents(root);
    const plan = await upgradeEdition({ root, to: "full", plan: true, presets: PRESETS });
    assert.deepEqual(contents(root), before, "planning the example changes no byte");
    assert.ok(plan.length > 0, "the full edition has additions to make");
    const lite = JSON.parse(fs.readFileSync(path.join(root, "hfs.json"), "utf8"));
    const full = fullEditionDeclaration(lite, MANIFEST);
    const managed = new Set([
      "hfs.json",
      "package-lock.json",
      "be/nest-cli.json",
      ...renderTargets(full, PRESETS, { manifest: MANIFEST }).map(
        (target) => target.path,
      ),
    ]);
    for (const step of plan) {
      if (step.op === "add") {
        assert.equal(before[step.path], undefined, `${step.path} is a new full-edition path`);
        continue;
      }
      if (step.op === "keep") {
        assert.notEqual(before[step.path], undefined, `${step.path} is an app-owned file the upgrade leaves as it is`);
        continue;
      }
      if (step.op === "rewrite-readme") {
        assert.equal(step.path, "README.md");
        continue;
      }
      assert.ok(managed.has(step.path), `${step.op} touches only a managed declaration: ${step.path}`);
    }
    const product = /^(?:supabase\/(?:migrations|types)\/|be\/src\/(?:features|modules)\/|fe\/apps\/[^/]+\/src\/)/;
    assert.deepEqual(plan.filter(step => product.test(step.path)), [], "the plan never replaces lite product source");
  });
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
    "--cwd",
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
    "--cwd",
    root,
  ]);
  assert.equal(second.code, 2);
  assert.match(second.err, /^HFS_UPGRADE_ALREADY_FULL:/);
  const mismatch = await outputOf([
    "check",
    "--edition",
    "lite",
    "--cwd",
    root,
    "--fast",
  ]);
  assert.equal(mismatch.code, 2);
  assert.match(mismatch.err, /^HFS_EDITION_INVALID:/);

  const conflicted = syntheticLite(t, "conflict-demo");
  put(
    conflicted,
    ".starcistacks/dev/infra/compose/api.yaml",
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
      /compose\/api\.yaml/.test(error.message),
  );
  assert.deepEqual(
    contents(conflicted),
    conflictBefore,
    "an existing non-canon managed addition is refused before apply",
  );

  const kept = syntheticLite(t, "kept-stacks-demo");
  const declared = "schema: starci/application-stacks@1\nservices: [{ name: app-owned }]\n";
  put(kept, ".starcistacks/application-stacks.yaml", declared);
  const keptPlan = await upgradeEdition({ root: kept, to: "full", plan: true, presets: PRESETS });
  assert.deepEqual(
    keptPlan.filter((step) => step.path === ".starcistacks/application-stacks.yaml").map((step) => step.op),
    ["keep"],
    "an app that declares its stacks keeps the declaration; the plan reports it kept",
  );
  assert.ok(keptPlan.some((step) => step.op === "add" && step.path === ".starcistacks/dev/infra/compose/api.yaml"), "the rest of the scaffold is still added");
  await upgradeEdition({ root: kept, to: "full", presets: PRESETS, lock: fakeLock });
  assert.equal(
    fs.readFileSync(path.join(kept, ".starcistacks/application-stacks.yaml"), "utf8"),
    declared,
    "the app-owned stacks declaration is byte-identical after the upgrade",
  );
  assert.ok(fs.existsSync(path.join(kept, ".starcistacks/dev/infra/compose/api.yaml")));

  const absentRoot = syntheticLite(t, "absent-stacks-demo");
  fs.unlinkSync(path.join(absentRoot, ".starcistacks", "application-stacks.yaml"));
  const absent = await upgradeEdition({ root: absentRoot, to: "full", plan: true, presets: PRESETS });
  assert.deepEqual(
    absent.filter((step) => step.path === ".starcistacks/application-stacks.yaml").map((step) => step.op),
    ["add"],
    "an absent stacks declaration is added",
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
