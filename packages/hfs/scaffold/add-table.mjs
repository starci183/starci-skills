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
  if (
    !repo.sides?.be?.connections?.some(
      (connection) => connection.provider === "supabase",
    )
  ) {
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
  };
  const planned = [
    {
      relative: `supabase/migrations/${stamp}_${name}.sql`,
      body: template("be/table/migration.sql.tpl", values),
    },
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
  } catch (error) {
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
