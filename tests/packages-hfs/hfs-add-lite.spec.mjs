import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { addTable } from "../../packages/hfs/scaffold/add-table.mjs";
import { addApp } from "../../packages/hfs/scaffold/add-app.mjs";
import { addKind } from "../../packages/hfs/scaffold/add.mjs";
import { main } from "../../packages/hfs/src/main.mjs";
import { checkDatabase } from "../../scripts/hfs/rules/database.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const made = [];
const ts = createRequire(import.meta.url)("typescript");
test.after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

const declaration = {
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
};

const repo = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hfs-add-lite-"));
  made.push(root);
  fs.writeFileSync(
    path.join(root, "hfs.json"),
    `${JSON.stringify(declaration, null, 2)}\n`,
  );
  for (const relative of [
    "src/modules/domain/identity/index.ts",
    "src/modules/platform/cqrs/index.ts",
    "src/modules/platform/database/database.module.ts",
    "src/modules/platform/database/index.ts",
    "src/modules/platform/http-security/index.ts",
  ]) {
    const target = path.join(root, "be", ...relative.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(ROOT, "packages", "hfs", "templates", "be", "skeleton-lite", ...relative.split("/")), target);
  }
  fs.writeFileSync(path.join(root, "package.json"), '{"dependencies":{}}\n');
  fs.mkdirSync(path.join(root, "be", "apps", "api", "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "be", "apps", "api", "src", "app.module.ts"),
    'import { Module } from "@nestjs/common"\n\n@Module({})\nexport class AppModule {\n    static register() {\n        return {\n            module: AppModule,\n            imports: [\n                ErrorsModule.register({\n                    kinds: [\n                    ],\n                }),\n            ],\n        }\n    }\n}\n',
  );
  fs.writeFileSync(
    path.join(root, "be", "apps", "api", "src", "main.ts"),
    'import { NestFactory } from "@nestjs/core"\nimport { parseHttpSecurityConfig } from "@modules/platform/http-security"\n\nconst env = {}\nconst options = { httpSecurity: parseHttpSecurityConfig(env) }\nvoid NestFactory.create(AppModule.register(options))\n',
  );
  return root;
};
const has = (root, relative) =>
  fs.existsSync(path.join(root, ...relative.split("/")));
const read = (root, relative) =>
  fs.readFileSync(path.join(root, ...relative.split("/")), "utf8");
const parses = (text) =>
  ts.transpileModule(text, {
    reportDiagnostics: true,
    compilerOptions: { experimentalDecorators: true },
  }).diagnostics.length === 0;

const prepareWebhookDependencies = (root) => {
  const domain = path.join(root, "be", "src", "modules", "domain", "calendars");
  fs.mkdirSync(domain, { recursive: true });
  fs.writeFileSync(
    path.join(domain, "calendars.service.ts"),
    'import type { EntityManager } from "typeorm"\n\ninterface CalendarDelivery { readonly id: string }\n\nexport class CalendarsService {\n    constructor(private readonly entityManager: EntityManager) {}\n\n    async acceptCalendarDelivery(delivery: CalendarDelivery): Promise<void> {\n        await Promise.resolve(delivery.id)\n    }\n}\n',
  );
  fs.writeFileSync(path.join(domain, "index.ts"), "");
  const database = path.join(root, "be", "src", "modules", "platform", "database");
  fs.mkdirSync(path.join(database, "errors"), { recursive: true });
  fs.writeFileSync(
    path.join(database, "index.ts"),
    'export { sql } from "./database.sql"\nexport { InjectPrimaryEntityManager } from "./primary.decorators"\n',
  );
  fs.writeFileSync(
    path.join(database, "errors", "database.error.ts"),
    'export enum DatabaseErrorCode {\n    IdentifierRejected = "DATABASE_IDENTIFIER_REJECTED",\n}\n\nexport const DATABASE_ERROR_KINDS = {\n    [DatabaseErrorCode.IdentifierRejected]: "internal",\n}\n\nexport class DatabaseError extends Error {\n    readonly code: DatabaseErrorCode\n    constructor(init: { readonly code: DatabaseErrorCode }) {\n        super(init.code)\n        this.code = init.code\n    }\n}\n',
  );
};

test("add table writes one policy-complete migration, FE db modules, and regenerated types", async () => {
  const root = repo();
  const generated =
    "export type Database = { public: { Tables: { orders: { Row: { id: string } } } } }\n";
  const result = addTable({
    root,
    name: "orders",
    fe: true,
    now: () => Date.UTC(2026, 9, 2, 12, 34, 56),
    emitTypes: () => generated,
  });
  const migration = "supabase/migrations/20261002123456_orders.sql";
  assert.deepEqual(result.created, [
    migration,
    "be/src/modules/platform/database/database.sql.ts",
    "be/src/modules/domain/orders/index.ts",
    "be/src/modules/domain/orders/errors/orders.error.ts",
    "be/src/modules/domain/orders/orders.module.ts",
    "be/src/modules/domain/orders/orders.module-definition.ts",
    "be/src/modules/domain/orders/orders.options.ts",
    "be/src/modules/domain/orders/orders.service.ts",
    "be/src/modules/domain/orders/persistence/orders.rows.ts",
    "be/src/modules/domain/orders/persistence/orders.sql.ts",
    "fe/apps/web/src/modules/db/orders/read-orders.ts",
    "fe/apps/web/src/modules/db/orders/write-orders.ts",
  ]);
  assert.equal(read(root, "supabase/types/database.types.ts"), generated);
  assert.match(
    read(root, migration),
    /create policy "orders_authenticated_update"/,
  );
  assert.match(
    read(root, "fe/apps/web/src/modules/db/orders/read-orders.ts"),
    /\.limit\(100\)/,
  );
  assert.match(
    read(root, "fe/apps/web/src/modules/db/orders/write-orders.ts"),
    /insertRow\(parsed\.data\.id, principal\.value\.id/,
  );
  assert.match(read(root, "be/src/modules/domain/orders/orders.service.ts"), /InjectPrimaryEntityManager/);
  assert.match(
    read(root, "be/src/modules/domain/orders/orders.service.ts"),
    /orders\(principalId: string, id: string\)/,
  );
  assert.match(
    read(root, "be/src/modules/domain/orders/orders.service.ts"),
    /requireOwnedRow<Pick<OrdersRow, "id">>\(this\.entityManager, FIND_ORDERS, id, principalId,/,
  );
  assert.match(
    read(root, "be/src/modules/domain/orders/persistence/orders.sql.ts"),
    /sql`SELECT id FROM public\.orders WHERE id = \$1 AND owner_id = \$2 LIMIT 1`/,
  );
  assert.match(read(root, "be/apps/api/src/app.module.ts"), /OrdersModule\.register\(\{ isGlobal: true \}\)/);
  assert.match(read(root, "be/apps/api/src/app.module.ts"), /ORDERS_ERROR_KINDS/);
  assert.doesNotMatch(read(root, "be/src/modules/domain/orders/index.ts"), /OrdersService/);
  assert.match(read(root, "be/src/modules/platform/database/index.ts"), /export \{ requireOwnedRow, sql \}/);
  assert.match(read(root, "be/src/modules/platform/database/index.ts"), /export \{ InjectPrimaryEntityManager \}/);
  for (const file of result.created.filter((entry) => entry.endsWith(".ts"))) {
    assert.equal(parses(read(root, file)), true, `${file} parses`);
  }
  const findings = await checkDatabase({
    repoRoot: root,
    files: [migration, "supabase/types/database.types.ts"],
    now: () => Date.UTC(2026, 9, 2, 12, 35, 0),
  });
  assert.deepEqual(findings, []);
  assert.throws(
    () => addTable({ root, name: "orders", emitTypes: false }),
    (error) => error?.code === "HFS_ADD_EXISTS",
  );
});

test("add table rolls back its files when the mandatory types emit fails and supports the explicit no-types seam", () => {
  const root = repo();
  assert.throws(
    () =>
      addTable({
        root,
        name: "invoices",
        now: () => Date.UTC(2026, 9, 2, 12, 34, 56),
        emitTypes: () => {
          throw new Error("CLI absent");
        },
      }),
    /CLI absent/,
  );
  assert.equal(
    has(root, "supabase/migrations/20261002123456_invoices.sql"),
    false,
  );
  const skipped = addTable({
    root,
    name: "invoices",
    now: () => Date.UTC(2026, 9, 2, 12, 34, 57),
    emitTypes: false,
  });
  assert.equal(skipped.types, "skipped");
  assert.equal(
    has(root, "supabase/migrations/20261002123457_invoices.sql"),
    true,
  );
  assert.equal(has(root, "supabase/types/database.types.ts"), false);
});

test("the add table CLI accepts --fe and --no-types and reports its created files", async () => {
  const root = repo();
  let out = "";
  let err = "";
  const code = await main(
    ["add", "table", "audit-events", "--fe", "--no-types", "--cwd", root],
    {
      stdout: (text) => {
        out += text;
      },
      stderr: (text) => {
        err += text;
      },
    },
  );
  assert.equal(code, 0, err);
  assert.match(out, /created supabase\/migrations\/\d{14}_audit-events\.sql/);
  assert.match(
    out,
    /created fe\/apps\/web\/src\/modules\/db\/audit-events\/write-audit-events\.ts/,
  );
  assert.equal(has(root, "supabase/types/database.types.ts"), false);
});

test("add app refuses a second lite front end and keeps full add-app behavior", () => {
  const root = repo();
  fs.writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "demo", private: true, workspaces: ["fe/packages/*"] }, null, 2)}\n`,
  );
  fs.mkdirSync(path.join(root, "fe", "apps", "web"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "fe", "apps", "web", "package.json"),
    `${JSON.stringify({ name: "@demo/web", private: true, scripts: { build: "next build" }, dependencies: { next: "16.0.0" } }, null, 2)}\n`,
  );
  assert.throws(
    () => addApp({ root, name: "admin" }),
    (error) =>
      error?.code === "HFS_ADD_LITE_SINGLE_APP" &&
      error.message ===
        "a lite app has one front-end app; a second app needs the shared <project>-ui and <project>-i18n packages: run starci app upgrade --edition full",
  );
  assert.equal(has(root, "fe/apps/admin"), false);

  const fullRoot = repo();
  const fullDeclaration = JSON.parse(read(fullRoot, "hfs.json"));
  fullDeclaration.edition = "full";
  fs.writeFileSync(
    path.join(fullRoot, "hfs.json"),
    `${JSON.stringify(fullDeclaration, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(fullRoot, "package.json"),
    `${JSON.stringify({ name: "demo", private: true, workspaces: ["fe/packages/*"] }, null, 2)}\n`,
  );
  fs.mkdirSync(path.join(fullRoot, "fe", "apps", "web"), { recursive: true });
  fs.writeFileSync(
    path.join(fullRoot, "fe", "apps", "web", "package.json"),
    `${JSON.stringify({ name: "@demo/web", private: true, scripts: { build: "next build" }, dependencies: { next: "16.0.0" } }, null, 2)}\n`,
  );
  const result = addApp({ root: fullRoot, name: "admin" });
  assert.ok(result.created.includes("fe/apps/admin/src/app/[locale]/layout.tsx"));
  assert.equal(
    JSON.parse(read(fullRoot, "fe/apps/admin/package.json")).name,
    "@demo/admin",
  );
  assert.deepEqual(JSON.parse(read(fullRoot, "hfs.json")).sides.fe.apps, [
    { name: "web", kind: "next" },
    { name: "admin", kind: "next" },
  ]);
  assert.deepEqual(JSON.parse(read(fullRoot, "package.json")).workspaces, [
    "fe/packages/*",
    "fe/apps/*",
  ]);
  assert.throws(
    () => addApp({ root: fullRoot, name: "admin" }),
    (error) => error?.code === "HFS_ADD_EXISTS",
  );
});

test("add cli bootstraps the optional lite app, Supabase migrate/seed groups, and a spec-free custom group", () => {
  const root = repo();
  fs.mkdirSync(path.join(root, "be"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "be", "nest-cli.json"),
    `${JSON.stringify(
      {
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
      },
      null,
      2,
    )}\n`,
  );
  const result = addKind({
    repoRoot: root,
    noun: "cli",
    name: "requeue",
    options: { service: "DeadLetterService=@modules/domain/order" },
  });
  assert.ok(result.created.includes("be/apps/cli/src/main.ts"));
  assert.ok(
    result.created.includes("be/src/features/cli/requeue/subs/run.cli.ts"),
  );
  assert.equal(
    result.created.some((file) => file.endsWith(".spec.ts")),
    false,
  );
  assert.match(
    read(root, "be/src/features/cli/migrate/subs/run.cli.ts"),
    /await this\.migrations\.run\(\)/,
  );
  assert.match(
    read(root, "be/src/features/cli/seed/subs/run.cli.ts"),
    /await this\.seeds\.run\(\)/,
  );
  assert.match(
    read(root, "be/src/features/cli/cli.module.ts"),
    /RequeueModule/,
  );
  assert.ok(
    JSON.parse(read(root, "hfs.json")).sides.be.apps.some(
      (app) => app.name === "cli" && app.kind === "cli",
    ),
  );
  assert.ok(JSON.parse(read(root, "be/nest-cli.json")).projects.cli);
  for (const file of result.created.filter((entry) => entry.endsWith(".ts"))) {
    assert.equal(parses(read(root, file)), true, `${file} parses`);
  }
});

test("add cli migrate bootstraps the built-in lite groups without a domain service", () => {
  const root = repo();
  fs.mkdirSync(path.join(root, "be"), { recursive: true });
  fs.writeFileSync(path.join(root, "be", "nest-cli.json"), `${JSON.stringify({ projects: { api: { type: "application", root: "apps/api", entryFile: "main", sourceRoot: "apps/api/src" } } }, null, 2)}\n`);
  const result = addKind({ repoRoot: root, noun: "cli", name: "migrate" });
  assert.ok(result.created.includes("be/apps/cli/src/main.ts"));
  assert.ok(result.created.includes("be/src/features/cli/migrate/subs/run.cli.ts"));
  assert.ok(result.created.includes("be/src/features/cli/seed/subs/run.cli.ts"));
  assert.ok(result.created.includes("be/src/modules/platform/database/migration-runner.service.ts"));
  assert.ok(result.created.includes("be/src/modules/platform/database/seed-runner.service.ts"));
  assert.deepEqual(result.registered, { patterns: [], kinds: ["cli"] });
  assert.match(JSON.parse(read(root, "package.json")).dependencies["nest-commander"], /^3\./);
  assert.match(read(root, "be/src/modules/platform/database/index.ts"), /MigrationRunnerService/);
  assert.match(read(root, "be/src/modules/platform/database/index.ts"), /SeedRunnerService/);
  assert.match(read(root, "be/src/modules/platform/database/database.module.ts"), /MigrationRunnerService/);
  assert.match(read(root, "be/src/modules/platform/database/database.module.ts"), /SeedRunnerService/);
  assert.throws(() => addKind({ repoRoot: root, noun: "cli", name: "migrate" }), error => error?.code === "HFS_ADD_EXISTS");
});

test("lite add api emits HTTP, and api plus webhook transports are composed in the API app", () => {
  const root = repo();
  addTable({ root, name: "bookings", emitTypes: false, now: () => Date.UTC(2026, 9, 2, 12, 34, 56) });
  const api = addKind({ repoRoot: root, noun: "api", name: "bookings", options: { service: "BookingsService=@modules/domain/bookings" } });
  assert.ok(api.created.includes("be/src/features/api/bookings/transport/http/bookings.controller.ts"));
  assert.ok(api.created.includes("be/src/features/api/bookings/transport/http/bookings-http.module.ts"));
  assert.equal(api.created.some(file => file.includes("/graphql/")), false);
  assert.match(read(root, "be/src/features/api/bookings/index.ts"), /BookingsHttpModule/);
  assert.match(read(root, "be/src/modules/domain/bookings/index.ts"), /BookingsService/);
  assert.match(read(root, "be/src/modules/domain/identity/index.ts"), /CurrentPrincipal/);
  assert.match(read(root, "be/src/modules/platform/cqrs/index.ts"), /ExecuteParams/);
  assert.match(read(root, "be/src/modules/platform/cqrs/index.ts"), /InjectCommandBus/);
  assert.match(
    read(root, "be/src/features/api/bookings/application/bookings.handler.ts"),
    /bookings\(command\.params\.principal\.id, command\.params\.request\.id\)/,
  );
  prepareWebhookDependencies(root);
  const webhook = addKind({ repoRoot: root, noun: "webhook", name: "calendar", options: { service: "CalendarsService=@modules/domain/calendars" } });
  assert.ok(webhook.created.includes("be/src/features/webhooks/calendar/transport/http/calendar-http.module.ts"));
  assert.ok(webhook.created.some(file => /supabase\/migrations\/\d{14}_calendar-inbox\.sql/.test(file)));
  assert.ok(webhook.created.includes("be/src/modules/domain/calendar-inbox/calendar-inbox.service.ts"));
  assert.equal(webhook.created.some(file => file.endsWith(".spec.ts")), false);
  const app = read(root, "be/apps/api/src/app.module.ts");
  assert.match(app, /import \{ BookingsHttpModule \} from "@features\/api\/bookings"/);
  assert.match(app, /import \{ CalendarHttpModule \} from "@features\/webhooks\/calendar"/);
  assert.match(app, /imports: \[\s+CalendarInboxModule\.register\(\{ isGlobal: true \}\),\s+CalendarHttpModule,\s+BookingsHttpModule,/);
  assert.match(
    read(root, "be/src/features/webhooks/calendar/transport/http/calendar.webhook.ts"),
    /@Headers\("x-calendar-delivery-id"\) deliveryId/,
  );
  assert.match(
    read(root, "be/src/modules/domain/calendars/calendars.service.ts"),
    /entityManager: EntityManager = this\.entityManager/,
  );
  const main = read(root, "be/apps/api/src/main.ts");
  assert.match(main, /parseWebhookProviderConfig/);
  assert.match(main, /calendar: parseWebhookProviderConfig\(env, "CALENDAR"\)/);
  assert.match(main, /rawBody: true/);
  const security = read(root, "be/src/modules/platform/http-security/index.ts");
  assert.match(security, /parseWebhookProviderConfig/);
  assert.match(security, /InjectWebhookSignature/);
  assert.match(security, /RateLimit, RateLimitGuard, RateTier/);
  assert.match(security, /WebhookSignatureService/);
});

test("the lite API skeleton installs one typed global validation pipe", () => {
  const main = fs.readFileSync(
    new URL("../../packages/hfs/templates/be/skeleton-lite/apps/api/src/main.ts", import.meta.url),
    "utf8",
  );
  const validation = fs.readFileSync(
    new URL("../../packages/hfs/templates/be/skeleton/src/modules/platform/http-security/request-validation.service.ts", import.meta.url),
    "utf8",
  );
  const errors = fs.readFileSync(
    new URL("../../packages/hfs/templates/be/skeleton/src/modules/platform/http-security/errors/http-security.error.ts", import.meta.url),
    "utf8",
  );
  assert.match(main, /app\.useGlobalPipes\(app\.get\(RequestValidationService\)\)/);
  assert.ok(main.indexOf("useGlobalPipes") < main.indexOf("await app.listen"));
  assert.match(validation, /whitelist: true/);
  assert.match(validation, /forbidNonWhitelisted: true/);
  assert.match(validation, /transform: true/);
  assert.match(validation, /HttpSecurityErrorCode\.RequestInvalid/);
  assert.match(errors, /\[HttpSecurityErrorCode\.RequestInvalid\]: "invalid"/);
});
