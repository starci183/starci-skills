import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { addTable } from "../../packages/hfs/scaffold/add-table.mjs";
import { checkDatabase } from "../../scripts/hfs/rules/database.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
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
    hfs: 3,
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
  if (edition === "lite") {
    // The barrels `add table` (and, with --fe, its GraphQL feature) registers exports in: lite's overlay, else the shared skeleton's.
    const templates = path.join(ROOT, "packages", "hfs", "templates", "be");
    for (const relative of [
      "src/modules/domain/identity/index.ts",
      "src/modules/platform/cqrs/index.ts",
      "src/modules/platform/database/index.ts",
      "src/modules/platform/errors/index.ts",
      "src/modules/platform/i18n/index.ts",
    ]) {
      const target = path.join(root, "be", ...relative.split("/"));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const lite = path.join(templates, "skeleton-lite", ...relative.split("/"));
      fs.copyFileSync(fs.existsSync(lite) ? lite : path.join(templates, "skeleton", ...relative.split("/")), target);
    }
  }
  const appModule = path.join(root, "be", "apps", "api", "src", "app.module.ts");
  fs.mkdirSync(path.dirname(appModule), { recursive: true });
  fs.writeFileSync(
    appModule,
    'import { Module } from "@nestjs/common"\n\n@Module({})\nexport class AppModule {\n    static register() {\n        return {\n            module: AppModule,\n            imports: [\n                ErrorsModule.register({\n                    kinds: [\n                    ],\n                }),\n            ],\n        }\n    }\n}\n',
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
  for (const [name, feature, table, quoted = false] of [
    ["orders", "orders", "orders"],
    ["audit-events", "audit-events", "audit_events"],
    ["audit_events", "audit-events", "audit_events"],
    ["select", "select", "select", true],
    ["order", "order", "order", true],
    ["user", "user", "user", true],
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
    const sql = read(root, migration);
    assert.match(
      sql,
      new RegExp(`create table public\\.${sqlTable} \\(`),
    );
    assert.match(
      sql,
      /owner_id uuid not null references auth\.users \(id\) on delete cascade/,
    );
    assert.match(
      sql,
      new RegExp(`create index ${table}_owner_id_idx on public\\.${sqlTable} \\(owner_id\\)`),
    );
    assert.match(
      sql,
      new RegExp(`create trigger ${table}_set_updated_at[\\s\\S]*before update on public\\.${sqlTable}[\\s\\S]*execute function private\\.set_updated_at\\(\\)`),
    );
    assert.match(
      sql,
      new RegExp(`revoke all on table public\\.${sqlTable} from public, anon`),
    );
    // the back end is the only reader and writer of a table (owner ruling 2026-10-13); the front end holds no grant
    assert.match(
      sql,
      new RegExp(`grant select, insert, update, delete on table public\\.${sqlTable} to app_be`),
    );
    assert.doesNotMatch(sql, /to authenticated/, "the front end holds no table grant");
    const service = read(root, `be/src/modules/domain/${feature}/${feature}.service.ts`);
    assert.match(service, /\(principalId: string, id: string\)/);
    assert.match(service, /requireOwnedRow[^\n]+this\.entityManager, [A-Z0-9_]+, id, principalId,/);
    assert.match(
      read(root, `be/src/modules/domain/${feature}/persistence/${feature}.sql.ts`),
      /WHERE id = \$1 AND owner_id = \$2 LIMIT 1/,
    );
    assert.match(
      read(root, `be/src/modules/domain/${feature}/errors/${feature}.error.ts`),
      /NotFound = "[A-Z0-9_]+_NOT_FOUND"/,
    );
    assert.match(read(root, "be/src/modules/platform/database/index.ts"), /export \{ requireOwnedRow, sql \}/);
    assert.match(read(root, "be/src/modules/platform/database/index.ts"), /export \{ InjectPrimaryEntityManager \}/);
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

test("addTable --fe writes the GraphQL feature, the fe operation files and SWR hooks (never Server Actions), while --no-types skips emission", () => {
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
    "be/src/features/api/audit-events/transport/graphql/get-audit-event.resolver.ts",
    "be/src/features/api/audit-events/transport/graphql/create-audit-event.resolver.ts",
    "be/src/features/api/audit-events/transport/graphql/audit-events-graphql.module.ts",
    "be/src/modules/platform/graphql/graphql.module.ts",
    "fe/apps/web/src/modules/api/graphql/queries/query-audit-event.ts",
    "fe/apps/web/src/modules/api/graphql/queries/types/audit-event.ts",
    "fe/apps/web/src/modules/api/graphql/mutations/mutation-create-audit-event.ts",
    "fe/apps/web/src/modules/api/graphql/mutations/types/create-audit-event.ts",
    "fe/apps/web/src/hooks/swr/api/graphql/queries/useQueryAuditEventSwr.ts",
    "fe/apps/web/src/hooks/swr/api/graphql/mutations/useMutateCreateAuditEventSwr.ts",
  ]) {
    assert.ok(result.created.includes(relative), relative);
    assert.equal(parses(read(root, relative)), true, `${relative} parses`);
  }
  for (const relative of result.created.filter((file) => file.startsWith("fe/")))
    assert.doesNotMatch(read(root, relative), /use server|@supabase|server-only/, `${relative} reaches data only through GraphQL`);
  assert.equal(result.created.some((file) => file.includes("/modules/db/")), false);
  // The first GraphQL operation brings the app's Apollo clients and the env reader their http link calls; a second one reuses them.
  for (const relative of ["fe/apps/web/src/modules/api/graphql/clients/clients/auth.ts", "fe/apps/web/src/modules/api/graphql/clients/links/http.ts"])
    assert.ok(result.created.includes(relative), relative);
  assert.match(read(root, "fe/apps/web/src/modules/config/index.ts"), /^export const graphqlUrl = /m);
  const second = addTable({ root, name: "audit-notes", fe: true, emitTypes: false, now: () => at + 1000 });
  assert.equal(second.created.some((file) => file.includes("/graphql/clients/")), false, "the clients are written once");
  assert.equal(read(root, "fe/apps/web/src/modules/config/index.ts").match(/export const graphqlUrl/g).length, 1);
});

test("addTable --fe writes the fe operations into every product app, never into the marketing landing", () => {
  const root = appRoot();
  const declaration = JSON.parse(read(root, "hfs.json"));
  declaration.sides.fe.apps = [{ name: "landing", kind: "next" }, { name: "web", kind: "next" }];
  fs.writeFileSync(path.join(root, "hfs.json"), `${JSON.stringify(declaration, null, 2)}\n`);
  const result = addTable({ root, name: "orders", fe: true, emitTypes: false, now: () => at });
  assert.ok(result.created.includes("fe/apps/web/src/modules/api/graphql/queries/query-order.ts"));
  assert.equal(result.created.some((file) => file.startsWith("fe/apps/landing/")), false);
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
  assert.equal(has(root, "be/src/features/api/invoices"), false);
  assert.equal(has(root, "be/src/modules/platform/graphql"), false);
  assert.equal(has(root, "fe/apps/web/src/modules/api/graphql/queries/query-invoice.ts"), false);
  assert.equal(has(root, "fe/apps/web/src/hooks/swr"), false);
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
