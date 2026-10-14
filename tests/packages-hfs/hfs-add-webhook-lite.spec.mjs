import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { Script } from "node:vm";
import { Linter } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { addKind } from "../../packages/hfs/scaffold/add.mjs";
import { addTable } from "../../packages/hfs/scaffold/add-table.mjs";
import { scaffoldApp } from "../../packages/hfs/scaffold/app.mjs";
import { checkArchitecture } from "../../scripts/hfs/architecture.mjs";
import { checkDatabase } from "../../scripts/hfs/rules/database.mjs";
import { parseYaml } from "../../engine/yaml.mjs";
import { filesBelow } from "../../packages/hfs/scaffold/lite-exports.mjs";
import { hfsFromDeclaration } from "../../packages/eslint/be/lib/hfs.mjs";
import { webhookShape, webhookVerifyFirst } from "../../packages/eslint/be/webhooks.mjs";
import { inboxDedupeRequired } from "../../packages/eslint/be/idempotency.mjs";
import { outboxWriteTx } from "../../packages/eslint/be/event-bus.mjs";
import { eventClassContractFindings } from "../../scripts/hfs/rules/event-bus.mjs";

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

/** Runs only the relevant typed rules over the generated app, without the skeleton lint dependency. */
const generatedLint = (root) => {
  const beRoot = path.join(root, "be");
  const hfs = hfsFromDeclaration(JSON.parse(fs.readFileSync(path.join(root, "hfs.json"), "utf8")), beRoot);
  const rules = { "webhook-handoff": webhookShape, "webhook-verify-first": webhookVerifyFirst, "inbox-dedupe-required": inboxDedupeRequired, "outbox-write-tx": outboxWriteTx };
  const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10, experimentalDecorators: true, skipLibCheck: true, baseUrl: beRoot, paths: { "@modules/*": ["src/modules/*"] } };
  const rootNames = filesBelow(beRoot).filter((file) => file.endsWith(".ts") && !file.endsWith(".spec.ts"));
  let originalProgram;
  return (relative, replacement) => {
    const filename = path.join(root, ...relative.split("/"));
    const text = replacement ?? fs.readFileSync(filename, "utf8");
    const host = ts.createCompilerHost(options);
    const readFile = host.readFile;
    host.readFile = (file) => replacement !== undefined && path.resolve(file) === filename ? replacement : readFile(file);
    host.resolveModuleNames = (names, containingFile) => names.map((name) =>
      ts.resolveModuleName(name, containingFile, options, host).resolvedModule
        ?? ts.resolveModuleName(name, path.join(ROOT, "test-source.ts"), options, host).resolvedModule,
    );
    const program = replacement === undefined && originalProgram ? originalProgram : ts.createProgram(rootNames, options, host);
    if (replacement === undefined) originalProgram = program;
    return new Linter({ cwd: beRoot }).verify(text, [{
      files: ["**/*.ts"],
      languageOptions: { parser: tsParser, parserOptions: { programs: [program], tsconfigRootDir: beRoot } },
      settings: { starci: { hfs } },
      plugins: { batch: { rules } },
      rules: Object.fromEntries(Object.keys(rules).map((name) => [`batch/${name}`, "error"])),
    }], { filename });
  };
};

const runtimeTemplate = (relative, dependencies = {}) => {
  const source = fs.readFileSync(path.join(ROOT, "packages/hfs/templates/be/inbox", relative), "utf8")
    .replaceAll("@@provider@@", "calendar").replaceAll("@@Provider@@", "Calendar").replaceAll("@@providerUpper@@", "CALENDAR");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText;
  const runtime = {};
  new Script(compiled).runInNewContext({ exports: runtime, require: (name) => {
    assert.ok(Object.hasOwn(dependencies, name), `known runtime dependency ${name}`);
    return dependencies[name];
  } });
  return runtime;
};

test("lite add webhook records a policy-clean receipt and typed outbox event through a deduplicated intake", async () => {
  const into = fs.mkdtempSync(path.join(os.tmpdir(), "hfs-add-webhook-lite-"));
  made.push(into);
  const tables = new Set(["profiles", "inbox", "event_bus"]);
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
  const eventFolder = path.join(root, "be/src/modules/events/calendar");
  fs.mkdirSync(eventFolder, { recursive: true });
  fs.writeFileSync(path.join(eventFolder, "index.ts"), 'export { CalendarUpdatedEvent } from "./calendar-updated.event"\n');
  fs.writeFileSync(path.join(eventFolder, "calendar-updated.event.ts"), fs.readFileSync(path.join(ROOT, "packages/hfs/templates/be/inbox/delivery-recorded.event.ts.tpl"), "utf8").replaceAll("@@provider@@", "calendar").replaceAll("@@Provider@@", "Calendar").replaceAll("DeliveryRecorded", "Updated").replaceAll("delivery-recorded", "updated"));
  fs.mkdirSync(path.join(root, "be/contracts/calendar"), { recursive: true });
  fs.writeFileSync(path.join(root, "be/contracts/calendar/events.json"), JSON.stringify({ schema: "starci/event-contract@1", service: "calendar", events: { "calendar.updated": { version: 1, payload: { receiptId: "string" } } } }));

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
  assert.doesNotMatch(client, /\.transaction\(/);
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
  assert.match(door, /recordCalendarDelivery\(\{ eventId: deliveryId, delivery \}\)/);
  assert.match(door, /this\.signature\.verify\([^\n]+\)\s+await this\.deliveries\.recordCalendarDelivery/);
  const inbox = fs.readFileSync(path.join(root, "be/src/modules/domain/calendar-inbox/calendar-inbox.service.ts"), "utf8");
  assert.match(inbox, /return this\.entityManager\.transaction/);
  assert.match(inbox, /if \(!\(await this\.inbox\.claim\("webhook\.calendar", request\.eventId, manager\)\)\) return/);
  assert.match(inbox, /this\.eventBus\.publish\(CalendarDeliveryRecordedEvent\.create\(\{ receiptId \}\), manager\)/);
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

  assert.match(migration, /create table public\.event_bus/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, paymentMigration), "utf8"), /create table public\.event_bus/, "handoff storage is shared by both providers");
  const migrationVersions = fs.readdirSync(path.join(root, "supabase/migrations")).filter((file) => file.endsWith(".sql")).map((file) => file.slice(0, 14));
  assert.equal(new Set(migrationVersions).size, migrationVersions.length, "Supabase migration versions remain unique");
  assert.ok(!payment.created.some((file) => file.startsWith("be/src/modules/platform/event-bus/")), "the publisher is installed once");
  const appModule = fs.readFileSync(path.join(root, "be/apps/api/src/app.module.ts"), "utf8");
  for (const symbol of ["InboxModule", "EventBusModule", "CalendarInboxModule", "PaymentInboxModule"]) {
    assert.equal([...appModule.matchAll(new RegExp(`\\b${symbol}\\.register\\(`, "g"))].length, 1, `${symbol} is composed once`);
  }
  const repo = JSON.parse(fs.readFileSync(path.join(root, "hfs.json"), "utf8"));
  assert.ok(repo.sides.be.patterns.includes("event-bus"), "generated event surfaces are enabled in the actual declaration");
  assert.match(fs.readFileSync(path.join(eventFolder, "index.ts"), "utf8"), /CalendarUpdatedEvent/);
  assert.match(fs.readFileSync(path.join(eventFolder, "index.ts"), "utf8"), /CalendarDeliveryRecordedEvent/);
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(root, "be/contracts/calendar/events.json"), "utf8")).events).sort(), ["calendar.delivery-recorded", "calendar.updated"]);
  const eventFiles = [...calendar.created, ...payment.created, "be/src/modules/events/calendar/calendar-updated.event.ts", "be/contracts/calendar/events.json"];
  assert.deepEqual(eventClassContractFindings({ repoRoot: root, files: eventFiles, repo }), []);

  const lint = generatedLint(root);
  for (const file of [...calendar.created, ...payment.created].filter((entry) => entry.endsWith(".service.ts") || entry.endsWith(".webhook.ts"))) {
    assert.deepEqual(lint(file), [], `${file} satisfies typed webhook handoff, inbox dedupe and outbox transaction rules`);
  }
  const inboxFile = "be/src/modules/domain/calendar-inbox/calendar-inbox.service.ts";
  assert.ok(lint(inboxFile, inbox.replace(/            if \(!\(await this\.inbox\.claim[^\n]+\n/, "")).some((finding) => finding.messageId === "noClaim"), "removing the claim is refused by the actual dedupe enforcer");
  assert.ok(lint(inboxFile, inbox.replace(", manager)\n", ", this.entityManager)\n")).some((finding) => finding.messageId === "noTransaction"), "publishing through the shared manager is refused");

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
      "src/modules/platform/inbox",
      "src/modules/platform/event-bus",
      "src/modules/events/calendar",
      "src/modules/events/payment",
    ],
    fast: true,
  });
  assert.deepEqual(problemsOf(report), []);
});

test("the generated intake atomically commits one receipt and typed event, with processing only after commit", async () => {
  class DatabaseError extends Error {
    constructor({ code }) { super(code); this.code = code; }
  }
  const errors = { DatabaseError, DatabaseErrorCode: { WebhookDeliveryIdRequired: "delivery-id-required" } };
  const { recordWebhookDelivery } = runtimeTemplate("database-client.ts.tpl", { "./errors/database.error": errors });
  const decorators = { Injectable: () => (target) => target };
  const { PostgresInbox } = runtimeTemplate("platform/inbox/inbox.service.ts.tpl", {
    "@nestjs/common": decorators,
    "@modules/platform/database": errors,
    "./persistence/inbox.sql": { CLAIM_EVENT: "claim" },
  });
  const { EventBusService } = runtimeTemplate("platform/event-bus/event-bus.service.ts.tpl", {
    "@nestjs/common": decorators,
    "./persistence/event-bus.sql": { INSERT_OUTBOX_EVENT: "outbox" },
  });
  const contracts = runtimeTemplate("platform/event-bus/event-bus.contracts.ts.tpl");
  const events = runtimeTemplate("delivery-recorded.event.ts.tpl", { "@modules/platform/event-bus": contracts });
  const inject = () => () => {};
  const { CalendarInboxService } = runtimeTemplate("service.ts.tpl", {
    "@nestjs/common": decorators,
    "@modules/platform/database": { InjectPrimaryEntityManager: inject, recordWebhookDelivery },
    "@modules/platform/inbox": { InjectInbox: inject },
    "@modules/platform/event-bus": { InjectEventBus: inject },
    "@modules/events/calendar": events,
    "./persistence/calendar-inbox.sql": { INSERT_CALENDAR_INBOX: "receipt" },
  });
  let committed = { claims: new Set(), receipts: new Map(), outbox: new Map() };
  let commits = 0;
  let rollbacks = 0;
  let failAt;
  const effects = [];
  const entityManager = {
    transaction: async (callback) => {
      const staged = { claims: new Set(committed.claims), receipts: new Map(committed.receipts), outbox: new Map(committed.outbox) };
      const manager = { query: async (statement, args) => {
        effects.push(statement);
        assert.equal(committed.outbox.size, commits > 0 ? 1 : 0, "uncommitted events are invisible to a later consumer");
        if (statement === failAt) throw new Error(`${statement} unavailable`);
        if (statement === "claim") {
          const key = args.join(":");
          if (staged.claims.has(key)) return [];
          staged.claims.add(key);
          return [{}];
        }
        if (statement === "receipt") {
          const [provider, deliveryId, payload] = args;
          const key = `${provider}:${deliveryId}`;
          if (staged.receipts.has(key)) return [];
          const id = `receipt-${staged.receipts.size + 1}`;
          staged.receipts.set(key, { id, payload: JSON.parse(payload), processedAt: null });
          return [{ id }];
        }
        assert.equal(statement, "outbox");
        const [id, name, envelope] = args;
        staged.outbox.set(id, { name, envelope: JSON.parse(envelope) });
        return [];
      } };
      try {
        await callback(manager);
        committed = staged;
        commits += 1;
      } catch (error) {
        rollbacks += 1;
        throw error;
      }
    },
  };
  const intake = new CalendarInboxService(entityManager, new PostgresInbox(), new EventBusService());
  const input = { eventId: " delivery-1 ", delivery: { id: "provider-object-42" } };
  for (const point of ["receipt", "outbox"]) {
    failAt = point;
    await assert.rejects(intake.recordCalendarDelivery(input), { message: `${point} unavailable` });
    assert.equal(committed.claims.size, 0);
    assert.equal(committed.receipts.size, 0);
    assert.equal(committed.outbox.size, 0, "failed intake rolls back both the claim and all receipt/event writes");
  }
  failAt = undefined;
  effects.length = 0;
  await intake.recordCalendarDelivery(input);
  await intake.recordCalendarDelivery({ ...input, eventId: "delivery-1" });

  assert.deepEqual(effects, ["claim", "receipt", "outbox", "claim"]);
  assert.deepEqual([...committed.receipts.values()], [{ id: "receipt-1", payload: input.delivery, processedAt: null }]);
  assert.deepEqual([...committed.outbox.values()], [{ name: "calendar.delivery-recorded", envelope: { eventId: "receipt-1", eventName: "calendar.delivery-recorded", payload: { receiptId: "receipt-1" } } }]);
  assert.equal(commits, 2);
  assert.equal(rollbacks, 2);
  for (const eventId of [undefined, "   "]) {
    const before = effects.length;
    await assert.rejects(intake.recordCalendarDelivery({ ...input, eventId }), { code: "delivery-id-required" });
    assert.equal(effects.length, before, "missing delivery ids are refused before any database write");
  }
  const processed = [];
  for (const { envelope } of committed.outbox.values()) {
    const event = events.CalendarDeliveryRecordedEvent.parse(envelope);
    assert.equal(event.eventId, "receipt-1");
    processed.push(event.payload.receiptId);
  }
  assert.deepEqual(processed, ["receipt-1"], "a later consumer processes the committed receipt reference");
});
