import fs from "node:fs";
import path from "node:path";
import { render, TEMPLATES_DIR } from "../sync/index.mjs";
import { ScaffoldError, pascalOf } from "./service.mjs";
import { filesBelow } from "./lite-exports.mjs";
import { jsonText } from "./app.mjs";
import { byCodeUnit } from "../report/order.mjs";
import { withSqlIdentifierError } from "./add-database-lite.mjs";

const MIGRATION = /^(\d{14})_[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.sql$/;
const PLACEHOLDER = /@@([A-Za-z][A-Za-z0-9]*)@@/g;

const timestampOf = (now) =>
  new Date(now()).toISOString().replace(/\D/g, "").slice(0, 14);
const upperOf = (name) => name.replaceAll("-", "_").toUpperCase();
const snakeOf = (name) => name.replaceAll("-", "_");

const template = (relative, values) => {
  const file = path.join(TEMPLATES_DIR, "be", "inbox", relative);
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  return text.replace(PLACEHOLDER, (whole, name) => {
    if (values[name] === undefined)
      throw new ScaffoldError(
        "HFS_ADD_PLACEHOLDER_UNKNOWN",
        `template be/inbox/${relative} uses ${whole}, which the lite webhook does not provide`,
      );
    return values[name];
  });
};

/** The lite templates of the webhook door and its unit spec: the door records the delivery in the provider inbox. */
const LITE_WEBHOOK_TEMPLATES = Object.freeze({
  "webhooks/webhook.door.ts.tpl": "../inbox/webhook-door.ts.tpl",
  "webhooks/webhook.door.spec.ts.tpl": "../inbox/webhook-door.spec.ts.tpl",
});

/** Lite replaces only the webhook door and its spec with the durable provider inbox intake. */
export const selectLiteWebhookEntries = (entries) =>
  entries.map((entry) =>
    LITE_WEBHOOK_TEMPLATES[entry.template] === undefined
      ? entry
      : { ...entry, template: LITE_WEBHOOK_TEMPLATES[entry.template] },
  );

/** Validates the selected processing owner for a later reactor/job without invoking or changing that service in the door. */
function validateProcessingOwner({ root, service, serviceModule, provider }) {
  const prefix = "@modules/domain/";
  const capability = serviceModule.slice(prefix.length);
  if (!serviceModule.startsWith(prefix) || !/^[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*$/.test(capability))
    throw new ScaffoldError(
      "HFS_ADD_INBOX_SERVICE",
      `lite add webhook needs a processing service module below ${prefix}`,
    );
  const owner = path.join(root, "be", "src", "modules", "domain", ...capability.split("/"));
  const candidates = filesBelow(owner).filter((file) =>
    file.endsWith(".service.ts") && new RegExp(String.raw`\bexport\s+class\s+${service}\b`).test(fs.readFileSync(file, "utf8")),
  );
  if (candidates.length !== 1)
    throw new ScaffoldError(
      "HFS_ADD_INBOX_INTAKE",
      `${serviceModule} must export exactly one ${service} from a .service.ts file as the processing owner of the ${provider} inbox`,
    );
}

const databasePatches = (root) => {
  const folder = path.join(root, "be", "src", "modules", "platform", "database");
  const indexFile = path.join(folder, "index.ts");
  const errorFile = path.join(folder, "errors", "database.error.ts");
  if (!fs.existsSync(indexFile) || !fs.existsSync(errorFile))
    throw new ScaffoldError(
      "HFS_ADD_INBOX_DATABASE",
      "lite add webhook needs the scaffolded platform/database capability",
    );
  let index = fs.readFileSync(indexFile, "utf8").replace(/\r\n/g, "\n");
  if (!index.includes('export { recordWebhookDelivery } from "./webhook-inbox.client"'))
    index = `${index.trimEnd()}\nexport { recordWebhookDelivery } from "./webhook-inbox.client"\n`;
  if (!index.split("\n").some((line) => line.startsWith("export { ") && line.includes("DatabaseErrorCode") && line.endsWith(' } from "./errors/database.error"')))
    index = `${index.trimEnd()}\nexport { DatabaseError, DatabaseErrorCode } from "./errors/database.error"\n`;
  let error = withSqlIdentifierError(fs.readFileSync(errorFile, "utf8").replace(/\r\n/g, "\n"));
  const enumLine =
    '    WebhookDeliveryIdRequired = "DATABASE_WEBHOOK_DELIVERY_ID_REQUIRED",';
  if (!error.includes(enumLine)) {
    const after =
      '    IdentifierRejected = "DATABASE_IDENTIFIER_REJECTED",';
    const mapping =
      '    [DatabaseErrorCode.IdentifierRejected]: "internal",';
    if (!error.includes(after) || !error.includes(mapping))
      throw new ScaffoldError(
        "HFS_ADD_INBOX_DATABASE",
        "platform/database has an unknown error-family shape",
      );
    error = error
      .replace(after, `${after}\n    /** A signed delivery omitted the provider's non-empty idempotency key. */\n${enumLine}`)
      .replace(
        mapping,
        `${mapping}\n    [DatabaseErrorCode.WebhookDeliveryIdRequired]: "invalid",`,
      );
  }
  return [
    { file: indexFile, text: index },
    { file: errorFile, text: error },
  ];
};

/** The first webhook installs only the lite inbox claim and transactional event publisher, shared by all providers. */
const handoffPlatformFiles = (root, values) => {
  const planned = [];
  for (const capability of ["inbox", "event-bus"]) {
    const base = `be/src/modules/platform/${capability}`;
    if (fs.existsSync(path.join(root, base, "index.ts"))) continue;
    const folder = path.join(TEMPLATES_DIR, "be", "inbox", "platform", capability);
    for (const file of filesBelow(folder)) {
      const relative = path.relative(folder, file).replaceAll("\\", "/");
      planned.push({
        relative: `${base}/${relative.replace(/\.tpl$/, "")}`,
        text: template(`platform/${capability}/${relative}`, values),
      });
    }
  }
  return planned;
};

/** A provider may already publish other events; retain its barrel and contract when adding the receipt event. */
const eventFiles = (root, provider, values) => {
  const entries = [
    { relative: `be/src/modules/events/${provider}/index.ts`, text: template("event-index.ts.tpl", values) },
    { relative: `be/contracts/${provider}/events.json`, text: template("events.json.tpl", values) },
  ];
  const planned = [];
  const patches = [];
  for (const entry of entries) {
    const file = path.join(root, ...entry.relative.split("/"));
    if (!fs.existsSync(file)) {
      planned.push(entry);
      continue;
    }
    const previous = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    if (entry.relative.endsWith("index.ts")) {
      patches.push({ file, text: previous.includes(entry.text.trim()) ? previous : `${previous.trimEnd()}\n${entry.text}` });
    } else {
      const contract = JSON.parse(previous);
      if (contract.schema !== "starci/event-contract@1" || contract.service !== provider || !contract.events || Array.isArray(contract.events) || typeof contract.events !== "object")
        throw new ScaffoldError("HFS_ADD_EVENT_CONTRACT", `${entry.relative} is not the event contract of ${provider}`);
      const additions = JSON.parse(entry.text).events;
      contract.events = { ...contract.events, ...additions };
      patches.push({ file, text: jsonText(contract) });
    }
  }
  return { planned, patches };
};

const eventPatternPatch = (root) => {
  const file = path.join(root, "hfs.json");
  const declaration = JSON.parse(fs.readFileSync(file, "utf8"));
  declaration.sides.be.patterns = [...new Set([...(declaration.sides.be.patterns ?? []), "event-bus"])].sort(byCodeUnit);
  return { file, text: jsonText(declaration) };
};

/** Writes the lite provider inbox. Processing belongs to a separately added reactor or job, after the record commits. */
export function addLiteWebhookInbox({
  root,
  repo,
  noun,
  provider,
  values,
  now = Date.now,
}) {
  if (repo.edition !== "lite" || noun !== "webhook") return [];
  validateProcessingOwner({ root, ...values, provider });
  const Provider = pascalOf(provider);
  const table = `${snakeOf(provider)}_inbox`;
  const migrationsDir = path.join(root, "supabase", "migrations");
  const migrations = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter((file) => MIGRATION.test(file)).sort(byCodeUnit)
    : [];
  const suffix = `${provider}-inbox.sql`;
  if (migrations.some((file) => file.endsWith(`_${suffix}`)))
    throw new ScaffoldError(
      "HFS_ADD_EXISTS",
      `webhook ${provider} already has an inbox migration`,
    );
  const stamp = timestampOf(now);
  const latest = migrations.at(-1)?.slice(0, 14);
  if (latest && stamp <= latest)
    throw new ScaffoldError(
      "HFS_ADD_MIGRATION_ORDER",
      `the current UTC timestamp ${stamp} is not later than the latest migration ${latest}; fix the clock or wait for the next second`,
    );
  const renderValues = {
    ...values,
    provider,
    Provider,
    providerUpper: upperOf(provider),
    table,
  };
  const base = `be/src/modules/domain/${provider}-inbox`;
  const events = eventFiles(root, provider, renderValues);
  const planned = [
    {
      relative: `supabase/migrations/${stamp}_${suffix}`,
      text: template("migration.sql.tpl", renderValues),
    },
    { relative: `${base}/index.ts`, text: template("index.ts.tpl", renderValues) },
    {
      relative: `${base}/${provider}-inbox.module-definition.ts`,
      text: template("module-definition.ts.tpl", renderValues),
    },
    {
      relative: `${base}/${provider}-inbox.options.ts`,
      text: template("options.ts.tpl", renderValues),
    },
    {
      relative: `${base}/${provider}-inbox.module.ts`,
      text: template("module.ts.tpl", renderValues),
    },
    {
      relative: `${base}/${provider}-inbox.service.ts`,
      text: template("service.ts.tpl", renderValues),
    },
    {
      relative: `${base}/${provider}-inbox.service.spec.ts`,
      text: template("service.spec.ts.tpl", renderValues),
    },
    {
      relative: `${base}/persistence/${provider}-inbox.sql.ts`,
      text: template("sql.ts.tpl", renderValues),
    },
    {
      relative: `be/src/modules/events/${provider}/${provider}-delivery-recorded.event.ts`,
      text: template("delivery-recorded.event.ts.tpl", renderValues),
    },
    ...events.planned,
    ...handoffPlatformFiles(root, renderValues),
  ];
  const hasHandoffStorage = migrations.some((file) =>
    /create\s+table\s+public\.event_bus\b/i.test(fs.readFileSync(path.join(migrationsDir, file), "utf8")),
  );
  if (!hasHandoffStorage)
    planned[0].text = `${template("platform/migration.sql.tpl", renderValues)}\n${planned[0].text}`;
  const databaseSql = "be/src/modules/platform/database/database.sql.ts";
  if (!fs.existsSync(path.join(root, ...databaseSql.split("/")))) {
    planned.push({
      relative: databaseSql,
      text: render(
        fs.readFileSync(
          path.join(TEMPLATES_DIR, "be", "skeleton-lite", "src", "modules", "platform", "database", "database.sql.ts"),
          "utf8",
        ),
        {},
      ),
    });
  }
  const databaseClient = path.join(
    root,
    "be",
    "src",
    "modules",
    "platform",
    "database",
    "webhook-inbox.client.ts",
  );
  if (!fs.existsSync(databaseClient))
    planned.push(
      {
        relative: "be/src/modules/platform/database/webhook-inbox.client.ts",
        text: template("database-client.ts.tpl", renderValues),
      },
      {
        relative: "be/src/modules/platform/database/webhook-inbox.client.spec.ts",
        text: template("database-client.spec.ts.tpl", renderValues),
      },
    );
  const clashes = planned
    .filter((entry) => fs.existsSync(path.join(root, ...entry.relative.split("/"))))
    .map((entry) => entry.relative);
  if (clashes.length)
    throw new ScaffoldError(
      "HFS_ADD_EXISTS",
      `webhook ${provider} inbox already exists: ${clashes.join(", ")}`,
    );
  const patches = [
    ...databasePatches(root),
    ...events.patches,
    eventPatternPatch(root),
  ];
  for (const entry of planned) {
    const target = path.join(root, ...entry.relative.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entry.text);
  }
  for (const patch of patches) fs.writeFileSync(patch.file, patch.text);
  return planned.map((entry) => entry.relative);
}
