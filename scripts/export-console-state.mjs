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
// `--stale` reports instead of writing: one rollup per project, with the reason and the skill that
// clears it. Exit 1 when anything is stale, so the same scan is usable from a shell that checks.
const staleOnly = args.includes("--stale");
if (!staleOnly && (!args.includes("--out") || !out)) {
  console.error("usage: export-console-state.mjs --out <console-checkout>/public/state.json");
  console.error("       export-console-state.mjs --stale");
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

// Can the checkout still reach this commit? Two different failures answer no — the object is gone, or it
// sits on a history this branch no longer contains — and both mean the route names a commit that is not
// there any more. A commit the checkout has simply moved past is reachable, and that is not a failure.
const reachable = (cwd, commit) =>
  git(cwd, "cat-file", "-e", `${commit}^{commit}`) !== null && git(cwd, "merge-base", "--is-ancestor", commit, "HEAD") !== null;

// The lint machines are a published dependency, so a checkout enforces the laws only if it installs them.
// A copy vendored into the repository is worse than none: it is a second home for a law, it drifts the day
// the tree changes, and nothing in the repository can tell it has drifted.
const CANON_PACKAGES = /eslint-canon-(fe|be)$/;
const ESLINT_CONFIGS = ["eslint.config.mjs", "eslint.config.js", "eslint.config.cjs", ".eslintrc.json", ".eslintrc.js"];

function readMachine(diskPath) {
  const manifest = join(diskPath, "package.json");
  if (!existsSync(manifest)) return null;
  let deps = {};
  try {
    const json = JSON.parse(readFileSync(manifest, "utf8"));
    deps = {...json.dependencies, ...json.devDependencies};
  } catch {
    return {installed: [], vendored: null, verdict: "unreadable manifest"};
  }
  const installed = Object.keys(deps).filter((name) => CANON_PACKAGES.test(name));
  const config = ESLINT_CONFIGS.map((name) => join(diskPath, name)).find(existsSync) ?? null;
  let vendored = null;
  if (config) {
    const text = readFileSync(config, "utf8");
    const local = text.match(/from\s+"(\.[^"]*eslint-canon[^"]*)"/) ?? text.match(/require\("(\.[^"]*eslint-canon[^"]*)"\)/);
    if (local) vendored = local[1];
  }
  const verdict = vendored ? "vendored" : installed.length ? "installed" : config ? "absent" : "no eslint config";
  return {installed, vendored, config, verdict};
}

const dirs = (path) => (existsSync(path) ? readdirSync(path, {withFileTypes: true}).filter((e) => e.isDirectory()).map((e) => e.name) : []);
const countFiles = (path) => (existsSync(path) ? readdirSync(path).filter((n) => n.endsWith(".json")).length : 0);

// A `.claude/` inside a target checkout is what an older tree left behind, and nothing in that repository
// will ever report it — so it is counted here. The Source itself is excluded by path: its `.claude` is the
// tree. Count recursively, because a shallow listing calls a populated directory empty, and count tracked
// files separately, because those are the product's own committed state and not this tree's to remove.
function readRemnant(diskPath) {
  const path = join(diskPath, ".claude");
  if (resolve(diskPath) === resolve(source) || !existsSync(path)) return null;
  const walk = (dir) => dirs(dir).map((name) => join(dir, name)).flatMap(walk).concat(readdirSync(dir, {withFileTypes: true}).filter((e) => e.isFile()).map((e) => join(dir, e.name)));
  const files = walk(path);
  const tracked = (git(diskPath, "ls-files", "--", ".claude") ?? "").split("\n").filter(Boolean);
  return {path, files: files.length, tracked: tracked.length};
}

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
      const branch = config.repository?.branch ?? null;
      const liveBranch = diskPathExists ? git(diskPath, "branch", "--show-current") : null;

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
      } else if (recordedHead && liveHead && recordedHead !== liveHead && !reachable(diskPath, recordedHead)) {
        // `WORKSPACE-5`: stale is a recorded value the machine no longer matches — here, a head the
        // checkout cannot reach, so the route names a commit that is gone.
        verdict = "stale";
        reason = "recorded head is not reachable from the checkout — the branch was rewritten under it";
      } else if (branch && liveBranch && branch !== liveBranch) {
        verdict = "stale";
        reason = `route records branch ${branch}; the checkout is on ${liveBranch}`;
      } else if (!contract && role === "fe" && !/^discovered:none\b/.test(config.context?.contractSource ?? "")) {
        // A null contract on a frontend role is a finding by default — most of the time it means
        // nobody has looked yet, and a monorepo hides the registry from a one-app convention. But a
        // search that genuinely found nothing is a different fact from a search that never ran, and
        // this route has no way to say which unless contractSource records it. `discovered:none` is
        // that record: it names the search as done, not skipped, so this project stops being flagged
        // every scan while a registry that doesn't exist keeps not existing.
        verdict = "stale";
        reason = "frontend role with no contract recorded — look for the registry before trusting this";
      }

      // Not a route verdict: the route is fine and the source may be green. It is a warning because the
      // only thing it breaks is a later reader's belief that this project owns rules of its own.
      const remnant = diskPathExists ? readRemnant(diskPath) : null;
      if (remnant) {
        warnings.push(`${project}/${role}: ${remnant.path} is a leftover tree — ${remnant.files} file(s), ${remnant.tracked} tracked → starci-repair, the remnant pass${remnant.tracked > 0 ? " (tracked files return to the owner)" : ""}`);
      }

      const machine = diskPathExists ? readMachine(diskPath) : null;

      rows.push({project, role, route, diskPath, diskPathExists, contract, contractExists, contractSource: config.context?.contractSource ?? null, branch: config.repository?.branch ?? null, recordedHead, liveHead, verdict, reason, remnant, machine});
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

// Both roots are folders of this one Source, one per project, so the two lists should agree and often do
// not. Say the path, or a missing folder reads as a missing second tree; say the condition, or a folder
// nobody needs yet reads as a fault.
for (const project of new Set(workspaces.map((w) => w.project))) {
  if (!projects.some((p) => p.project === project)) warnings.push(`${project}: no .worktrees/${project}/ in this Source — needed only once a skill records a decision for it`);
}
for (const {project} of projects) {
  if (!workspaces.some((w) => w.project === project)) warnings.push(`${project}: .worktrees/${project}/ exists in this Source but .workspace/${project}/ does not — no source to read`);
}

const state = {
  scannedAt: statSync(fileURLToPath(import.meta.url)).mtime.toISOString(),
  source,
  workspaces,
  projects,
  warnings,
};

// The contract layer, measured without running anything: parse the entry table the route names and
// classify it. Cheap enough to always run, and it answers the question a red gate cannot — whether the
// index a lookup matches on is findable at all.
function readContractHealth(row) {
  if (!row.contract || !row.contractExists) return null;
  let text;
  try {
    text = readFileSync(row.contract, "utf8");
  } catch {
    return null;
  }
  const keys = [...text.matchAll(/^\s{4}"([a-z0-9-]+)":/gm)].map((m) => m[1]);
  const whys = [...text.matchAll(/why: "([^"]{8,})"/g)].map((m) => m[1]);
  const pages = keys.filter((k) => k.endsWith("-page"));
  const featured = keys.filter((k) => !k.endsWith("-page") && /^(flashcard|profile|course|learn|playground|personal|coding|billing|auth|weekly|mock|fleet)-/.test(k));
  // A `why` that starts by describing states a shape; one that starts with a condition states a need,
  // which is the only form a later lookup can match.
  // "if you need X" is the canonical phrasing, but "Use when you need X" and "Reach for this when
  // you need X" carry the same need-condition one clause later — a reader who only matched sentences
  // that OPEN with the trigger word missed the two phrasings real authors actually use.
  const needShaped = whys.filter((w) => /^(if |when |a reader |the reader |use (this |it )?when you need|reach for (this|it) (when|if) you need)/i.test(w)).length;
  return {
    entries: keys.length,
    pages: pages.length,
    featurePrefixed: featured.length,
    reasons: whys.length,
    needShaped,
    describing: whys.length - needShaped,
  };
}

// Which skill clears which reason. A list of problems with no owner is a list nobody acts on, and
// guessing the owner is how a route problem gets sent to a repair run.
function clearedBy(reason) {
  if (/head is behind/.test(reason)) return "starci-init — refresh the route's recorded head";
  if (/not on this disk|no longer exists/.test(reason)) return "starci-init — the checkout moved; repoint or restore it";
  if (/no contract recorded/.test(reason)) return "starci-init — declare the contract path; in a monorepo it is not where a one-app convention looks";
  if (/no config.json/.test(reason)) return "starci-init — the role has no route on this machine";
  return "starci-init";
}

if (staleOnly) {
  const byProject = new Map();
  for (const row of workspaces) {
    if (row.verdict === "ok") continue;
    const rows = byProject.get(row.project) ?? [];
    rows.push(row);
    byProject.set(row.project, rows);
  }

  const clean = workspaces.filter((w) => w.verdict === "ok").length;
  console.log(`${workspaces.length} route(s) across ${new Set(workspaces.map((w) => w.project)).size} project(s) — ${clean} ok, ${workspaces.length - clean} stale\n`);

  if (byProject.size === 0) {
    console.log("no project is stale");
  } else {
    for (const [project, rows] of [...byProject.entries()].sort()) {
      console.log(`${project}`);
      for (const row of rows) {
        console.log(`  ${row.role.padEnd(9)} ${row.verdict.padEnd(7)} ${row.reason}`);
        console.log(`  ${" ".repeat(9)} ${" ".repeat(7)} → ${clearedBy(row.reason)}`);
      }
      console.log("");
    }
  }

  // The contract layer. Not a route problem and not repaired by refreshing one: an index nobody can
  // search means the next design run writes an entry that already exists.
  let indexDebt = 0;
  const contracts = workspaces.map((row) => [row, readContractHealth(row)]).filter(([, health]) => health);
  if (contracts.length > 0) {
    console.log("contract index:");
    for (const [row, health] of contracts) {
      const describing = health.describing;
      indexDebt += describing;
      console.log(`  ${row.project}/${row.role}  ${health.entries} entries · ${health.pages} page keys · ${health.featurePrefixed} feature-prefixed`);
      console.log(`  ${" ".repeat((row.project + "/" + row.role).length)}  ${health.reasons} reasons · ${health.needShaped} state a need · ${describing} describe a shape`);
      if (describing > 0) console.log(`  ${" ".repeat((row.project + "/" + row.role).length)}  → starci-repair, the \`why\` pass — a reason that describes is findable only by somebody who already knows it`);
    }
    console.log("");
  }

  // The machine layer. A gate is only law where the machine that fires it is installed; a mirrored copy
  // enforces whatever it was on the day it was copied.
  let machineDebt = 0;
  const machines = workspaces.filter((row) => row.machine && row.machine.verdict !== "no eslint config");
  if (machines.length > 0) {
    console.log("lint machine:");
    for (const row of machines) {
      const {verdict, installed, vendored} = row.machine;
      const detail = verdict === "installed" ? installed.join(", ")
        : verdict === "vendored" ? `config imports ${vendored} — a copy of the law lives in the repository`
        : "no eslint-canon package in the manifest, so no law here is enforced";
      console.log(`  ${row.project}/${row.role}  ${verdict}  ${detail}`);
      if (verdict !== "installed") {
        machineDebt += 1;
        console.log(`  ${" ".repeat((row.project + "/" + row.role).length)}  → starci-repair — install the published package; a rule is never authored into a target`);
      }
    }
    console.log("");
  }

  if (warnings.length > 0) {
    console.log(`${warnings.length} warning(s) that are not a route:`);
    for (const warning of warnings) console.log(`  - ${warning}`);
    console.log("");
  }

  // Say which layers ran. A list that silently skipped the expensive one reads as "nothing else is
  // wrong", which is the one thing a report must never imply.
  console.log("layers measured: route (filesystem + git) · contract index (parsed) · lint machine (manifest + config)");
  console.log("layers NOT measured: lint, typecheck, build, tests — they belong to starci-repair, which");
  console.log("  runs the repository's own gates and writes build output while doing it.");

  process.exit(byProject.size > 0 || indexDebt > 0 || machineDebt > 0 ? 1 : 0);
}

await mkdir(dirname(resolve(out)), {recursive: true});
await writeFile(resolve(out), JSON.stringify(state, null, 2) + "\n", "utf8");
console.log(`wrote ${resolve(out)} — ${workspaces.length} route(s), ${projects.length} project(s), ${warnings.length} warning(s)`);
