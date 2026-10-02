import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { addTable } from "../../packages/hfs/scaffold/add-table.mjs";
import { checkDatabase } from "../../scripts/hfs/rules/database.mjs";

const made = [];
const ts = createRequire(import.meta.url)("typescript");
const at = Date.UTC(2026, 9, 2, 12, 34, 56);

test.after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

function appRoot({ edition = "lite", provider = "supabase" } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hfs-add-table-"));
  made.push(root);
  const declaration = {
    hfs: 2,
    kind: "app",
    ...(edition === "full" ? {} : { edition }),
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
            provider,
          },
        ],
      },
      fe: {
        apps: [{ name: "web", kind: "next" }],
        reads: ["be/contracts/", "supabase/types/"],
      },
    },
  };
  fs.writeFileSync(
    path.join(root, "hfs.json"),
    `${JSON.stringify(declaration, null, 2)}\n`,
  );
  const appModule = path.join(root, "be", "apps", "api", "src", "app.module.ts");
  fs.mkdirSync(path.dirname(appModule), { recursive: true });
  fs.writeFileSync(
    appModule,
    'import { Module } from "@nestjs/common"\n\n@Module({})\nexport class AppModule {\n    static register() {\n        return {\n            module: AppModule,\n            imports: [\n            ],\n        }\n    }\n}\n',
  );
  return root;
}

const has = (root, relative) =>
  fs.existsSync(path.join(root, ...relative.split("/")));
const read = (root, relative) =>
  fs.readFileSync(path.join(root, ...relative.split("/")), "utf8");
const parses = (text) =>
  ts.transpileModule(text, {
    reportDiagnostics: true,
    compilerOptions: { experimentalDecorators: true },
  }).diagnostics.length === 0;
const generatedTypes = (table) =>
  `export type Database = { public: { Tables: { ${table}: { Row: { id: string } } } } }\n`;

test("addTable accepts kebab, snake-case, plural, and reserved names and every accepted migration is database-clean", async () => {
  for (const [name, feature, table, delivery, quoted = false] of [
    ["orders", "orders", "orders", "Order"],
    ["audit-events", "audit-events", "audit_events", "AuditEvent"],
    ["audit_events", "audit-events", "audit_events", "AuditEvent"],
    ["select", "select", "select", "Select", true],
    ["order", "order", "order", "Order", true],
    ["user", "user", "user", "User", true],
  ]) {
    const root = appRoot();
    const result = addTable({
      root,
      name,
      now: () => at,
      emitTypes: () => generatedTypes(table),
    });
    const migration = `supabase/migrations/20261002123456_${feature}.sql`;
    assert.ok(result.created.includes(migration));
    const sqlTable = quoted ? `"${table}"` : table;
    assert.match(
      read(root, migration),
      new RegExp(`create table public\\.${sqlTable} \\(`),
    );
    assert.match(
      read(root, `be/src/modules/domain/${feature}/${feature}.service.ts`),
      new RegExp(`accept${delivery}Delivery`),
    );
    assert.deepEqual(
      await checkDatabase({
        repoRoot: root,
        files: [migration, "supabase/types/database.types.ts"],
        git: () => ({ ok: false, stdout: "" }),
        now: () => at + 1_000,
      }),
      [],
      `${name} migration is valid PostgreSQL and satisfies every database rule`,
    );
  }
});

test("addTable refuses uppercase and a second non-increasing timestamp", () => {
  for (const name of ["Orders"]) {
    const root = appRoot();
    assert.throws(
      () => addTable({ root, name, emitTypes: false, now: () => at }),
      (error) => error?.code === "HFS_ADD_NAME_INVALID",
      name,
    );
  }

  const root = appRoot();
  addTable({ root, name: "orders", emitTypes: false, now: () => at });
  assert.throws(
    () => addTable({ root, name: "invoices", emitTypes: false, now: () => at }),
    (error) => error?.code === "HFS_ADD_MIGRATION_ORDER",
  );
  assert.deepEqual(
    fs.readdirSync(path.join(root, "supabase", "migrations")),
    ["20261002123456_orders.sql"],
  );
});

test("addTable --fe writes TypeScript readers and writers, while --no-types skips emission", () => {
  const root = appRoot();
  const result = addTable({
    root,
    name: "audit-events",
    fe: true,
    emitTypes: false,
    now: () => at,
  });
  assert.equal(result.types, "skipped");
  assert.equal(has(root, "supabase/types/database.types.ts"), false);
  for (const relative of [
    "fe/apps/web/src/modules/db/audit-events/read-audit-events.ts",
    "fe/apps/web/src/modules/db/audit-events/write-audit-events.ts",
  ]) {
    assert.ok(result.created.includes(relative));
    assert.equal(parses(read(root, relative)), true, `${relative} parses`);
  }
});

test("addTable removes every partial file and restores app-owned state when types emission fails", () => {
  const root = appRoot();
  const owner = "be/apps/api/src/app.module.ts";
  const ownerBefore = read(root, owner);
  fs.mkdirSync(path.join(root, "supabase", "types"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "supabase", "types", "database.types.ts"),
    "// existing types\n",
  );

  assert.throws(
    () =>
      addTable({
        root,
        name: "invoices",
        fe: true,
        now: () => at,
        emitTypes: () => {
          throw new Error("types unavailable");
        },
      }),
    /types unavailable/,
  );
  assert.equal(has(root, "supabase/migrations/20261002123456_invoices.sql"), false);
  assert.equal(has(root, "be/src/modules/domain/invoices"), false);
  assert.equal(has(root, "fe/apps/web/src/modules/db/invoices"), false);
  assert.equal(read(root, owner), ownerBefore);
  assert.equal(read(root, "supabase/types/database.types.ts"), "// existing types\n");
});

test("addTable refuses an existing table and a full app without the Supabase provider", () => {
  const root = appRoot();
  addTable({ root, name: "orders", emitTypes: false, now: () => at });
  assert.throws(
    () =>
      addTable({
        root,
        name: "orders",
        emitTypes: false,
        now: () => at + 1_000,
      }),
    (error) => error?.code === "HFS_ADD_EXISTS",
  );

  const full = appRoot({ edition: "full", provider: "postgres" });
  assert.throws(
    () => addTable({ root: full, name: "orders", emitTypes: false }),
    (error) => error?.code === "HFS_ADD_TABLE_PROVIDER",
  );
  assert.equal(has(full, "supabase/migrations"), false);
});
