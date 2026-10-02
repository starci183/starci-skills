// hfs upgrade --edition full: the additive edition migration from a lite app to the full HFS tree.
//
// The upgrade is deliberately assembled from the same full-edition render and scaffold templates as a new full app. It never
// rewrites an existing product source file. A dry run returns the exact ordered operations; apply performs those operations and
// resolves the lockfile once when it added dependencies. If that resolution fails, every file touched by this invocation is
// restored before the refusal is returned.
import fs from "node:fs";
import path from "node:path";
import { parseYaml } from "../runtime/engine/yaml.mjs";
import {
  loadSlotManifest,
  resolveRepoDeclaration,
} from "../runtime/scripts/hfs/slots.mjs";
import { managedScriptNames } from "../runtime/scripts/hfs/architecture/managed-scripts.mjs";
import { LOCK_STEP, npmLock } from "../scaffold/app.mjs";
import {
  TEMPLATES_DIR,
  appSource,
  checkTargets,
  imageFiles,
  loadHfs,
  render,
  renderTargets,
  writeTargets,
} from "../sync/index.mjs";

const PACKAGE_ROOT = path.join(import.meta.dirname, "..");
const PINS_FILE = path.join(
  PACKAGE_ROOT,
  "runtime",
  "knowledge",
  "hfs",
  "canon-pins.yaml",
);
const FULL_DEV_DEPENDENCIES = Object.freeze([
  "@nestjs/testing",
  "@starci/jest-preset",
  "@starci/test-world",
  "@types/jest",
  "jest",
  "ts-jest",
]);
const FULL_DEPENDENCIES = Object.freeze(["nest-commander"]);
// Upgrade must render the full managed files before it can add/install the full-only Jest preset. These are the preset's two
// public sync inputs; once apply resolves the new dependency, normal full sync reads them from @starci/jest-preset again.
const UPGRADE_PRESETS = Object.freeze({
  sonarExclusions: "**/*.spec.ts,**/*.e2e-spec.ts,**/dist/**,**/coverage/**",
  coverageSources: Object.freeze([
    "src/**/*.service.ts",
    "src/features/cli/**/*.cli.ts",
  ]),
});
const STANDARD_CLI_FILES = Object.freeze([
  "src/features/cli/index.ts",
  "src/features/cli/migrate/migrate.cli.ts",
  "src/features/cli/migrate/migrate.module.ts",
]);

export class UpgradeError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.code = code;
  }
}

const posix = (value) => value.split(path.sep).join("/");
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const fileText = (root, file) =>
  fs
    .readFileSync(path.join(root, ...file.split("/")), "utf8")
    .replace(/\r\n/g, "\n");
const sameText = (root, file, content) =>
  fs.existsSync(path.join(root, ...file.split("/"))) &&
    fileText(root, file) === content.replace(/\r\n/g, "\n");

const readmeCommand = (name) =>
  name === "test" ? "npm test" : `npm run ${name}`;

/** Add only the top-level commands that the full managed scripts introduce, preserving every existing README byte around them. */
function upgradedReadme(root) {
  const file = path.join(root, "README.md");
  if (!fs.existsSync(file)) return null;
  const source = fs.readFileSync(file, "utf8");
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/u);
  const start = lines.findIndex((line) => /^## Development\s*$/u.test(line));
  if (start < 0) return null;
  const end = lines.findIndex(
    (line, index) => index > start && /^## /u.test(line),
  );
  const stop = end < 0 ? lines.length : end;
  const addedNames = [...managedScriptNames("app", "full")].filter(
    (name) =>
      !name.includes(":") && !managedScriptNames("app", "lite").has(name),
  );
  const section = lines.slice(start + 1, stop).join("\n");
  const commands = addedNames
    .map(readmeCommand)
    .filter(
      (command) =>
        !new RegExp(
          `^\\s*${command.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*$`,
          "mu",
        ).test(section),
    );
  if (commands.length === 0) return null;
  let insert = -1;
  for (let index = start + 1; index < stop; index += 1)
    if (/^\s*npm run\s+/u.test(lines[index])) insert = index + 1;
  if (insert < 0) return null;
  lines.splice(insert, 0, ...commands);
  return lines.join(newline);
}

function readJson(root, file) {
  try {
    return JSON.parse(fileText(root, file));
  } catch (error) {
    throw new UpgradeError(
      "HFS_UPGRADE_INPUT_INVALID",
      `${file} is not valid JSON: ${error.message}`,
    );
  }
}

function listFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory()
      ? listFiles(target, base)
      : [posix(path.relative(base, target))];
  });
}

/** The full declaration produced from a lite declaration. The edition field disappears and the one cli app becomes required. */
export function fullEditionDeclaration(
  declaration,
  manifest = loadSlotManifest(),
) {
  if (declaration?.edition !== "lite") {
    const actual = declaration?.edition ?? "full";
    throw new UpgradeError(
      "HFS_UPGRADE_ALREADY_FULL",
      `hfs.json edition is ${actual}; upgrade accepts only an edition lite app`,
    );
  }
  const next = structuredClone(declaration);
  delete next.edition;
  const cliApps =
    next.sides?.be?.apps?.filter((app) => app.kind === "cli") ?? [];
  if (cliApps.some((app) => app.name !== "cli") || cliApps.length > 1) {
    throw new UpgradeError(
      "HFS_UPGRADE_CLI_CONFLICT",
      "the lite declaration has a cli app that is not the one be/apps/cli; rename it before upgrading",
    );
  }
  if (cliApps.length === 0)
    next.sides.be.apps.push({ name: "cli", kind: "cli" });
  next.sides.be.kinds = [...new Set([...(next.sides.be.kinds ?? []), "cli"])];
  resolveRepoDeclaration(manifest, next);
  return next;
}

function pinnedPackage(root, pins) {
  const current = readJson(root, "package.json");
  const section = (name, dependencies) => {
    const next = { ...(current[name] ?? {}) };
    for (const dependency of dependencies) {
      const pin = pins[dependency]?.version;
      if (!pin)
        throw new UpgradeError(
          "HFS_UPGRADE_PIN_MISSING",
          `${dependency} has no canon pin in knowledge/hfs/canon-pins.yaml`,
        );
      next[dependency] = pin;
    }
    return Object.fromEntries(
      Object.entries(next).sort(([a], [b]) => a.localeCompare(b)),
    );
  };
  return {
    ...current,
    dependencies: section("dependencies", FULL_DEPENDENCIES),
    devDependencies: section("devDependencies", FULL_DEV_DEPENDENCIES),
  };
}

function nestCliText(declaration) {
  const apps = declaration.sides.be.apps;
  const projects = Object.fromEntries(
    apps.map((app) => [
      app.name,
      {
        type: "application",
        root: `apps/${app.name}`,
        entryFile: "main",
        sourceRoot: `apps/${app.name}/src`,
      },
    ]),
  );
  const api = apps.find((app) => app.kind === "api");
  return jsonText({
    $schema: "https://json.schemastore.org/nest-cli",
    collection: "@nestjs/schematics",
    monorepo: true,
    root: `apps/${api.name}`,
    sourceRoot: `apps/${api.name}/src`,
    projects,
  });
}

function templateFiles(group, prefix, variables) {
  const dir = path.join(TEMPLATES_DIR, group);
  return listFiles(dir).map((file) => ({
    path: `${prefix}${file}`,
    content: render(
      fs
        .readFileSync(path.join(dir, ...file.split("/")), "utf8")
        .replace(/\r\n/g, "\n"),
      variables,
    ),
  }));
}

function additions(full, hadCli, manifest) {
  const variables = { project: full.project, app: "cli", appPascal: "Cli" };
  const files = [
    ...templateFiles("app/upgrade-full", "", variables),
    ...(!hadCli
      ? [
          ...STANDARD_CLI_FILES.map((file) => ({
            path: `be/${file}`,
            content: fs
              .readFileSync(
                path.join(TEMPLATES_DIR, "be", "skeleton", ...file.split("/")),
                "utf8",
              )
              .replace(/\r\n/g, "\n"),
          })),
          ...templateFiles("be/upgrade-full", "be/", variables),
        ]
      : []),
  ];
  const requiredImages = imageFiles(
    resolveRepoDeclaration(manifest, full),
  ).filter((file) => !file.path.startsWith("be/apps/api/"));
  for (const file of requiredImages) files.push(file);
  return files;
}

/** The post-upgrade back-end source view used by the managed coverage render before those additions exist on disk. */
function sourceWithAdditions(root, additions) {
  const current = appSource(root);
  const added = new Map(
    additions
      .filter(
        (file) => file.path.startsWith("be/") && /\.[cm]?ts$/u.test(file.path),
      )
      .map((file) => [file.path.slice("be/".length), file.content]),
  );
  return {
    files: [...new Set([...current.files, ...added.keys()])].sort(),
    read: (file) => added.get(file) ?? current.read(file),
  };
}

const publicStep = ({ op, path: file, why }) => ({ op, path: file, why });

async function model({ root, to, presets, manifest }) {
  if (to !== "full")
    throw new UpgradeError(
      "HFS_UPGRADE_TARGET_INVALID",
      "upgrade supports only --edition full",
    );
  const declaration = loadHfs(root, manifest);
  const hadCli = declaration.sides.be.apps.some(
    (app) => app.kind === "cli" && app.name === "cli",
  );
  const full = fullEditionDeclaration(declaration, manifest);
  const desired = additions(full, hadCli, manifest);
  const pins = parseYaml(fs.readFileSync(PINS_FILE, "utf8")).pins;
  const upgradedPackage = pinnedPackage(root, pins);
  const resolvedPresets = presets ?? UPGRADE_PRESETS;
  const managed = renderTargets(full, resolvedPresets, {
    manifest,
    source: sourceWithAdditions(root, desired),
  });
  const packageTarget = managed.find(
    (target) => target.path === "package.json",
  );
  if (!packageTarget)
    throw new UpgradeError(
      "HFS_UPGRADE_RENDER_INVALID",
      "the full sync render has no managed package.json scripts target",
    );
  const nextPackage = { ...upgradedPackage, scripts: packageTarget.scripts };
  const packageChanged =
    jsonText(nextPackage) !== fileText(root, "package.json");
  const dependenciesChanged =
    [...FULL_DEPENDENCIES].some(
      (name) =>
        readJson(root, "package.json").dependencies?.[name] !==
        nextPackage.dependencies[name],
    ) ||
    [...FULL_DEV_DEPENDENCIES].some(
      (name) =>
        readJson(root, "package.json").devDependencies?.[name] !==
        nextPackage.devDependencies[name],
    );
  const managedWithoutPackage = managed.filter(
    (target) => target.path !== "package.json",
  );
  const targetResults = checkTargets(root, managedWithoutPackage);
  const steps = [
    {
      op: "remove-field",
      path: "hfs.json",
      why: "Full is the default edition; declare the required cli app without changing the HFS major.",
      content: jsonText(full),
      kind: "file",
    },
  ];
  const readme = upgradedReadme(root);
  if (readme !== null)
    steps.push({
      op: "rewrite-readme",
      path: "README.md",
      why: "List the full edition's newly managed top-level scripts in Development without changing other README text.",
      content: readme,
      kind: "file",
    });
  for (const result of targetResults) {
    if (result.status === "ok") continue;
    steps.push({
      op: result.status === "missing" ? "add" : "rewrite-managed",
      path: result.path,
      why: "Render the full-edition managed file through the normal sync renderer.",
      kind: "managed",
    });
  }
  if (packageChanged)
    steps.push({
      op: "rewrite-managed",
      path: "package.json",
      why: "Add the full test toolchain at canon pins and render the full root scripts.",
      content: jsonText(nextPackage),
      kind: "file",
    });
  for (const file of desired) {
    const target = path.join(root, ...file.path.split("/"));
    if (fs.existsSync(target)) {
      if (!sameText(root, file.path, file.content))
        throw new UpgradeError(
          "HFS_UPGRADE_FILE_CONFLICT",
          `${file.path} already exists and is not the upgrade scaffold; no file was overwritten`,
        );
      continue;
    }
    steps.push({
      op: "add",
      path: file.path,
      why: file.path.startsWith(".starcistacks/")
        ? "Add the pinned Supabase/Postgres and api full-stack skeleton."
        : file.path.includes("/tests/")
          ? "Open the full test layer without inventing a spec."
          : "Add the full-only cli or image scaffold.",
      content: file.content,
      kind: "file",
    });
  }
  if (!sameText(root, "be/nest-cli.json", nestCliText(full)))
    steps.push({
      op: "rewrite-managed",
      path: "be/nest-cli.json",
      why: "Register the required cli app in the Nest monorepo map.",
      content: nestCliText(full),
      kind: "file",
    });
  if (dependenciesChanged)
    steps.push({
      op: "rewrite-managed",
      path: "package-lock.json",
      why: `Resolve the added pinned dependencies with ${LOCK_STEP}.`,
      kind: "lock",
    });
  return { full, managed: managedWithoutPackage, steps, dependenciesChanged };
}

function remember(snapshot, target) {
  if (snapshot.has(target)) return;
  snapshot.set(
    target,
    fs.existsSync(target) && fs.statSync(target).isFile()
      ? fs.readFileSync(target)
      : null,
  );
}

function ensureParent(root, target, directories) {
  const missing = [];
  for (
    let at = path.dirname(target);
    at.startsWith(root) && at !== root && !fs.existsSync(at);
    at = path.dirname(at)
  )
    missing.push(at);
  for (const directory of missing.reverse()) {
    fs.mkdirSync(directory);
    directories.push(directory);
  }
}

function writeFile(root, file, content, snapshot, directories) {
  const target = path.join(root, ...file.split("/"));
  remember(snapshot, target);
  ensureParent(root, target, directories);
  fs.writeFileSync(target, content);
}

function restore(snapshot, directories) {
  for (const [target, content] of [...snapshot.entries()].reverse()) {
    if (content === null) {
      if (fs.existsSync(target) && fs.statSync(target).isFile())
        fs.unlinkSync(target);
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
  }
  for (const directory of [...directories].reverse()) {
    try {
      fs.rmdirSync(directory);
    } catch {
      /* It is non-empty or already absent: preserve it. */
    }
  }
}

/**
 * Plans or applies the lite -> full migration. Returns the ordered public plan (`{op,path,why}[]`) in both modes.
 * `presets` and `lock` are test seams for the full managed render and npm lock resolution.
 */
export async function upgradeEdition({
  root,
  to,
  plan = false,
  presets,
  manifest = loadSlotManifest(),
  lock = npmLock,
}) {
  const repoRoot = path.resolve(root);
  const built = await model({ root: repoRoot, to, presets, manifest });
  const result = built.steps.map(publicStep);
  if (plan) return result;
  const snapshot = new Map();
  const directories = [];
  try {
    for (const step of built.steps) {
      if (step.kind === "lock") continue;
      if (step.kind === "managed") {
        const target = built.managed.find(
          (candidate) => candidate.path === step.path,
        );
        const file = path.join(repoRoot, ...step.path.split("/"));
        remember(snapshot, file);
        ensureParent(repoRoot, file, directories);
        writeTargets(repoRoot, [target]);
      } else
        writeFile(repoRoot, step.path, step.content, snapshot, directories);
    }
    if (built.dependenciesChanged) {
      const lockFile = path.join(repoRoot, "package-lock.json");
      remember(snapshot, lockFile);
      const locked = lock(repoRoot);
      if (!locked.ok)
        throw new UpgradeError(
          "HFS_UPGRADE_LOCK_FAILED",
          `\`${LOCK_STEP}\` could not resolve the upgraded lockfile (${locked.detail}); the lite app was restored`,
        );
    }
  } catch (error) {
    restore(snapshot, directories);
    throw error;
  }
  return result;
}

/** CLI adapter kept outside bin/hfs.mjs so that verb wiring remains one line. */
export async function upgradeMain(
  argv,
  { stdout = (value) => process.stdout.write(value), presets } = {},
) {
  let to;
  let plan = false;
  let root = process.cwd();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--edition" || arg === "--repo") {
      if (argv[index + 1] === undefined)
        throw new UpgradeError("HFS_UPGRADE_USAGE", `${arg} needs a value`);
      if (arg === "--edition") to = argv[index + 1];
      else root = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg === "--plan") plan = true;
    else throw new UpgradeError("HFS_UPGRADE_USAGE", `unknown argument ${arg}`);
  }
  if (to === undefined)
    throw new UpgradeError(
      "HFS_UPGRADE_USAGE",
      "hfs upgrade needs --edition full",
    );
  const steps = await upgradeEdition({ root, to, plan, presets });
  for (const step of steps) stdout(`${step.op} ${step.path}: ${step.why}\n`);
  stdout(
    `hfs upgrade --edition full${plan ? " --plan" : ""}: ${steps.length} step${steps.length === 1 ? "" : "s"} ${plan ? "planned; no file written" : "applied"}\n`,
  );
  return 0;
}
