#!/usr/bin/env node

import {execFileSync} from "node:child_process";
import {existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from "node:fs";
import {dirname, isAbsolute, join, relative, resolve, sep} from "node:path";
import {fileURLToPath} from "node:url";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const defaultSource = resolve(scriptRoot, "..", "..");
const args = process.argv.slice(2);
const command = args[0];

const value = (flag) => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};

const has = (flag) => args.includes(flag);
const slash = (path) => path.split(sep).join("/");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const github = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/;

function fail(message) {
  throw new Error(message);
}

function samePath(left, right) {
  const normalize = (path) => resolve(path).replaceAll("\\", "/").replace(/\/$/, "").toLowerCase();
  return normalize(left) === normalize(right);
}

function inside(root, path) {
  const result = relative(resolve(root), resolve(path));
  return result !== "" && !result.startsWith(`..${sep}`) && result !== ".." && !isAbsolute(result);
}

function portablePath(root, path, label) {
  if (!inside(root, path)) fail(`${label} is outside its repository: ${path}`);
  const result = slash(relative(resolve(root), resolve(path)));
  validateRelative(result, label);
  return result;
}

function validateRelative(path, label) {
  if (typeof path !== "string" || path.length === 0 || isAbsolute(path) || /^[A-Za-z]:/.test(path)) {
    fail(`${label} must be a non-empty portable relative path`);
  }
  const parts = path.replaceAll("\\", "/").split("/");
  if (parts.includes("..") || parts.includes("") || path.includes("\\")) fail(`${label} is not normalized: ${path}`);
}

function assertKeys(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length) fail(`${label} has unsupported keys: ${extra.join(", ")}`);
}

function assertPublicationSafe(value, label) {
  const serialized = JSON.stringify(value);
  if (/credential|token|secret|password/i.test(serialized)) fail(`${label} contains a forbidden secret-bearing field or value`);
  if (/(?:^|["'])\s*[A-Za-z]:[\\/]/m.test(serialized)) fail(`${label} contains an absolute Windows path`);
  if (/"(?:diskPath|gitRoot|head|updatedAt)"\s*:/i.test(serialized)) fail(`${label} contains observed machine state`);
  const visit = (item, path = label) => {
    if (typeof item === "string") {
      if (item.startsWith("/")) fail(`${path} contains an absolute POSIX path`);
      if (/^https?:\/\/[^/\s]+@/i.test(item)) fail(`${path} contains URL user information`);
      return;
    }
    if (Array.isArray(item)) {
      item.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
    if (item && typeof item === "object") {
      Object.entries(item).forEach(([key, child]) => visit(child, `${path}.${key}`));
    }
  };
  visit(value);
}

export function validatePortableRoute(route, label = "portable route") {
  assertKeys(route, ["$schema", "version", "project", "role", "repository", "context"], label);
  if (route.version !== 1 || !slug.test(route.project ?? "") || !slug.test(route.role ?? "")) fail(`${label} has invalid identity`);
  assertKeys(route.repository, ["kind", "directory", "gitRepository", "branch"], `${label}.repository`);
  if (!["source", "sibling"].includes(route.repository.kind)) fail(`${label} has invalid repository kind`);
  if (!github.test(route.repository.gitRepository ?? "")) fail(`${label} requires a credential-free GitHub HTTPS URL`);
  if (typeof route.repository.branch !== "string" || route.repository.branch.length === 0) fail(`${label} requires a branch`);
  if (route.repository.kind === "source") {
    if (route.repository.directory !== null) fail(`${label} source route directory must be null`);
  } else {
    validateRelative(route.repository.directory, `${label}.repository.directory`);
  }
  assertKeys(route.context, ["instructions", "contract", "contractSource", "manifests", "grammar", "grammarProfile"], `${label}.context`);
  for (const [name, paths] of [["instructions", route.context.instructions], ["manifests", route.context.manifests]]) {
    if (!Array.isArray(paths)) fail(`${label}.context.${name} must be an array`);
    paths.forEach((path, index) => validateRelative(path, `${label}.context.${name}[${index}]`));
  }
  if (route.context.contract !== null) validateRelative(route.context.contract, `${label}.context.contract`);
  if ((route.context.contract === null) !== (route.context.contractSource === null)) fail(`${label} contract and contractSource must be null together`);
  const grammarNull = route.context.grammar === null;
  if (grammarNull !== (route.context.grammarProfile === null)) fail(`${label} grammar and grammarProfile must be null together`);
  if (!grammarNull && (!slug.test(route.context.grammar) || !slug.test(route.context.grammarProfile))) fail(`${label} has invalid grammar identity`);
  assertPublicationSafe(route, label);
  return route;
}

function git(repo, ...gitArgs) {
  try {
    return execFileSync("git", ["-C", repo, ...gitArgs], {encoding: "utf8", windowsHide: true}).trim();
  } catch {
    fail(`Git verification failed at ${repo}: git ${gitArgs.join(" ")}`);
  }
}

function normalizeRemote(url) {
  return url.trim().replace(/\.git$/i, "").replace(/\/$/, "").toLowerCase();
}

function portableRoots(source) {
  const root = join(source, ".workspaces");
  return {
    root,
    config: join(root, "config.json"),
    projects: join(root, "projects"),
    ports: join(root, "ports"),
    local: join(root, "local"),
    routes: join(root, "local", "routes"),
  };
}

function directories(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, {withFileTypes: true}).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

function files(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, {withFileTypes: true}).filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
}

function legacyRoutes(root) {
  const excluded = new Set(["cache", "credentials", "ports", "references", "local", "projects"]);
  const result = [];
  for (const project of directories(root).filter((name) => !excluded.has(name))) {
    for (const role of directories(join(root, project))) {
      const path = join(root, project, role, "config.json");
      if (existsSync(path)) result.push(path);
    }
  }
  return result;
}

function localRoutes(root) {
  const result = [];
  for (const project of directories(root)) {
    for (const role of directories(join(root, project))) {
      const path = join(root, project, role, "config.json");
      if (existsSync(path)) result.push(path);
    }
  }
  return result;
}

function compilePortableRoute(route, source, repositoriesRoot) {
  const repo = resolve(route.repository?.diskPath ?? "");
  if (!existsSync(repo)) fail(`${route.project}/${route.role} repository is absent: ${repo}`);
  const kind = samePath(repo, source) ? "source" : "sibling";
  const directory = kind === "source" ? null : portablePath(repositoriesRoot, repo, `${route.project}/${route.role} repository`);
  const relativeList = (paths, name) => (paths ?? []).map((path, index) => portablePath(repo, path, `${route.project}/${route.role} ${name}[${index}]`));
  const compiled = {
    $schema: "../../../.claude/platform/readiness/initialization/workspaces/portable-route.schema.json",
    version: 1,
    project: route.project,
    role: route.role,
    repository: {
      kind,
      directory,
      gitRepository: route.repository.gitRepository,
      branch: route.repository.branch,
    },
    context: {
      instructions: relativeList(route.context?.instructions, "instructions"),
      contract: route.context?.contract === null || route.context?.contract === undefined
        ? null
        : portablePath(repo, route.context.contract, `${route.project}/${route.role} contract`),
      contractSource: route.context?.contractSource ?? null,
      manifests: relativeList(route.context?.manifests, "manifests"),
      grammar: route.context?.grammar ?? null,
      grammarProfile: route.context?.grammarProfile ?? null,
    },
  };
  return validatePortableRoute(compiled, `${route.project}/${route.role}`);
}

function expectedExport({source, repositoriesRoot, inputRoot}) {
  const roots = portableRoots(source);
  const legacy = samePath(inputRoot, join(source, ".workspace"));
  const routeFiles = legacy ? legacyRoutes(inputRoot) : localRoutes(inputRoot);
  if (!routeFiles.length) fail(`no workspace routes found under ${inputRoot}`);
  const writes = new Map();
  const configPath = legacy ? join(inputRoot, "config.json") : roots.config;
  if (!existsSync(configPath)) fail(`workspace config is absent: ${configPath}`);
  const config = readJson(configPath);
  writes.set(roots.config, {$schema: "../.claude/knowledge/contexts/workspaces/config.schema.json", version: 1, defaultLang: config.defaultLang});
  for (const path of routeFiles) {
    const route = compilePortableRoute(readJson(path), source, repositoriesRoot);
    writes.set(join(roots.projects, route.project, `${route.role}.json`), route);
  }
  const portRoot = legacy ? join(inputRoot, "ports") : roots.ports;
  for (const name of files(portRoot).filter((file) => file.endsWith(".json"))) {
    const value = readJson(join(portRoot, name));
    assertPublicationSafe(value, `portable port declaration ${name}`);
    writes.set(join(roots.ports, name), value);
  }
  return writes;
}

function portableRouteFiles(projectsRoot) {
  const result = [];
  for (const project of directories(projectsRoot)) {
    for (const name of files(join(projectsRoot, project)).filter((file) => file.endsWith(".json"))) {
      result.push(join(projectsRoot, project, name));
    }
  }
  return result.sort();
}

function loadPortable(source) {
  const roots = portableRoots(source);
  if (!existsSync(roots.config)) fail(`portable workspace config is absent: ${roots.config}`);
  const config = readJson(roots.config);
  if (config.version !== 1 || typeof config.defaultLang !== "string") fail("portable workspace config is invalid");
  const routes = portableRouteFiles(roots.projects).map((path) => validatePortableRoute(readJson(path), slash(relative(source, path))));
  if (!routes.length) fail(`portable workspace declarations are absent under ${roots.projects}`);
  return {roots, config, routes};
}

function verifyRelativeFiles(repo, paths, label) {
  for (const path of paths) {
    const absolute = resolve(repo, path);
    if (!inside(repo, absolute)) fail(`${label} escapes repository: ${path}`);
    if (!existsSync(absolute)) fail(`${label} is absent: ${absolute}`);
  }
}

function expectedHydrate({source, repositoriesRoot}) {
  const {roots, routes} = loadPortable(source);
  const writes = new Map();
  for (const declaration of routes) {
    const repo = declaration.repository.kind === "source"
      ? source
      : resolve(repositoriesRoot, declaration.repository.directory);
    if (!existsSync(repo) || !statSync(repo).isDirectory()) fail(`${declaration.project}/${declaration.role} checkout is absent: ${repo}`);
    const gitRoot = git(repo, "rev-parse", "--show-toplevel");
    if (!samePath(gitRoot, repo)) fail(`${declaration.project}/${declaration.role} checkout is not its Git root: ${repo}`);
    const remote = git(repo, "remote", "get-url", "origin");
    if (normalizeRemote(remote) !== normalizeRemote(declaration.repository.gitRepository)) fail(`${declaration.project}/${declaration.role} origin mismatch`);
    const branch = git(repo, "branch", "--show-current");
    if (branch !== declaration.repository.branch) fail(`${declaration.project}/${declaration.role} branch mismatch: expected ${declaration.repository.branch}, observed ${branch}`);
    const context = declaration.context;
    verifyRelativeFiles(repo, context.instructions, `${declaration.project}/${declaration.role} instruction`);
    verifyRelativeFiles(repo, context.manifests, `${declaration.project}/${declaration.role} manifest`);
    if (context.contract !== null) verifyRelativeFiles(repo, [context.contract], `${declaration.project}/${declaration.role} contract`);
    if (context.grammar !== null) {
      const grammarRoot = join(source, ".claude", "knowledge", "grammars", context.grammar);
      if (!existsSync(join(grammarRoot, "grammar.json")) || !existsSync(join(grammarRoot, "profiles", `${context.grammarProfile}.json`))) {
        fail(`${declaration.project}/${declaration.role} grammar/profile is absent`);
      }
    }
    const absoluteList = (paths) => paths.map((path) => resolve(repo, path));
    const route = {
      $schema: "../../../../../.claude/knowledge/contexts/workspaces/schema.json",
      version: 1,
      project: declaration.project,
      role: declaration.role,
      source: {
        path: source,
        trust: join(source, ".claude"),
        skills: join(source, ".claude", "skills"),
        workspaceRoot: roots.root,
      },
      repository: {
        diskPath: repo,
        gitRoot: repo,
        gitRepository: declaration.repository.gitRepository,
        branch,
        head: git(repo, "rev-parse", "HEAD"),
      },
      context: {
        instructions: absoluteList(context.instructions),
        contract: context.contract === null ? null : resolve(repo, context.contract),
        contractSource: context.contractSource,
        manifests: absoluteList(context.manifests),
        grammar: context.grammar,
        grammarProfile: context.grammarProfile,
      },
      updatedAt: new Date().toISOString(),
    };
    writes.set(join(roots.routes, declaration.project, declaration.role, "config.json"), route);
  }
  return writes;
}

function differences(writes, ignoreUpdatedAt = false) {
  const changed = [];
  for (const [path, expected] of writes) {
    if (!existsSync(path)) {
      changed.push(path);
      continue;
    }
    const actual = readJson(path);
    if (ignoreUpdatedAt) {
      delete actual.updatedAt;
      const comparable = structuredClone(expected);
      delete comparable.updatedAt;
      if (JSON.stringify(actual) !== JSON.stringify(comparable)) changed.push(path);
    } else if (JSON.stringify(actual) !== JSON.stringify(expected)) changed.push(path);
  }
  return changed;
}

function applyWrites(writes) {
  for (const [path, value] of writes) {
    mkdirSync(dirname(path), {recursive: true});
    writeFileSync(path, stableJson(value), "utf8");
  }
}

function main() {
  if (!["export", "hydrate", "check"].includes(command)) {
    console.error("Usage: workspace-portable.mjs <export|hydrate|check> --source <Source> [--repositories-root <path>] [--legacy-root <path>] [--plan|--apply]");
    return 2;
  }
  const source = resolve(value("--source") ?? defaultSource);
  const repositoriesRoot = resolve(value("--repositories-root") ?? dirname(source));
  const mode = has("--apply") ? "apply" : "plan";
  if (command === "export") {
    const inputRoot = resolve(value("--legacy-root") ?? join(source, ".workspaces", "local", "routes"));
    const writes = expectedExport({source, repositoriesRoot, inputRoot});
    const changed = differences(writes);
    console.log(`portable workspace export: ${writes.size} files, ${changed.length} changes`);
    changed.forEach((path) => console.log(`change: ${slash(relative(source, path))}`));
    if (mode === "apply") applyWrites(writes);
    return 0;
  }
  const writes = expectedHydrate({source, repositoriesRoot});
  const changed = differences(writes, true);
  console.log(`portable workspace hydrate: ${writes.size} routes, ${changed.length} changes`);
  changed.forEach((path) => console.log(`change: ${slash(relative(source, path))}`));
  if (command === "hydrate" && mode === "apply") applyWrites(writes);
  if (command === "check" && changed.length) return 1;
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
