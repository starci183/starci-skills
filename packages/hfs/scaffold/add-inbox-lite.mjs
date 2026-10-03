import fs from "node:fs";
import path from "node:path";
import { render, TEMPLATES_DIR } from "../sync/index.mjs";
import { ScaffoldError, pascalOf } from "./service.mjs";

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

/** Lite replaces only the webhook door; the full-edition pattern remains byte-identical. */
export const selectLiteWebhookEntries = (entries) =>
  entries.map((entry) =>
    entry.template === "webhooks/webhook.door.ts.tpl"
      ? { ...entry, template: "../inbox/webhook-door.ts.tpl" }
      : entry,
  );

const filesBelow = (root) => {
  const files = [];
  const visit = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const target = path.join(folder, entry.name);
      if (entry.isDirectory()) visit(target);
      else files.push(target);
    }
  };
  if (fs.existsSync(root)) visit(root);
  return files;
};

const matchingBrace = (text, open) => {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    else if (text[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
};

const addEntityManagerImport = (text) => {
  if (/import type \{[^}]*\bEntityManager\b[^}]*\} from "typeorm"/.test(text))
    return text;
  return `import type { EntityManager } from "typeorm"\n${text}`;
};

/** Gives the selected domain intake the transaction manager while preserving its existing processing body. */
function adaptedDomainService({ root, service, serviceModule, provider, Provider }) {
  const prefix = "@modules/domain/";
  if (!serviceModule.startsWith(prefix))
    throw new ScaffoldError(
      "HFS_ADD_INBOX_SERVICE",
      `lite add webhook needs a domain service module below ${prefix}`,
    );
  const owner = path.join(
    root,
    "be",
    "src",
    "modules",
    "domain",
    ...serviceModule.slice(prefix.length).split("/"),
  );
  const candidates = filesBelow(owner).filter(
    (file) =>
      file.endsWith(".service.ts") &&
      new RegExp(`\\bexport\\s+class\\s+${service}\\b`).test(
        fs.readFileSync(file, "utf8"),
      ),
  );
  if (candidates.length !== 1)
    throw new ScaffoldError(
      "HFS_ADD_INBOX_SERVICE",
      `${serviceModule} must export exactly one ${service} class from a .service.ts file before adding the ${provider} webhook`,
    );
  const file = candidates[0];
  let text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const method = `accept${Provider}Delivery`;
  const methodAt = text.search(new RegExp(`\\b${method}\\s*\\(`));
  if (methodAt < 0)
    throw new ScaffoldError(
      "HFS_ADD_INBOX_INTAKE",
      `${service} must declare ${method}(delivery) before adding the ${provider} webhook`,
    );
  const paramsOpen = text.indexOf("(", methodAt);
  const paramsClose = text.indexOf(")", paramsOpen);
  const bodyOpen = text.indexOf("{", paramsClose);
  const bodyClose = matchingBrace(text, bodyOpen);
  if (paramsClose < 0 || bodyOpen < 0 || bodyClose < 0)
    throw new ScaffoldError(
      "HFS_ADD_INBOX_INTAKE",
      `${service}.${method} is not a readable method declaration`,
    );
  const parameters = text.slice(paramsOpen + 1, paramsClose).trim();
  if (/(?:^|,)\s*(?:manager|entityManager)\s*:/.test(parameters)) return { file, text };
  const manager =
    /private\s+readonly\s+([A-Za-z][A-Za-z0-9]*)\s*:\s*EntityManager/.exec(
      text,
    )?.[1];
  if (!manager)
    throw new ScaffoldError(
      "HFS_ADD_INBOX_INTAKE",
      `${service}.${method} needs an injected EntityManager so the inbox can keep its processing in one transaction`,
    );
  const body = text
    .slice(bodyOpen + 1, bodyClose)
    .replaceAll(`this.${manager}`, "entityManager");
  text = `${text.slice(0, paramsOpen + 1)}${parameters}, entityManager: EntityManager = this.${manager}${text.slice(paramsClose, bodyOpen + 1)}${body}${text.slice(bodyClose)}`;
  return { file, text: addEntityManagerImport(text) };
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
  if (!index.includes('export { acceptWebhookDelivery } from "./webhook-inbox.client"'))
    index = `${index.replace(/\n+$/, "")}\nexport { acceptWebhookDelivery } from "./webhook-inbox.client"\n`;
  let error = fs.readFileSync(errorFile, "utf8").replace(/\r\n/g, "\n");
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

const wiredAppModule = ({ root, repo, provider, Provider }) => {
  const app = repo.sides.be.apps.find((entry) => entry.kind === "api");
  if (!app)
    throw new ScaffoldError(
      "HFS_ADD_NO_API_OWNER",
      "add webhook needs a declared lite api app",
    );
  const file = path.join(root, "be", "apps", app.name, "src", "app.module.ts");
  const relative = `be/apps/${app.name}/src/app.module.ts`;
  if (!fs.existsSync(file))
    throw new ScaffoldError(
      "HFS_ADD_WIRE_MISSING",
      `add webhook registers its inbox in ${relative}, which does not exist`,
    );
  const symbol = `${Provider}InboxModule`;
  const importLine = `import { ${symbol} } from "@modules/domain/${provider}-inbox"`;
  const lines = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");
  const lastImport = lines.reduce(
    (last, line, index) => (line.startsWith("import ") ? index : last),
    -1,
  );
  const imports = lines.findIndex((line) => /^\s*imports: \[$/.test(line));
  if (lastImport < 0 || imports < 0)
    throw new ScaffoldError(
      "HFS_ADD_WIRE_INVALID",
      `add webhook could not find the imports array in ${relative}`,
    );
  if (!lines.includes(importLine)) {
    lines.splice(lastImport + 1, 0, importLine);
    const shiftedImports = imports > lastImport ? imports + 1 : imports;
    const indent = /^(\s*)/.exec(lines[shiftedImports])?.[1] ?? "";
    lines.splice(
      shiftedImports + 1,
      0,
      `${indent}    ${symbol}.register({ isGlobal: true }),`,
    );
  }
  return { file, text: `${lines.join("\n").replace(/\n+$/, "")}\n` };
};

/** Writes the lite provider inbox and adapts the selected domain intake to share its transaction. */
export function addLiteWebhookInbox({
  root,
  repo,
  noun,
  provider,
  values,
  now = Date.now,
}) {
  if (repo.edition !== "lite" || noun !== "webhook") return [];
  const Provider = pascalOf(provider);
  const table = `${snakeOf(provider)}_inbox`;
  const migrationsDir = path.join(root, "supabase", "migrations");
  const migrations = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter((file) => MIGRATION.test(file)).sort()
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
      relative: `${base}/persistence/${provider}-inbox.sql.ts`,
      text: template("sql.ts.tpl", renderValues),
    },
  ];
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
    planned.push({
      relative: "be/src/modules/platform/database/webhook-inbox.client.ts",
      text: template("database-client.ts.tpl", renderValues),
    });
  const clashes = planned
    .filter((entry) => fs.existsSync(path.join(root, ...entry.relative.split("/"))))
    .map((entry) => entry.relative);
  if (clashes.length)
    throw new ScaffoldError(
      "HFS_ADD_EXISTS",
      `webhook ${provider} inbox already exists: ${clashes.join(", ")}`,
    );
  const servicePatch = adaptedDomainService({
    root,
    service: values.service,
    serviceModule: values.serviceModule,
    provider,
    Provider,
  });
  const patches = [
    servicePatch,
    ...databasePatches(root),
    wiredAppModule({ root, repo, provider, Provider }),
  ];
  for (const entry of planned) {
    const target = path.join(root, ...entry.relative.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entry.text);
  }
  for (const patch of patches) fs.writeFileSync(patch.file, patch.text);
  return planned.map((entry) => entry.relative);
}
