// Scan this machine's workspace routes, design registries and sessions, and write what the console
// renders. Read-only: it opens no editor, writes no route, prunes nothing.
//
//   node .claude/scripts/export-console-state.mjs --out <console-checkout>/public/state.json
//
// The output path is required rather than guessed, because guessing it would mean this tree carrying a
// disk path — true on one machine, wrong on every other.

import {execFileSync} from "node:child_process";
import {existsSync, readdirSync, readFileSync, statSync} from "node:fs";
import {mkdir, writeFile} from "node:fs/promises";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const args = process.argv.slice(2);
const out = args[args.indexOf("--out") + 1];
if (!args.includes("--out") || !out) {
  console.error("usage: export-console-state.mjs --out <console-checkout>/public/state.json");
  process.exit(2);
}

const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(trustRoot, "..");
const warnings = [];

const git = (cwd, ...rest) => {
  try {
    return execFileSync("git", ["-C", cwd, ...rest], {encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]}).trim();
  } catch {
    return null;
  }
};

const dirs = (path) => (existsSync(path) ? readdirSync(path, {withFileTypes: true}).filter((e) => e.isDirectory()).map((e) => e.name) : []);
const countFiles = (path) => (existsSync(path) ? readdirSync(path).filter((n) => n.endsWith(".json")).length : 0);

function readWorkspaces() {
  const root = join(source, ".workspace");
  const rows = [];
  for (const project of dirs(root)) {
    for (const role of dirs(join(root, project))) {
      const route = join(root, project, role, "config.json");
      if (!existsSync(route)) {
        rows.push({project, role, route, diskPath: null, diskPathExists: false, contract: null, contractExists: false, contractSource: null, branch: null, recordedHead: null, liveHead: null, verdict: "absent", reason: "no config.json at the route"});
        continue;
      }
      let config;
      try {
        config = JSON.parse(readFileSync(route, "utf8"));
      } catch (error) {
        warnings.push(`${project}/${role}: route is not valid JSON — ${error.message}`);
        continue;
      }
      const diskPath = config.repository?.diskPath ?? null;
      const contract = config.context?.contract ?? null;
      const diskPathExists = Boolean(diskPath && existsSync(diskPath));
      const contractExists = Boolean(contract && existsSync(contract));
      const recordedHead = config.repository?.head ?? null;
      const liveHead = diskPathExists ? git(diskPath, "rev-parse", "--short=12", "HEAD") : null;

      // Parsing is not verifying: a route whose fields are all well formed and whose paths no longer
      // resolve is stale, and stale is a different verdict from absent.
      let verdict = "ok";
      let reason = "checkout and recorded evidence still hold";
      if (!diskPathExists) {
        verdict = "stale";
        reason = "recorded checkout is not on this disk";
      } else if (contract && !contractExists) {
        verdict = "stale";
        reason = "recorded contract path no longer exists";
      } else if (recordedHead && liveHead && recordedHead !== liveHead) {
        verdict = "stale";
        reason = "recorded head is behind the checkout";
      } else if (!contract && role === "fe") {
        verdict = "stale";
        reason = "frontend role with no contract recorded — look for the registry before trusting this";
      }

      rows.push({project, role, route, diskPath, diskPathExists, contract, contractExists, contractSource: config.context?.contractSource ?? null, branch: config.repository?.branch ?? null, recordedHead, liveHead, verdict, reason});
    }
  }
  return rows;
}

// One row per artifact actually on disk. A count answers "is there anything?"; a reader opening a
// registry is asking "what, exactly?" — and the answer has to be files, not a number.
function readEntries(registries) {
  const rows = [];
  for (const kind of ["layouts", "blocks"]) {
    for (const state of ["queued", "approved", "rejected"]) {
      const dir = join(registries, kind, state);
      if (!existsSync(dir)) continue;
      for (const name of readdirSync(dir)) {
        if (!name.endsWith(".json")) continue;
        const path = join(dir, name);
        let hash = null;
        let surface = null;
        let members = null;
        try {
          const data = JSON.parse(readFileSync(path, "utf8"));
          hash = data.hash ?? data.chosen?.hash ?? null;
          surface = data.envelope?.surface ?? data.envelope?.region ?? data.surface ?? null;
          members = Array.isArray(data.candidates) ? data.candidates.length : Array.isArray(data.anatomies) ? data.anatomies.length : null;
        } catch {
          warnings.push(`unreadable artifact in the registry: ${path}`);
        }
        rows.push({kind, state, file: name, hash, surface, members, bytes: statSync(path).size, changedAt: statSync(path).mtime.toISOString()});
      }
    }
  }
  return rows;
}

// The map files are the registry's own index. Reading them raw is deliberate: a console that
// summarises an index can disagree with it, and then two things claim to know the current head.
function readMaps(registries) {
  const maps = [];
  for (const kind of ["layouts", "blocks"]) {
    const dir = join(registries, kind, "map");
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      try {
        maps.push({kind, file: name, content: JSON.parse(readFileSync(join(dir, name), "utf8"))});
      } catch {
        warnings.push(`unreadable map in the registry: ${join(dir, name)}`);
      }
    }
  }
  return maps;
}

function readRegistry(project, root) {
  const registries = join(root, "registries");
  if (!existsSync(registries)) return null;
  const list = git(source, "worktree", "list") ?? "";
  const line = list.split("\n").find((l) => l.replaceAll("\\", "/").includes(`worktrees/${project}/registries`)) ?? "";
  const entries = readEntries(registries);
  const count = (kind, state) => entries.filter((e) => e.kind === kind && e.state === state).length;
  return {
    branch: line.match(/\[([^\]]+)\]/)?.[1] ?? null,
    locked: line.includes("locked"),
    clean: (git(registries, "status", "--porcelain") ?? "") === "",
    ownedHere: line !== "",
    head: git(registries, "rev-parse", "--short=12", "HEAD"),
    lastCommit: git(registries, "log", "-1", "--pretty=%s") ?? null,
    counts: {
      layoutsQueued: count("layouts", "queued"),
      layoutsApproved: count("layouts", "approved"),
      layoutsRejected: count("layouts", "rejected"),
      blocksQueued: count("blocks", "queued"),
      blocksApproved: count("blocks", "approved"),
      blocksRejected: count("blocks", "rejected"),
    },
    entries,
    maps: readMaps(registries),
    decisions: existsSync(join(registries, "decisions")) ? readdirSync(join(registries, "decisions")).filter((n) => n.endsWith(".json") || n.endsWith(".md")) : [],
    rejections: existsSync(join(registries, "rejections")) ? readdirSync(join(registries, "rejections")).filter((n) => n.endsWith(".json") || n.endsWith(".md")) : [],
  };
}

// A session is any JSON in the registry that carries a surface and rounds — the shape
// skills/skill-shape/session.schema.json describes. Anything else in there is not a session.
function readSessions(root) {
  const registries = join(root, "registries");
  const found = [];
  const walk = (path, depth) => {
    if (depth > 3 || !existsSync(path)) return;
    for (const entry of readdirSync(path, {withFileTypes: true})) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== ".git") walk(child, depth + 1);
        continue;
      }
      if (!entry.name.endsWith(".json")) continue;
      try {
        const data = JSON.parse(readFileSync(child, "utf8"));
        if (!data || typeof data !== "object" || !data.surface || !Array.isArray(data.rounds)) continue;
        found.push({
          id: data.id ?? entry.name,
          file: child,
          surface: data.surface,
          phase: data.phase ?? "unknown",
          rounds: data.rounds.length,
          acceptedHashes: data.rounds.flatMap((r) => (r.verdict?.acceptedHash ? [r.verdict.acceptedHash] : [])),
          queued: Array.isArray(data.queue) ? data.queue : [],
          // The rounds themselves, because the point of an append-only record is that a reader can
          // see what was proposed and refused, not only what survived.
          history: data.rounds.map((r, index) => ({
            number: r.number ?? index + 1,
            phase: r.phase ?? "unknown",
            region: r.region ?? null,
            prompt: r.prompt ?? "",
            produced: Array.isArray(r.produced) ? r.produced : [],
            refusal: r.refusal ?? null,
            state: r.verdict?.state ?? "pending",
            acceptedHash: r.verdict?.acceptedHash ?? null,
            rejected: Array.isArray(r.verdict?.rejected) ? r.verdict.rejected : [],
          })),
        });
      } catch {
        warnings.push(`unreadable json in the registry: ${child}`);
      }
    }
  };
  walk(registries, 0);
  return found;
}

const projects = dirs(join(source, ".worktrees")).map((project) => {
  const root = join(source, ".worktrees", project);
  const roots = {
    registries: existsSync(join(root, "registries")),
    sessions: existsSync(join(root, "sessions")),
    cache: existsSync(join(root, "cache")),
  };
  return {project, root, roots, registry: readRegistry(project, root), sessions: readSessions(root)};
});

const workspaces = readWorkspaces();

// Two lists that should agree and often do not: a project with a route but no worktree cannot record a
// decision, and a project with a worktree but no route cannot read any source.
for (const project of new Set(workspaces.map((w) => w.project))) {
  if (!projects.some((p) => p.project === project)) warnings.push(`${project}: has a workspace route but no worktree root — nothing can be recorded`);
}
for (const {project} of projects) {
  if (!workspaces.some((w) => w.project === project)) warnings.push(`${project}: has a worktree root but no workspace route — nothing can be read`);
}
if (!existsSync(join(source, ".workflows"))) warnings.push("the workflow root is absent, so no skill can append its phase");

const state = {
  scannedAt: statSync(fileURLToPath(import.meta.url)).mtime.toISOString(),
  source,
  workspaces,
  projects,
  warnings,
};

await mkdir(dirname(resolve(out)), {recursive: true});
await writeFile(resolve(out), JSON.stringify(state, null, 2) + "\n", "utf8");
console.log(`wrote ${resolve(out)} — ${workspaces.length} route(s), ${projects.length} project(s), ${warnings.length} warning(s)`);
