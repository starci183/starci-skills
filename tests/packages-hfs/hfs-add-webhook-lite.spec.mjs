import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
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

const addDeliveryIntake = (root, capability) => {
  const service = path.join(
    root,
    "be",
    "src",
    "modules",
    "domain",
    capability,
    `${capability}.service.ts`,
  );
  const text = fs.readFileSync(service, "utf8").replace(/\r\n/g, "\n");
  const Capability = capability[0].toUpperCase() + capability.slice(1);
  const method = `\ninterface ${Capability.slice(0, -1)}Delivery { readonly id: string }\n`;
  const classAt = text.indexOf("@Injectable()");
  const withContract = `${text.slice(0, classAt)}${method}\n${text.slice(classAt)}`;
  const classClose = withContract.lastIndexOf("}");
  const intake = `
    /** Provider-specific processing; add webhook supplies the transaction manager that also owns the inbox claim. */
    async accept${Capability.slice(0, -1)}Delivery(delivery: ${Capability.slice(0, -1)}Delivery): Promise<void> {
        await this.entityManager.query(FIND_${capability.toUpperCase()}, [delivery.id, delivery.id])
    }
`;
  fs.writeFileSync(service, `${withContract.slice(0, classClose)}${intake}${withContract.slice(classClose)}`);
};

test("lite add webhook writes a policy-clean inbox and an atomic, architecture-clean intake", async () => {
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
  addDeliveryIntake(root, "calendars");
  addDeliveryIntake(root, "payments");

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
  assert.match(client, /if \(identity === undefined\) return/);
  assert.match(client, /DatabaseErrorCode\.WebhookDeliveryIdRequired/);
  const door = fs.readFileSync(
    path.join(
      root,
      "be/src/features/webhooks/calendar/transport/http/calendar.webhook.ts",
    ),
    "utf8",
  );
  assert.match(door, /@Headers\("x-calendar-delivery-id"\) deliveryId/);
  assert.match(door, /acceptCalendarDelivery\(deliveryId, delivery\)/);
  const service = fs.readFileSync(
    path.join(root, "be/src/modules/domain/calendars/calendars.service.ts"),
    "utf8",
  );
  assert.match(service, /entityManager: EntityManager = this\.entityManager/);
  assert.match(service, /entityManager\.query/);
  assert.match(
    fs.readFileSync(path.join(root, "be/src/modules/domain/calendars/index.ts"), "utf8"),
    /CalendarsService/,
  );
  assert.match(
    fs.readFileSync(path.join(root, "be/src/modules/domain/payments/index.ts"), "utf8"),
    /PaymentsService/,
  );
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
