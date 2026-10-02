import fs from "node:fs";
import path from "node:path";
import { emitDbTypes, dbTypesPath } from "../emit/db-types.mjs";
import {
  loadSlotManifest,
  readRepoDeclaration,
} from "../runtime/scripts/hfs/slots.mjs";
import { TEMPLATES_DIR } from "../sync/index.mjs";
import { ScaffoldError, pascalOf } from "./service.mjs";

const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const MIGRATION = /^(\d{14})_[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.sql$/;

const timestampOf = (now) =>
  new Date(now()).toISOString().replace(/\D/g, "").slice(0, 14);
const snakeOf = (name) => name.replaceAll("-", "_");
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
  const importLine = `import { ${symbol} } from "@modules/domain/${name}"`;
  const lines = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");
  const lastImport = lines.reduce((last, line, index) => (line.startsWith("import ") ? index : last), -1);
  const imports = lines.findIndex((line) => /^\s*imports: \[$/.test(line));
  if (lastImport < 0 || imports < 0)
    throw new ScaffoldError("HFS_ADD_WIRE_INVALID", `add table could not find the imports array in ${relative}`);
  if (!lines.includes(importLine)) {
    lines.splice(lastImport + 1, 0, importLine);
    const shiftedImports = imports > lastImport ? imports + 1 : imports;
    const indent = /^(\s*)/.exec(lines[shiftedImports])?.[1] ?? "";
    lines.splice(shiftedImports + 1, 0, `${indent}    ${symbol}.register({ isGlobal: true }),`);
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
  if (!NAME.test(String(name)))
    throw new ScaffoldError(
      "HFS_ADD_NAME_INVALID",
      `table name ${name} must be kebab-case (letters, digits and single dashes)`,
    );
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
  if (migrations.some((file) => file.endsWith(`_${name}.sql`)))
    throw new ScaffoldError(
      "HFS_ADD_EXISTS",
      `table ${name} already has a migration`,
    );
  const stamp = timestampOf(now);
  const latest = migrations.at(-1)?.slice(0, 14);
  if (latest && stamp <= latest)
    throw new ScaffoldError(
      "HFS_ADD_MIGRATION_ORDER",
      `the current UTC timestamp ${stamp} is not later than the latest migration ${latest}; fix the clock or wait for the next second`,
    );

  const values = {
    name,
    table: snakeOf(name),
    Name: pascalOf(name),
    nameCamel: camelOf(name),
    upper: snakeOf(name).toUpperCase(),
    singular: singularOf(name),
    Singular: pascalOf(singularOf(name)),
  };
  const planned = [
    {
      relative: `supabase/migrations/${stamp}_${name}.sql`,
      body: template("be/table/migration.sql.tpl", values),
    },
    { relative: `be/src/modules/domain/${name}/index.ts`, body: template("be/table/index.ts.tpl", values) },
    { relative: `be/src/modules/domain/${name}/${name}.module.ts`, body: template("be/table/module.ts.tpl", values) },
    { relative: `be/src/modules/domain/${name}/${name}.module-definition.ts`, body: template("be/table/module-definition.ts.tpl", values) },
    { relative: `be/src/modules/domain/${name}/${name}.options.ts`, body: template("be/table/options.ts.tpl", values) },
    { relative: `be/src/modules/domain/${name}/${name}.service.ts`, body: template("be/table/service.ts.tpl", values) },
    { relative: `be/src/modules/domain/${name}/persistence/${name}.rows.ts`, body: template("be/table/rows.ts.tpl", values) },
    { relative: `be/src/modules/domain/${name}/persistence/${name}.sql.ts`, body: template("be/table/sql.ts.tpl", values) },
  ];
  if (fe) {
    const apps =
      repo.sides?.fe?.apps?.filter((app) => app.kind === "next") ?? [];
    if (!apps.length)
      throw new ScaffoldError(
        "HFS_ADD_NO_FRONT_END",
        "add table --fe needs at least one declared Next app",
      );
    for (const app of apps) {
      const base = `fe/apps/${app.name}/src/modules/db/${name}`;
      planned.push(
        {
          relative: `${base}/read-${name}.ts`,
          body: template("fe/table/read.ts.tpl", values),
        },
        {
          relative: `${base}/write-${name}.ts`,
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
      `table ${name} already exists: ${clash.join(", ")}`,
    );
  const owner = repo.sides.be.apps.find((app) => app.name === connection.owner && app.kind === "api");
  if (!owner)
    throw new ScaffoldError("HFS_ADD_NO_API_OWNER", `add table needs the Supabase connection owner ${connection.owner} to be a declared api app`);
  const ownerFile = path.join(root, "be", "apps", owner.name, "src", "app.module.ts");
  if (!fs.existsSync(ownerFile))
    throw new ScaffoldError("HFS_ADD_WIRE_MISSING", `add table registers ${name} in be/apps/${owner.name}/src/app.module.ts, which does not exist`);
  const ownerBefore = fs.readFileSync(ownerFile, "utf8");
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
    wireApiModule(root, owner.name, name);
  } catch (error) {
    fs.writeFileSync(ownerFile, ownerBefore);
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
