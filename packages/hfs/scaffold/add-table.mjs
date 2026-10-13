import fs from "node:fs";
import path from "node:path";
import { emitDbTypes, dbTypesPath } from "../emit/db-types.mjs";
import {
  loadSlotManifest,
  readRepoDeclaration,
} from "../runtime/scripts/hfs/slots.mjs";
import { render, TEMPLATES_DIR } from "../sync/index.mjs";
import { ScaffoldError, pascalOf } from "./service.mjs";
import { registerLiteDomainService, registerLiteExports, registrationFiles } from "./lite-exports.mjs";
import { coreFeApps } from "./app.mjs";

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

/** The app-root relative path of a file under the app (posix). */
const at = (root, relative) => path.join(root, ...relative.split("/"));

/**
 * Registers `entry` in the `imports` array of a Nest module file (one import line after the last import, one array entry right
 * after `imports: [`), unless `symbol` is already imported. Returns the new text.
 */
function wireImport(text, relative, { importLine, symbol, entry, kinds }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  if (lines.some((line) => line.startsWith("import ") && new RegExp(`\\b${symbol}\\b`).test(line))) return text;
  const lastImport = lines.reduce((last, line, index) => (line.startsWith("import ") ? index : last), -1);
  if (lastImport < 0 || lines.findIndex((line) => /^\s*imports: \[$/.test(line)) < 0)
    throw new ScaffoldError("HFS_ADD_WIRE_INVALID", `add table could not find the imports array in ${relative}`);
  lines.splice(lastImport + 1, 0, importLine);
  const imports = lines.findIndex((line) => /^\s*imports: \[$/.test(line));
  const indent = /^(\s*)/.exec(lines[imports])?.[1] ?? "";
  lines.splice(imports + 1, 0, `${indent}    ${entry},`);
  if (kinds !== undefined) {
    const kindsAt = lines.findIndex((line) => /^\s*kinds: \[$/.test(line));
    if (kindsAt < 0) throw new ScaffoldError("HFS_ADD_WIRE_INVALID", `add table could not find the error kinds array in ${relative}`);
    const kindsIndent = /^(\s*)/.exec(lines[kindsAt])?.[1] ?? "";
    lines.splice(kindsAt + 1, 0, `${kindsIndent}    ${kinds},`);
  }
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

/** The api app root after the table's domain module is registered (its module and error kinds). */
const wireDomainModule = (text, relative, name) =>
  wireImport(text, relative, {
    importLine: `import { ${snakeOf(name).toUpperCase()}_ERROR_KINDS, ${pascalOf(name)}Module } from "@modules/domain/${name}"`,
    symbol: `${pascalOf(name)}Module`,
    entry: `${pascalOf(name)}Module.register({ isGlobal: true })`,
    kinds: `${snakeOf(name).toUpperCase()}_ERROR_KINDS`,
  });

/** The api app root after the GraphQL server (platform/graphql) and the table's GraphQL transport are registered. */
const wireGraphqlFeature = (text, relative, name) =>
  wireImport(
    wireImport(text, relative, {
      importLine: 'import { GraphqlModule } from "@modules/platform/graphql"',
      symbol: "GraphqlModule",
      entry: "GraphqlModule.register({ isGlobal: true })",
    }),
    relative,
    {
      importLine: `import { ${pascalOf(name)}GraphqlModule } from "@features/api/${name}"`,
      symbol: `${pascalOf(name)}GraphqlModule`,
      entry: `${pascalOf(name)}GraphqlModule`,
    },
  );

/** The platform GraphQL server capability (templates/be/platform/graphql), whole or absent: written once, by the first GraphQL feature. */
const GRAPHQL_PLATFORM = "be/src/modules/platform/graphql";
/** The GraphQL error formatter the errors capability owns (BE_ERROR_MASKED: the registration passes platform/errors' formatter). */
const ERRORS_PLATFORM = "be/src/modules/platform/errors";
/** Every file the first GraphQL feature writes: platform/graphql whole and the GraphQL formatter of platform/errors. */
export const graphqlPlatformFiles = () =>
  [
    ["graphql", GRAPHQL_PLATFORM],
    ["errors-graphql", ERRORS_PLATFORM],
  ].flatMap(([templates, target]) => {
    const dir = path.join(TEMPLATES_DIR, "be", "platform", templates);
    return fs.readdirSync(dir).sort().map((file) => ({
      relative: `${target}/${file}`,
      body: fs.readFileSync(path.join(dir, file), "utf8").replace(/\r\n/g, "\n"),
    }));
  });

/** The be api feature of a table (owner ruling 2026-10-13, lite = full): get-<singular> and create-<singular> over GraphQL. */
const apiFeatureFiles = (values) => {
  const base = `be/src/features/api/${values.name}`;
  const get = `get-${values.singular}`;
  const create = `create-${values.singular}`;
  return [
    [`${base}/index.ts`, "feature.index.ts.tpl"],
    [`${base}/${values.name}.module.ts`, "feature.module.ts.tpl"],
    [`${base}/application/${get}.query.ts`, "get.query.ts.tpl"],
    [`${base}/application/${get}.handler.ts`, "get.handler.ts.tpl"],
    [`${base}/application/${get}.contracts.ts`, "get.contracts.ts.tpl"],
    [`${base}/application/${create}.command.ts`, "create.command.ts.tpl"],
    [`${base}/application/${create}.handler.ts`, "create.handler.ts.tpl"],
    [`${base}/application/${create}.contracts.ts`, "create.contracts.ts.tpl"],
    [`${base}/transport/graphql/${get}.resolver.ts`, "get.resolver.ts.tpl"],
    [`${base}/transport/graphql/${get}.mapper.ts`, "get.mapper.ts.tpl"],
    [`${base}/transport/graphql/dto/${get}.input.ts`, "get.input.ts.tpl"],
    [`${base}/transport/graphql/dto/${get}.type.ts`, "get.type.ts.tpl"],
    [`${base}/transport/graphql/${create}.resolver.ts`, "create.resolver.ts.tpl"],
    [`${base}/transport/graphql/${create}.mapper.ts`, "create.mapper.ts.tpl"],
    [`${base}/transport/graphql/dto/${create}.type.ts`, "create.type.ts.tpl"],
    [`${base}/transport/graphql/${values.name}-graphql.module.ts`, "graphql.module.ts.tpl"],
  ].map(([relative, file]) => ({ relative, body: template(`be/table/api/${file}`, values) }));
};

/**
 * The fe data code of a table in one product app: one GraphQL operation file per operation (modules/api/graphql/{queries,
 * mutations}, its request/data types from the generated wire types) and one SWR hook per operation (hooks/swr/api/graphql).
 * Never a Server Action and never a Supabase reader: Supabase on the front end is the Auth client only.
 */
const feOperationFiles = (app, values) => {
  const api = `fe/apps/${app}/src/modules/api/graphql`;
  const swr = `fe/apps/${app}/src/hooks/swr/api/graphql`;
  return [
    [`${api}/queries/query-${values.singular}.ts`, "query.ts.tpl"],
    [`${api}/queries/types/${values.singular}.ts`, "query.types.ts.tpl"],
    [`${api}/mutations/mutation-create-${values.singular}.ts`, "mutation.ts.tpl"],
    [`${api}/mutations/types/create-${values.singular}.ts`, "mutation.types.ts.tpl"],
    [`${swr}/queries/useQuery${values.Singular}Swr.ts`, "useQuerySwr.ts.tpl"],
    [`${swr}/mutations/useMutateCreate${values.Singular}Swr.ts`, "useMutateSwr.ts.tpl"],
  ].map(([relative, file]) => ({ relative, body: template(`fe/table/graphql/${file}`, values) }));
};

/** The barrel lines that make one table's SWR hooks reachable from hooks/swr (each barrel created when absent). */
const feBarrels = (app, values) => {
  const swr = `fe/apps/${app}/src/hooks/swr`;
  return [
    [`${swr}/api/graphql/queries/index.ts`, `export { QUERY_${values.singularUpper}_SWR_KEY, useQuery${values.Singular}Swr } from "./useQuery${values.Singular}Swr"`],
    [`${swr}/api/graphql/mutations/index.ts`, `export { MUTATE_CREATE_${values.singularUpper}_SWR_KEY, useMutateCreate${values.Singular}Swr } from "./useMutateCreate${values.Singular}Swr"`],
    [`${swr}/api/graphql/index.ts`, 'export * from "./mutations"'],
    [`${swr}/api/graphql/index.ts`, 'export * from "./queries"'],
    [`${swr}/api/index.ts`, 'export * from "./graphql"'],
    // the owner's public entry names its hooks explicitly (ARCH_OWNER_EXPORT_STAR); the inner barrels may re-export whole
    [`${swr}/index.ts`, `export { QUERY_${values.singularUpper}_SWR_KEY, useQuery${values.Singular}Swr } from "./api"`],
    [`${swr}/index.ts`, `export { MUTATE_CREATE_${values.singularUpper}_SWR_KEY, useMutateCreate${values.Singular}Swr } from "./api"`],
  ];
};

/** A barrel text with `line` added once, kept in code-unit order. */
const withExport = (text, line) => {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter(Boolean);
  if (lines.includes(line)) return text;
  return `${[...lines, line].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join("\n")}\n`;
};

/**
 * Adds one Supabase table migration and its domain capability; with `fe`, the table's api feature over GraphQL (the GraphQL
 * server capability on first use) and, in every product Next app, its operation files and SWR hooks.
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

  const singular = singularOf(feature);
  const values = {
    name: feature,
    table,
    tableSql: sqlIdentifierOf(table),
    Name: pascalOf(feature),
    nameCamel: camelOf(feature),
    upper: table.toUpperCase(),
    singular,
    Singular: pascalOf(singular),
    singularCamel: camelOf(singular),
    singularUpper: snakeOf(singular).toUpperCase(),
  };
  const apps = fe ? coreFeApps(repo.sides?.fe?.apps ?? []) : [];
  if (fe && !apps.length)
    throw new ScaffoldError(
      "HFS_ADD_NO_FRONT_END",
      "add table --fe needs at least one declared product Next app",
    );
  const api = fe ? ".api" : "";
  const domain = `be/src/modules/domain/${feature}`;
  const planned = [
    {
      relative: `supabase/migrations/${stamp}_${feature}.sql`,
      body: template("be/table/migration.sql.tpl", values),
    },
    { relative: `${domain}/index.ts`, body: template("be/table/index.ts.tpl", values) },
    { relative: `${domain}/errors/${feature}.error.ts`, body: template(`be/table/error${api}.ts.tpl`, values) },
    { relative: `${domain}/${feature}.module.ts`, body: template("be/table/module.ts.tpl", values) },
    { relative: `${domain}/${feature}.module-definition.ts`, body: template("be/table/module-definition.ts.tpl", values) },
    { relative: `${domain}/${feature}.options.ts`, body: template("be/table/options.ts.tpl", values) },
    { relative: `${domain}/${feature}.service.ts`, body: template(`be/table/service${api}.ts.tpl`, values) },
    { relative: `${domain}/persistence/${feature}.rows.ts`, body: template("be/table/rows.ts.tpl", values) },
    { relative: `${domain}/persistence/${feature}.sql.ts`, body: template(`be/table/sql${api}.ts.tpl`, values) },
  ];
  const databaseSql = "be/src/modules/platform/database/database.sql.ts";
  if (repo.edition === "lite" && !fs.existsSync(at(root, databaseSql))) {
    planned.splice(1, 0, {
      relative: databaseSql,
      body: render(fs.readFileSync(path.join(TEMPLATES_DIR, "be", "skeleton-lite", "src", "modules", "platform", "database", "database.sql.ts"), "utf8"), {}),
    });
  }
  if (fe) {
    planned.push(...apiFeatureFiles(values));
    if (!fs.existsSync(at(root, `${GRAPHQL_PLATFORM}/index.ts`))) planned.push(...graphqlPlatformFiles());
    for (const app of apps) planned.push(...feOperationFiles(app.name, values));
  }

  const clash = planned
    .filter((file) => fs.existsSync(at(root, file.relative)))
    .map((file) => file.relative);
  if (clash.length)
    throw new ScaffoldError(
      "HFS_ADD_EXISTS",
      `table ${requestedName} already exists: ${clash.join(", ")}`,
    );
  const owner = repo.sides.be.apps.find((app) => app.name === connection.owner && app.kind === "api");
  if (!owner)
    throw new ScaffoldError("HFS_ADD_NO_API_OWNER", `add table needs the Supabase connection owner ${connection.owner} to be a declared api app`);
  const ownerRelative = `be/apps/${owner.name}/src/app.module.ts`;
  if (!fs.existsSync(at(root, ownerRelative)))
    throw new ScaffoldError("HFS_ADD_WIRE_MISSING", `add table registers ${name} in ${ownerRelative}, which does not exist`);

  // Every existing file this run edits, as it was: restored on any failure, with every created file removed.
  const touched = new Map();
  const edit = (relative, change) => {
    const file = at(root, relative);
    if (!touched.has(file)) touched.set(file, fs.existsSync(file) ? fs.readFileSync(file) : null);
    const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    const after = change(before);
    if (after === before) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, after);
  };
  const created = [];
  try {
    for (const file of planned) {
      const target = at(root, file.relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.body);
      created.push(target);
    }
    if (typeof emitTypes === "function") {
      const generated = emitTypes({ root });
      if (typeof generated === "string") edit(dbTypesPath, () => generated);
    }
    edit(ownerRelative, (text) => wireDomainModule(text, ownerRelative, feature));
    const registrations = [
      ...(repo.edition === "lite" ? ["table"] : []),
      ...(fe ? ["api", "graphql"] : []),
    ];
    for (const generator of registrations) for (const relative of registrationFiles(generator)) edit(relative, (text) => text);
    for (const generator of registrations) registerLiteExports({ root, generator });
    if (fe) {
      registerLiteDomainService({ root, moduleSpecifier: `@modules/domain/${feature}`, service: `${values.Name}Service` });
      edit(ownerRelative, (text) => wireGraphqlFeature(text, ownerRelative, feature));
      for (const app of apps)
        for (const [relative, line] of feBarrels(app.name, values)) edit(relative, (text) => withExport(text, line));
    }
  } catch (error) {
    for (const [file, before] of touched) {
      if (before === null) fs.rmSync(file, { force: true });
      else fs.writeFileSync(file, before);
    }
    for (const file of [...created].reverse()) {
      if (fs.existsSync(file)) fs.rmSync(file);
      removeEmptyParents(file, root);
    }
    for (const [file, before] of touched) if (before === null) removeEmptyParents(file, root);
    throw error;
  }
  return {
    created: planned.map((file) => file.relative),
    types: typeof emitTypes === "function" ? dbTypesPath : "skipped",
  };
}
