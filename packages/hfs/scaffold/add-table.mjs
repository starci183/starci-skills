import fs from "node:fs";
import path from "node:path";
import { emitDbTypes, dbTypesPath } from "../emit/db-types.mjs";
import {
  loadSlotManifest,
  readRepoDeclaration,
} from "../runtime/scripts/hfs/slots.mjs";
import { render, TEMPLATES_DIR } from "../sync/index.mjs";
import { ScaffoldError, pascalOf } from "./service.mjs";
import { registerLiteExports } from "./lite-exports.mjs";

const NAME = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/;
const MIGRATION = /^(\d{14})_[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.sql$/;
const POSTGRES_RESERVED = new Set([
  "all",
  "analyse",
  "analyze",
  "and",
  "any",
  "array",
  "as",
  "asc",
  "asymmetric",
  "authorization",
  "binary",
  "both",
  "case",
  "cast",
  "check",
  "collate",
  "collation",
  "column",
  "concurrently",
  "constraint",
  "create",
  "cross",
  "current_catalog",
  "current_date",
  "current_role",
  "current_schema",
  "current_time",
  "current_timestamp",
  "current_user",
  "default",
  "deferrable",
  "desc",
  "distinct",
  "do",
  "else",
  "end",
  "except",
  "false",
  "fetch",
  "for",
  "foreign",
  "freeze",
  "from",
  "full",
  "grant",
  "group",
  "having",
  "ilike",
  "in",
  "initially",
  "inner",
  "intersect",
  "into",
  "is",
  "isnull",
  "join",
  "lateral",
  "leading",
  "left",
  "like",
  "limit",
  "localtime",
  "localtimestamp",
  "natural",
  "not",
  "notnull",
  "null",
  "nulls",
  "offset",
  "on",
  "only",
  "or",
  "order",
  "outer",
  "overlaps",
  "placing",
  "primary",
  "references",
  "returning",
  "right",
  "select",
  "session_user",
  "similar",
  "some",
  "symmetric",
  "system_user",
  "table",
  "tablesample",
  "then",
  "to",
  "trailing",
  "true",
  "union",
  "unique",
  "user",
  "using",
  "variadic",
  "verbose",
  "when",
  "where",
  "window",
  "with",
]);

const timestampOf = (now) =>
  new Date(now()).toISOString().replace(/\D/g, "").slice(0, 14);
const snakeOf = (name) => name.replaceAll("-", "_");
const featureOf = (name) => name.replaceAll("_", "-");
const sqlIdentifierOf = (name) =>
  POSTGRES_RESERVED.has(name) ? `"${name}"` : name;
const singularOf = (name) => (name.endsWith("s") ? name.slice(0, -1) : name);
const camelOf = (name) => {
  const pascal = pascalOf(name);
  return pascal[0].toLowerCase() + pascal.slice(1);
};

function template(relative, values) {
  const file = path.join(TEMPLATES_DIR, ...relative.split("/"));
  if (!fs.existsSync(file))
    throw new ScaffoldError(
      "HFS_ADD_TEMPLATE_MISSING",
      `table template ${relative} is not carried by this package`,
    );
  return fs
    .readFileSync(file, "utf8")
    .replace(/\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g, (whole, key) => {
      if (values[key] === undefined)
        throw new ScaffoldError(
          "HFS_ADD_PLACEHOLDER_UNKNOWN",
          `table template ${relative} uses ${whole}, which add table does not provide`,
        );
      return values[key];
    });
}

function removeEmptyParents(file, stop) {
  for (
    let at = path.dirname(file);
    at.startsWith(stop) && at !== stop;
    at = path.dirname(at)
  ) {
    if (!fs.existsSync(at) || fs.readdirSync(at).length !== 0) break;
    fs.rmdirSync(at);
  }
}

function wireApiModule(root, app, name) {
  const relative = `be/apps/${app}/src/app.module.ts`;
  const file = path.join(root, ...relative.split("/"));
  if (!fs.existsSync(file))
    throw new ScaffoldError("HFS_ADD_WIRE_MISSING", `add table registers ${name} in ${relative}, which does not exist`);
  const symbol = `${pascalOf(name)}Module`;
  const errorKinds = `${snakeOf(name).toUpperCase()}_ERROR_KINDS`;
  const importLine = `import { ${errorKinds}, ${symbol} } from "@modules/domain/${name}"`;
  const lines = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");
  const lastImport = lines.reduce((last, line, index) => (line.startsWith("import ") ? index : last), -1);
  const imports = lines.findIndex((line) => /^\s*imports: \[$/.test(line));
  const kinds = lines.findIndex((line) => /^\s*kinds: \[$/.test(line));
  if (lastImport < 0 || imports < 0 || kinds < 0)
    throw new ScaffoldError("HFS_ADD_WIRE_INVALID", `add table could not find the imports and error kinds arrays in ${relative}`);
  if (!lines.includes(importLine)) {
    lines.splice(lastImport + 1, 0, importLine);
    const shiftedImports = lines.findIndex((line) => /^\s*imports: \[$/.test(line));
    const indent = /^(\s*)/.exec(lines[shiftedImports])?.[1] ?? "";
    lines.splice(shiftedImports + 1, 0, `${indent}    ${symbol}.register({ isGlobal: true }),`);
    const shiftedKinds = lines.findIndex((line) => /^\s*kinds: \[$/.test(line));
    const kindsIndent = /^(\s*)/.exec(lines[shiftedKinds])?.[1] ?? "";
    lines.splice(shiftedKinds + 1, 0, `${kindsIndent}    ${errorKinds},`);
  }
  fs.writeFileSync(file, `${lines.join("\n").replace(/\n+$/, "")}\n`);
}

/**
 * Adds one Supabase table migration and, with `fe`, one typed reader/writer pair to every declared Next app.
 * `emitTypes` returns the generated database.types.ts text; false is the explicit `--no-types` seam.
 */
export function addTable({
  root,
  name,
  fe = false,
  emitTypes = emitDbTypes,
  now = Date.now,
}) {
  const requestedName = String(name);
  if (!NAME.test(requestedName))
    throw new ScaffoldError(
      "HFS_ADD_NAME_INVALID",
      `table name ${name} must use lowercase letters, digits and single dash or underscore separators`,
    );
  const feature = featureOf(requestedName);
  const table = snakeOf(requestedName);
  const manifest = loadSlotManifest();
  const repo = readRepoDeclaration(manifest, root);
  const connection = repo.sides?.be?.connections?.find((candidate) => candidate.provider === "supabase");
  if (!connection) {
    throw new ScaffoldError(
      "HFS_ADD_TABLE_PROVIDER",
      "add table needs a back-end connection whose provider is supabase",
    );
  }

  const migrationsDir = path.join(root, "supabase", "migrations");
  const migrations = fs.existsSync(migrationsDir)
    ? fs
        .readdirSync(migrationsDir)
        .filter((file) => MIGRATION.test(file))
        .sort()
    : [];
  if (migrations.some((file) => file.endsWith(`_${feature}.sql`)))
    throw new ScaffoldError(
      "HFS_ADD_EXISTS",
      `table ${requestedName} already has a migration`,
    );
  const stamp = timestampOf(now);
  const latest = migrations.at(-1)?.slice(0, 14);
  if (latest && stamp <= latest)
    throw new ScaffoldError(
      "HFS_ADD_MIGRATION_ORDER",
      `the current UTC timestamp ${stamp} is not later than the latest migration ${latest}; fix the clock or wait for the next second`,
    );

  const values = {
    name: feature,
    table,
    tableSql: sqlIdentifierOf(table),
    Name: pascalOf(feature),
    nameCamel: camelOf(feature),
    upper: table.toUpperCase(),
    singular: singularOf(feature),
    Singular: pascalOf(singularOf(feature)),
  };
  const planned = [
    {
      relative: `supabase/migrations/${stamp}_${feature}.sql`,
      body: template("be/table/migration.sql.tpl", values),
    },
    { relative: `be/src/modules/domain/${feature}/index.ts`, body: template("be/table/index.ts.tpl", values) },
    { relative: `be/src/modules/domain/${feature}/errors/${feature}.error.ts`, body: template("be/table/error.ts.tpl", values) },
    { relative: `be/src/modules/domain/${feature}/${feature}.module.ts`, body: template("be/table/module.ts.tpl", values) },
    { relative: `be/src/modules/domain/${feature}/${feature}.module-definition.ts`, body: template("be/table/module-definition.ts.tpl", values) },
    { relative: `be/src/modules/domain/${feature}/${feature}.options.ts`, body: template("be/table/options.ts.tpl", values) },
    { relative: `be/src/modules/domain/${feature}/${feature}.service.ts`, body: template("be/table/service.ts.tpl", values) },
    { relative: `be/src/modules/domain/${feature}/persistence/${feature}.rows.ts`, body: template("be/table/rows.ts.tpl", values) },
    { relative: `be/src/modules/domain/${feature}/persistence/${feature}.sql.ts`, body: template("be/table/sql.ts.tpl", values) },
  ];
  const databaseSql = "be/src/modules/platform/database/database.sql.ts";
  if (repo.edition === "lite" && !fs.existsSync(path.join(root, ...databaseSql.split("/")))) {
    planned.splice(1, 0, {
      relative: databaseSql,
      body: render(fs.readFileSync(path.join(TEMPLATES_DIR, "be", "skeleton-lite", "src", "modules", "platform", "database", "database.sql.ts"), "utf8"), {}),
    });
  }
  if (fe) {
    const apps =
      repo.sides?.fe?.apps?.filter((app) => app.kind === "next") ?? [];
    if (!apps.length)
      throw new ScaffoldError(
        "HFS_ADD_NO_FRONT_END",
        "add table --fe needs at least one declared Next app",
      );
    for (const app of apps) {
      const base = `fe/apps/${app.name}/src/modules/db/${feature}`;
      planned.push(
        {
          relative: `${base}/read-${feature}.ts`,
          body: template("fe/table/read.ts.tpl", values),
        },
        {
          relative: `${base}/write-${feature}.ts`,
          body: template("fe/table/write.ts.tpl", values),
        },
      );
    }
  }

  const clash = planned
    .filter((file) =>
      fs.existsSync(path.join(root, ...file.relative.split("/"))),
    )
    .map((file) => file.relative);
  if (clash.length)
    throw new ScaffoldError(
      "HFS_ADD_EXISTS",
      `table ${requestedName} already exists: ${clash.join(", ")}`,
    );
  const owner = repo.sides.be.apps.find((app) => app.name === connection.owner && app.kind === "api");
  if (!owner)
    throw new ScaffoldError("HFS_ADD_NO_API_OWNER", `add table needs the Supabase connection owner ${connection.owner} to be a declared api app`);
  const ownerFile = path.join(root, "be", "apps", owner.name, "src", "app.module.ts");
  if (!fs.existsSync(ownerFile))
    throw new ScaffoldError("HFS_ADD_WIRE_MISSING", `add table registers ${name} in be/apps/${owner.name}/src/app.module.ts, which does not exist`);
  const ownerBefore = fs.readFileSync(ownerFile, "utf8");
  const databaseIndex = path.join(root, "be", "src", "modules", "platform", "database", "index.ts");
  const databaseIndexBefore = repo.edition === "lite" && fs.existsSync(databaseIndex) ? fs.readFileSync(databaseIndex) : null;
  const typesFile = path.join(root, ...dbTypesPath.split("/"));
  const typesBefore = fs.existsSync(typesFile) ? fs.readFileSync(typesFile) : null;
  const created = [];
  try {
    for (const file of planned) {
      const target = path.join(root, ...file.relative.split("/"));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.body);
      created.push(target);
    }
    if (emitTypes !== false) {
      const generated = emitTypes({ root });
      if (typeof generated === "string") {
        const target = path.join(root, ...dbTypesPath.split("/"));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, generated);
      }
    }
    wireApiModule(root, owner.name, feature);
    if (repo.edition === "lite") registerLiteExports({ root, generator: "table" });
  } catch (error) {
    fs.writeFileSync(ownerFile, ownerBefore);
    if (databaseIndexBefore !== null) fs.writeFileSync(databaseIndex, databaseIndexBefore);
    if (typesBefore === null) fs.rmSync(typesFile, { force: true });
    else fs.writeFileSync(typesFile, typesBefore);
    for (const file of [...created].reverse()) {
      if (fs.existsSync(file)) fs.rmSync(file);
      removeEmptyParents(file, root);
    }
    throw error;
  }
  return {
    created: planned.map((file) => file.relative),
    types: emitTypes === false ? "skipped" : dbTypesPath,
  };
}
