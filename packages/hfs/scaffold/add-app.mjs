import fs from "node:fs";
import path from "node:path";
import {
  loadSlotManifest,
  readRepoDeclaration,
  resolveRepoDeclaration,
} from "../runtime/scripts/hfs/slots.mjs";
import { imageFiles, render, TEMPLATES_DIR } from "../sync/index.mjs";
import { ScaffoldError, pascalOf } from "./service.mjs";
import { PARTIAL_VARIABLES, bundledPins, callbackSourceFiles, coreFeApps, hasAuthCallback, jsonText, packageJsonText } from "./app.mjs";

/** The shared fe app core (modules/api, auth, toast, redux, the providers, the hooks): the base tree, then the edition overlay. */
const CORE_DIRS = Object.freeze({
  full: ["skeleton/apps/__app__"],
  lite: ["skeleton/apps/__app__", "skeleton-lite/apps/__app__"],
});

const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const listFiles = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory()
      ? listFiles(full, base)
      : [path.relative(base, full).split(path.sep).join("/")];
  });

const fill = (text, values, file) =>
  text.replace(/\{\{(project|app|appPascal)\}\}/g, (whole, key) => {
    if (values[key] === undefined)
      throw new ScaffoldError(
        "HFS_ADD_PLACEHOLDER_UNKNOWN",
        `app template ${file} uses ${whole}, which add app does not provide`,
      );
    return values[key];
  });

/** Render the edition skeleton followed by its shared core and edition overlay. */
function planAppTemplates(repo, name) {
  const source = path.join(
    TEMPLATES_DIR,
    "fe",
    repo.edition === "lite" ? "skeleton-lite/apps/web" : "skeleton/apps/app",
  );
  if (!fs.existsSync(source))
    throw new ScaffoldError(
      "HFS_ADD_TEMPLATE_MISSING",
      `the ${repo.edition} Next app skeleton is not carried by this package`,
    );
  const values = {
    project: repo.project,
    app: name,
    appPascal: pascalOf(name),
  };
  const targetBase = `fe/apps/${name}`;
  const readTemplate = (dir, relative) =>
    fill(
      render(fs.readFileSync(path.join(dir, ...relative.split("/")), "utf8").replace(/\r\n/g, "\n"), PARTIAL_VARIABLES),
      values,
      relative,
    );
  // The app skeleton, then the shared core, then the edition overlay: a later tree replaces an earlier file of the same path.
  const byPath = new Map();
  for (const dir of [source, ...CORE_DIRS[repo.edition === "lite" ? "lite" : "full"].map((core) => path.join(TEMPLATES_DIR, "fe", ...core.split("/")))]) {
    if (!fs.existsSync(dir)) continue;
    for (const relative of listFiles(dir)) byPath.set(relative, { relative: `${targetBase}/${relative}`, body: readTemplate(dir, relative) });
  }
  return callbackSourceFiles([...byPath.values()].map(file => ({ path: file.relative, content: file.body })), repo)
    .map(file => ({ relative: file.path, body: file.content }));
}

/** The package and TypeScript manifests of a new Next workspace. */
function planWorkspaceManifests(root, repo, name) {
  const targetBase = `fe/apps/${name}`;
  // The dependency source is a product app (it carries the core's fe-stack packages), else the first Next app.
  const firstApp = coreFeApps(repo.sides.fe.apps)[0] ?? repo.sides.fe.apps.find((app) => app.kind === "next");
  const firstPackage = firstApp
    ? path.join(root, "fe", "apps", firstApp.name, "package.json")
    : null;
  if (!firstPackage || !fs.existsSync(firstPackage))
    throw new ScaffoldError(
      "HFS_ADD_APP_PACKAGE_SOURCE",
      "add app needs the package.json of an existing declared Next app as the edition-matched dependency source",
    );
  const workspacePackage = JSON.parse(fs.readFileSync(firstPackage, "utf8"));
  workspacePackage.name = `@${repo.project}/${name}`;
  if (hasAuthCallback(repo)) {
    const pins = bundledPins();
    workspacePackage.dependencies ??= {};
    for (const dependency of ["@supabase/ssr", "@supabase/supabase-js", "server-only"])
      workspacePackage.dependencies[dependency] = pins[dependency].version;
  }
  const appTemplates = path.join(TEMPLATES_DIR, "fe", "app");
  return [
    {
      relative: `${targetBase}/package.json`,
      body:
        fs
          .readFileSync(path.join(appTemplates, "package.json.tpl"), "utf8")
          .replace("{{packageJson}}", packageJsonText(workspacePackage).trimEnd()),
    },
    {
      relative: `${targetBase}/tsconfig.json`,
      body: fs.readFileSync(path.join(appTemplates, "tsconfig.json"), "utf8"),
    },
  ];
}

function persistAppFiles({ root, name, planned, declaration, declarationFile, packageFile }) {
  const rootPackage = JSON.parse(fs.readFileSync(packageFile, "utf8"));
  const oldDeclaration = fs.readFileSync(declarationFile, "utf8");
  const oldPackage = fs.readFileSync(packageFile, "utf8");
  rootPackage.workspaces = [
    ...new Set([...(rootPackage.workspaces ?? []), "fe/apps/*"]),
  ];
  const created = [];
  try {
    for (const file of planned) {
      const target = path.join(root, ...file.relative.split("/"));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.body);
      created.push(target);
    }
    fs.writeFileSync(declarationFile, jsonText(declaration));
    fs.writeFileSync(packageFile, packageJsonText(rootPackage));
  } catch (error) {
    for (const file of [...created].reverse())
      if (fs.existsSync(file)) fs.rmSync(file);
    const appDir = path.join(root, "fe", "apps", name);
    if (fs.existsSync(appDir))
      fs.rmSync(appDir, { recursive: true, force: true });
    fs.writeFileSync(declarationFile, oldDeclaration);
    fs.writeFileSync(packageFile, oldPackage);
    throw error;
  }
}

/**
 * Adds one Next workspace from the edition's canonical app skeleton and the shared app core (both editions, owner ruling
 * 2026-10-13: lite and full have one fe structure), then registers it in hfs.json. The root workspace glob is added only when an
 * older app manifest does not already carry it.
 */
export function addApp({ root, name }) {
  if (!NAME.test(String(name)))
    throw new ScaffoldError(
      "HFS_ADD_NAME_INVALID",
      `app name ${name} must be kebab-case (letters, digits and single dashes)`,
    );
  const declarationFile = path.join(root, "hfs.json");
  const packageFile = path.join(root, "package.json");
  if (!fs.existsSync(declarationFile) || !fs.existsSync(packageFile))
    throw new ScaffoldError(
      "HFS_ADD_NOT_AN_APP",
      "add app runs at the app root containing hfs.json and package.json",
    );
  const manifest = loadSlotManifest();
  const repo = readRepoDeclaration(manifest, root);
  if (!repo.sides?.fe)
    throw new ScaffoldError(
      "HFS_ADD_NO_FRONT_END",
      "this app has no front-end side",
    );
  if (repo.sides.fe.apps.some((app) => app.name === name))
    throw new ScaffoldError(
      "HFS_ADD_EXISTS",
      `front-end app ${name} is already declared`,
    );
  const targetBase = `fe/apps/${name}`;
  const planned = [...planAppTemplates(repo, name), ...planWorkspaceManifests(root, repo, name)];
  const declaration = JSON.parse(fs.readFileSync(declarationFile, "utf8"));
  declaration.sides.fe.apps.push({ name, kind: "next" });
  const image = imageFiles(
    resolveRepoDeclaration(manifest, declaration),
  ).find((file) => file.path === `${targetBase}/Dockerfile`);
  if (!image)
    throw new ScaffoldError(
      "HFS_ADD_TEMPLATE_MISSING",
      `the Dockerfile of front-end app ${name} did not render`,
    );
  planned.push({ relative: image.path, body: image.content });

  const clashes = planned
    .filter((file) =>
      fs.existsSync(path.join(root, ...file.relative.split("/"))),
    )
    .map((file) => file.relative);
  if (clashes.length)
    throw new ScaffoldError(
      "HFS_ADD_EXISTS",
      `front-end app ${name} already exists: ${clashes.join(", ")}`,
    );

  persistAppFiles({ root, name, planned, declaration, declarationFile, packageFile });
  return {
    created: planned.map((file) => file.relative),
    registered: { app: name, workspace: "fe/apps/*" },
  };
}
