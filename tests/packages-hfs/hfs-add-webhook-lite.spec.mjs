import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { Script } from "node:vm";
import { addKind } from "../../packages/hfs/scaffold/add.mjs";
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
        Row: { id: string; owner_id: string; provider: string; delivery_id: string; received_at: string; payload: unknown; processed_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; owner_id?: string; provider?: string; delivery_id?: string; received_at?: string; payload?: unknown; processed_at?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; owner_id?: string; provider?: string; delivery_id?: string; received_at?: string; payload?: unknown; processed_at?: string | null; created_at?: string; updated_at?: string }
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

test("lite add webhook writes a policy-clean pending inbox and an architecture-clean record-only intake", async () => {
  const into = fs.mkdtempSync(path.join(os.tmpdir(), "hfs-add-webhook-lite-"));
  made.push(into);
  const tables = new Set(["profiles"]);
  const { root } = scaffoldApp({
    name: "demo",
    into,
    edition: "lite",
    pins: PINS,
    lock: fakeLock,
    emitTypes: () => databaseTypes(tables),
    now: () => new Date("2026-10-02T12:34:00.000Z"),
  });
  execFileSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["-c", "core.autocrlf=false", "add", "-A"], {
    cwd: root,
    stdio: "ignore",
  });

  tables.add("calendars");
  addTable({
    root,
    name: "calendars",
    emitTypes: () => databaseTypes(tables),
    now: () => Date.UTC(2026, 9, 2, 12, 35, 0),
  });
  tables.add("payments");
  addTable({
    root,
    name: "payments",
    emitTypes: () => databaseTypes(tables),
    now: () => Date.UTC(2026, 9, 2, 12, 36, 0),
  });
  const calendarService = path.join(root, "be/src/modules/domain/calendars/calendars.service.ts");
  const calendarBefore = fs.readFileSync(calendarService, "utf8");

  tables.add("calendar_inbox");
  const calendar = addKind({
    repoRoot: root,
    noun: "webhook",
    name: "calendar",
    options: { service: "CalendarsService=@modules/domain/calendars" },
    now: () => Date.UTC(2026, 9, 2, 12, 37, 0),
  });
  tables.add("payment_inbox");
  const payment = addKind({
    repoRoot: root,
    noun: "webhook",
    name: "payment",
    options: { service: "PaymentsService=@modules/domain/payments" },
    now: () => Date.UTC(2026, 9, 2, 12, 38, 0),
  });
  fs.writeFileSync(
    path.join(root, "supabase", "types", "database.types.ts"),
    databaseTypes(tables),
  );

  const calendarMigration =
    "supabase/migrations/20261002123700_calendar-inbox.sql";
  const paymentMigration =
    "supabase/migrations/20261002123800_payment-inbox.sql";
  assert.ok(calendar.created.includes(calendarMigration));
  assert.ok(payment.created.includes(paymentMigration));
  assert.ok(calendar.created.includes("be/src/modules/domain/calendar-inbox/calendar-inbox.service.ts"));
  assert.ok(payment.created.includes("be/src/modules/domain/payment-inbox/payment-inbox.service.ts"));

  const migration = fs.readFileSync(path.join(root, calendarMigration), "utf8");
  assert.match(migration, /unique \(provider, delivery_id\)/i);
  assert.match(migration, /received_at timestamptz not null default now\(\)/i);
  assert.match(migration, /payload jsonb not null/i);
  assert.match(migration, /processed_at timestamptz/i);
  assert.match(migration, /to app_be/i);
  assert.match(migration, /revoke all on table public\.calendar_inbox from public, anon, authenticated/i);
  assert.doesNotMatch(migration, /service_role/i);

  const sql = fs.readFileSync(
    path.join(
      root,
      "be/src/modules/domain/calendar-inbox/persistence/calendar-inbox.sql.ts",
    ),
    "utf8",
  );
  assert.match(sql, /ON CONFLICT \(provider, delivery_id\) DO NOTHING/i);
  assert.match(sql, /RETURNING id/i);
  const client = fs.readFileSync(
    path.join(root, "be/src/modules/platform/database/webhook-inbox.client.ts"),
    "utf8",
  );
  assert.match(client, /entityManager\.transaction/);
  assert.match(client, /export const recordWebhookDelivery/);
  assert.doesNotMatch(client, /await process|manager\.query\(complete|readonly process:/);
  assert.match(client, /DatabaseErrorCode\.WebhookDeliveryIdRequired/);
  const door = fs.readFileSync(
    path.join(
      root,
      "be/src/features/webhooks/calendar/transport/http/calendar.webhook.ts",
    ),
    "utf8",
  );
  assert.match(door, /@Headers\("x-calendar-delivery-id"\) deliveryId/);
  assert.match(door, /recordCalendarDelivery\(deliveryId, delivery\)/);
  assert.match(door, /this\.signature\.verify\([^\n]+\)\s+await this\.deliveries\.recordCalendarDelivery/);
  const inbox = fs.readFileSync(path.join(root, "be/src/modules/domain/calendar-inbox/calendar-inbox.service.ts"), "utf8");
  assert.match(inbox, /return recordWebhookDelivery/);
  assert.doesNotMatch(inbox, /CalendarsService|process:|complete:|CommandBus|QueryBus/);
  const service = fs.readFileSync(
    path.join(root, "be/src/modules/domain/calendars/calendars.service.ts"),
    "utf8",
  );
  assert.equal(service, calendarBefore, 'recording does not adapt a business processing method into the request transaction');
  const securityIndex = fs.readFileSync(
    path.join(root, "be/src/modules/platform/http-security/index.ts"),
    "utf8",
  );
  assert.match(securityIndex, /parseWebhookProviderConfig/);
  assert.match(securityIndex, /InjectWebhookSignature/);
  assert.match(securityIndex, /RateLimit, RateLimitGuard, RateTier/);
  assert.match(securityIndex, /WebhookSignatureService/);

  for (const file of [...calendar.created, ...payment.created].filter((entry) => entry.endsWith(".ts"))) {
    const diagnostics = ts.transpileModule(
      fs.readFileSync(path.join(root, ...file.split("/")), "utf8"),
      {
        fileName: file,
        reportDiagnostics: true,
        compilerOptions: { experimentalDecorators: true },
      },
    ).diagnostics;
    assert.deepEqual(diagnostics, [], `${file} has valid TypeScript syntax`);
  }

  execFileSync("git", ["-c", "core.autocrlf=false", "add", "-A"], {
    cwd: root,
    stdio: "ignore",
  });
  const databaseFindings = await checkDatabase({
    repoRoot: root,
    files: trackedFiles(root),
    emitTypes: () => databaseTypes(tables),
    now: () => Date.UTC(2026, 9, 2, 12, 39, 0),
  });
  assert.deepEqual(databaseFindings, []);

  exposeRepoTsconfig(root);
  const report = checkArchitecture({
    repositoryRoot: path.join(root, "be"),
    injectedTypeScript: ts,
    paths: [
      "apps/api/src/app.module.ts",
      "src/features/webhooks/calendar",
      "src/features/webhooks/payment",
      "src/modules/domain/calendar-inbox",
      "src/modules/domain/payment-inbox",
      "src/modules/domain/calendars",
      "src/modules/domain/payments",
      "src/modules/platform/database",
    ],
    fast: true,
  });
  assert.deepEqual(problemsOf(report), []);
});

test("the generated inbox helper commits pending records, ignores duplicates and never invokes business processing", async () => {
  const source = fs.readFileSync(path.join(ROOT, "packages/hfs/templates/be/inbox/database-client.ts.tpl"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const runtime = {};
  class DatabaseError extends Error {
    constructor({ code }) { super(code); this.code = code; }
  }
  new Script(compiled).runInNewContext({ exports: runtime, require: () => ({ DatabaseError, DatabaseErrorCode: { WebhookDeliveryIdRequired: "delivery-id-required" } }) });
  const pending = new Map();
  let transactions = 0;
  let commits = 0;
  let queryCalls = 0;
  let processingCalls = 0;
  const entityManager = {
    transaction: async (callback) => {
      transactions += 1;
      await callback({
        query: async (_insert, [provider, deliveryId, payload]) => {
          queryCalls += 1;
          const key = `${provider}:${deliveryId}`;
          if (pending.has(key)) return [];
          pending.set(key, { payload: JSON.parse(payload), processedAt: null });
          return [{ id: key }];
        },
      });
      commits += 1;
    },
  };
  const input = { entityManager, insert: "pending-insert", provider: "calendar", deliveryId: " delivery-1 ", payload: { id: "delivery-1" }, process: async () => { processingCalls += 1; } };

  await runtime.recordWebhookDelivery(input);
  await runtime.recordWebhookDelivery(input);

  assert.deepEqual([...pending.values()], [{ payload: { id: "delivery-1" }, processedAt: null }]);
  assert.equal(queryCalls, 2, 'each delivery performs only the conflict-safe record attempt');
  assert.equal(commits, 2);
  assert.equal(processingCalls, 0, 'business processing happens only in a later consumer');
  for (const deliveryId of [undefined, "   "]) {
    await assert.rejects(runtime.recordWebhookDelivery({ ...input, deliveryId }), { code: "delivery-id-required" });
  }
  assert.equal(transactions, 2, 'missing ids are refused before a transaction opens');
});
