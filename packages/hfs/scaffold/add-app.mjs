import fs from "node:fs";
import path from "node:path";
import {
  loadSlotManifest,
  readRepoDeclaration,
  resolveRepoDeclaration,
} from "../runtime/scripts/hfs/slots.mjs";
import { imageFiles, render, TEMPLATES_DIR } from "../sync/index.mjs";
import { ScaffoldError, pascalOf } from "./service.mjs";
import { PARTIAL_VARIABLES, bundledPins, coreFeApps, jsonText, packageJsonText } from "./app.mjs";
import { addAuthCallbackDependencies, applyFeTemplatePolicy, enableAuthCallback } from "./fe-template-policy.mjs";

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

function appSkeleton(repo, name, authCallback) {
  const source = path.join(TEMPLATES_DIR, "fe", repo.edition === "lite" ? "skeleton-lite/apps/web" : "skeleton/apps/app");
  if (!fs.existsSync(source)) throw new ScaffoldError("HFS_ADD_TEMPLATE_MISSING", `the ${repo.edition} Next app skeleton is not carried by this package`);
  const values = { project: repo.project, app: name, appPascal: pascalOf(name) };
  const readTemplate = (dir, relative) => fill(
    render(fs.readFileSync(path.join(dir, ...relative.split("/")), "utf8").replace(/\r\n/g, "\n"), PARTIAL_VARIABLES),
    values,
    relative,
  );
  const byPath = new Map();
  const coreDirs = CORE_DIRS[repo.edition === "lite" ? "lite" : "full"].map(core => path.join(TEMPLATES_DIR, "fe", ...core.split("/")));
  // Each later tree replaces the earlier file of the same path.
  for (const dir of [source, ...coreDirs]) {
    if (!fs.existsSync(dir)) continue;
    for (const relative of listFiles(dir)) byPath.set(relative, { path: `fe/apps/${name}/${relative}`, content: readTemplate(dir, relative) });
  }
  return applyFeTemplatePolicy([...byPath.values()], { authCallback }).map(file => ({ relative: file.path, body: file.content }));
}

function workspacePackageFrom(root, repo, name) {
  const firstApp = coreFeApps(repo.sides.fe.apps)[0] ?? repo.sides.fe.apps.find(app => app.kind === "next");
  const firstPackage = firstApp ? path.join(root, "fe", "apps", firstApp.name, "package.json") : null;
  if (!firstPackage || !fs.existsSync(firstPackage)) throw new ScaffoldError("HFS_ADD_APP_PACKAGE_SOURCE", "add app needs the package.json of an existing declared Next app as the edition-matched dependency source");
  const workspacePackage = JSON.parse(fs.readFileSync(firstPackage, "utf8"));
  workspacePackage.name = `@${repo.project}/${name}`;
  return workspacePackage;
}

function writeAppPlan(root, name, planned, declarationFile, declaration, packageFile) {
  const rootPackage = JSON.parse(fs.readFileSync(packageFile, "utf8"));
  const oldDeclaration = fs.readFileSync(declarationFile, "utf8");
  const oldPackage = fs.readFileSync(packageFile, "utf8");
  rootPackage.workspaces = [...new Set([...(rootPackage.workspaces ?? []), "fe/apps/*"])];
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
    for (const file of [...created].reverse()) if (fs.existsSync(file)) fs.rmSync(file);
    const appDir = path.resolve(root, "fe", "apps", name);
    const workspaceRoot = path.resolve(root) + path.sep;
    if (appDir.startsWith(workspaceRoot) && fs.existsSync(appDir)) fs.rmSync(appDir, { recursive: true, force: true });
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
export function addApp({ root, name, authCallback = false }) {
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
  const declaration = JSON.parse(fs.readFileSync(declarationFile, "utf8"));
  enableAuthCallback(declaration, authCallback);
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
  const planned = appSkeleton(repo, name, authCallback);

  // The dependency source is a product app (it carries the core's fe-stack packages), else the first Next app.
  const workspacePackage = workspacePackageFrom(root, repo, name);
  if (authCallback) addAuthCallbackDependencies(workspacePackage, bundledPins(), true);
  const appTemplates = path.join(TEMPLATES_DIR, "fe", "app");
  planned.push(
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
  );
  declaration.sides.fe.apps.push({ name, kind: "next" });
  if (repo.edition === "full") {
    const image = imageFiles(
      resolveRepoDeclaration(manifest, declaration),
    ).find((file) => file.path === `${targetBase}/Dockerfile`);
    if (!image)
      throw new ScaffoldError(
        "HFS_ADD_TEMPLATE_MISSING",
        `the Dockerfile of front-end app ${name} did not render`,
      );
    planned.push({ relative: image.path, body: image.content });
  }

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

  writeAppPlan(root, name, planned, declarationFile, declaration, packageFile);
  return {
    created: planned.map((file) => file.relative),
    registered: { app: name, workspace: "fe/apps/*" },
  };
}
