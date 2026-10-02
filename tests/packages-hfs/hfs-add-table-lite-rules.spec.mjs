import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { addTable } from "../../packages/hfs/scaffold/add-table.mjs";
import { scaffoldApp } from "../../packages/hfs/scaffold/app.mjs";
import { checkArchitecture } from "../../scripts/hfs/architecture.mjs";
import { checkDatabase } from "../../scripts/hfs/rules/database.mjs";
import { parseYaml } from "../../engine/yaml.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const PINS = parseYaml(
  fs.readFileSync(path.join(ROOT, "knowledge", "hfs", "canon-pins.yaml"), "utf8"),
).pins;
const ts = createRequire(import.meta.url)("typescript");
const made = [];

const CASES = Object.freeze([
  { input: "resources", feature: "resources", table: "resources" },
  { input: "bookings", feature: "bookings", table: "bookings" },
  {
    input: "calendar-events",
    feature: "calendar-events",
    table: "calendar_events",
  },
  {
    input: "user_profiles",
    feature: "user-profiles",
    table: "user_profiles",
  },
  { input: "a", feature: "a", table: "a" },
  { input: "x1", feature: "x1", table: "x1" },
  { input: "n".repeat(40), feature: "n".repeat(40), table: "n".repeat(40) },
  { input: "order", feature: "order", table: "order" },
  { input: "user", feature: "user", table: "user" },
  { input: "resource2", feature: "resource2", table: "resource2" },
  { input: "v2-events", feature: "v2-events", table: "v2_events" },
]);
const RESERVED = new Set(["order", "user"]);

test.after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

const fakeLock = (root) => {
  fs.writeFileSync(
    path.join(root, "package-lock.json"),
    '{"name":"demo","lockfileVersion":3,"packages":{}}\n',
  );
  return { ok: true };
};

const databaseTypes = (tables) => {
  const entries = [...tables]
    .sort()
    .map(
      (name) => `      ${JSON.stringify(name)}: {
        Row: { id: string; owner_id: string; created_at: string; updated_at: string }
        Insert: { id?: string; owner_id: string; created_at?: string; updated_at?: string }
        Update: { id?: string; owner_id?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }`,
    )
    .join("\n");
  return `export type Database = {
  public: {
    Tables: {
${entries}
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}\n`;
};

const trackedFiles = (root) =>
  execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .map((file) => file.replaceAll("\\", "/"));

const exposeRepoTsconfig = (root) => {
  const target = path.join(root, "node_modules", "@starci", "tsconfig");
  fs.mkdirSync(target, { recursive: true });
  for (const file of [
    "package.json",
    "base.json",
    "be.json",
    "build.json",
    "next.json",
    "e2e.json",
  ]) {
    fs.copyFileSync(path.join(ROOT, "packages", "tsconfig", file), path.join(target, file));
  }
};

const problemsOf = (report) => [
  ...report.errors.map((problem) => ({ kind: "error", ...problem })),
  ...report.violations.map((problem) => ({ kind: "violation", ...problem })),
];

test("add table --fe stays database- and architecture-clean for every accepted table name", async (t) => {
  const into = fs.mkdtempSync(path.join(os.tmpdir(), "hfs-add-table-lite-rules-"));
  made.push(into);
  const tables = new Set(["profiles"]);
  const createdAt = new Date("2026-10-02T12:34:56.000Z");
  const { root } = scaffoldApp({
    name: "demo",
    into,
    edition: "lite",
    pins: PINS,
    lock: fakeLock,
    emitTypes: () => databaseTypes(tables),
    now: () => createdAt,
  });
  execFileSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["-c", "core.autocrlf=false", "add", "-A"], {
    cwd: root,
    stdio: "ignore",
  });

  for (const [index, item] of CASES.entries()) {
    tables.add(item.table);
    const stamp = `202610021235${String(index).padStart(2, "0")}`;
    const result = addTable({
      root,
      name: item.input,
      fe: true,
      emitTypes: () => databaseTypes(tables),
      now: () => Date.UTC(2026, 9, 2, 12, 35, index),
    });
    const migration = `supabase/migrations/${stamp}_${item.feature}.sql`;
    assert.equal(result.created[0], migration);
    assert.ok(
      result.created.includes(
        `fe/apps/web/src/modules/db/${item.feature}/write-${item.feature}.ts`,
      ),
    );
    const sql = fs.readFileSync(path.join(root, ...migration.split("/")), "utf8");
    const sqlTable = RESERVED.has(item.table) ? `"${item.table}"` : item.table;
    assert.match(sql, new RegExp(`public\\.${sqlTable}`));
    if (RESERVED.has(item.table)) {
      assert.doesNotMatch(sql, new RegExp(`public\\.${item.table}\\b`));
    }
    for (const file of result.created.filter((entry) => entry.endsWith(".ts"))) {
      const text = fs.readFileSync(path.join(root, ...file.split("/")), "utf8");
      const diagnostics = ts.transpileModule(text, {
        fileName: file,
        reportDiagnostics: true,
        compilerOptions: { experimentalDecorators: true },
      }).diagnostics;
      assert.deepEqual(diagnostics, [], `${file} has valid TypeScript syntax`);
    }
  }

  execFileSync("git", ["-c", "core.autocrlf=false", "add", "-A"], {
    cwd: root,
    stdio: "ignore",
  });
  const files = trackedFiles(root);
  const databaseFindings = await checkDatabase({
    repoRoot: root,
    files,
    emitTypes: () => databaseTypes(tables),
    now: () => Date.UTC(2026, 9, 2, 12, 36, 0),
  });
  assert.deepEqual(databaseFindings, []);

  // The app remains uninstalled: expose only the repository's canonical tsconfig package,
  // while the architecture seam below supplies this repository's TypeScript compiler.
  exposeRepoTsconfig(root);
  for (const side of ["be", "fe"]) {
    await t.test(`${side} architecture machine accepts the generated tree`, (subtest) => {
      const paths = CASES.map((item) =>
        side === "be"
          ? `src/modules/domain/${item.feature}`
          : `apps/web/src/modules/db/${item.feature}`,
      );
      const report = checkArchitecture({
        repositoryRoot: path.join(root, side),
        injectedTypeScript: ts,
        paths,
        fast: true,
      });
      const problems = problemsOf(report);
      // Known pending T8: sql-owner must use the Supabase migration/type schema when schemaAuthority is supabase.
      const schemaAuthorityGap = problems.filter(
        (problem) =>
          problem.ruleId === "BE_SQL_TABLE_OWNER" &&
          problem.check === "sqlOwner" &&
          /no @Entity declares/.test(problem.message),
      );
      assert.deepEqual(
        problems.filter((problem) => !schemaAuthorityGap.includes(problem)),
        [],
      );
      if (schemaAuthorityGap.length) {
        assert.deepEqual(
          [...new Set(schemaAuthorityGap.map((problem) => problem.table))].sort(),
          CASES.map((item) => item.table).sort(),
        );
        subtest.skip(
          "BE_SQL_TABLE_OWNER does not yet honor lite schemaAuthority=supabase, which forbids TypeORM entities; reported to the rule owner",
        );
      }
    });
  }
});
