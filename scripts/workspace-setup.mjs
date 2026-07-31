#!/usr/bin/env node
/**
 * workspace-setup.mjs — register which FE and BE source this machine is pointed at,
 * and write the answer to `.context/workspace.json` (gitignored, per machine).
 *
 * WHY THIS EXISTS
 * This skill set is meant to be shared across projects, not welded to one. Two different
 * things vary and both used to be written into the documents:
 *
 *   per machine   where the trees sit — `C:/Repositories/x` here, `D:/Repositories/x` there
 *   per project   which trees they even are — a different app has a different FE and BE
 *
 * A path or a repo name inside a skill is therefore wrong twice over. Nothing here knows the
 * name of any particular app: a tree is described by its ROLE (`fe`, `be`), its role is read
 * off its real dependencies, and the answer lives in a file that never travels.
 *
 * WHAT IT REFUSES TO DO
 * It never guesses between two candidates. When more than one repo could be the FE, it stops
 * and prints each with its branch and last commit, because a clone weeks behind reads exactly
 * like the live one and every conclusion drawn from it is wrong while looking sound.
 *
 * USAGE
 *   node scripts/workspace-setup.mjs --fe <path> --be <path> [--project <name>]
 *   node scripts/workspace-setup.mjs                          detect, if it is unambiguous
 *   node scripts/workspace-setup.mjs --use <name>             switch to a registered project
 *   node scripts/workspace-setup.mjs --list                   what is registered
 *   node scripts/workspace-setup.mjs --check                  is the current record still true
 *   node scripts/workspace-setup.mjs --dry                    print, write nothing
 *
 * Either role may be omitted — a front-end-only project registers `--fe` alone.
 *
 * EXIT CODES
 *   0  the current project resolved
 *   1  ambiguous, unresolved, or a recorded path has moved
 *
 * Read it back with `scripts/workspace.mjs`, never by parsing this script's output.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, basename, parse as parsePath } from "node:path";

/** Root of this skill set — the folder holding `scripts/`, `design/`, `.context/`. */
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The repo this skill set was cloned into, if any. A free candidate that needs no searching. */
const HOME_TREE = resolve(REPO, "..");

const CONTEXT_DIR = join(REPO, ".context");
const CONTEXT_FILE = join(CONTEXT_DIR, "workspace.json");

/**
 * How a role is recognised — by what the repo actually depends on, never by its name.
 *
 * `deps`    any one of these in dependencies or devDependencies marks the role
 * `label`   what to call it to a human
 * `markers` optional folders worth recording when present; absence is not disqualifying,
 *           because another project may organise itself differently and still be an FE
 */
const ROLES = {
    fe: {
        label: "front end",
        deps: ["next", "vite", "react-scripts", "@remix-run/react", "nuxt", "@angular/core"],
        markers: { design_system: ".storybook", artifacts: ".artifacts" },
    },
    be: {
        label: "back end",
        deps: ["@nestjs/core", "express", "fastify", "koa", "@hapi/hapi"],
        markers: {},
    },
};

// ---- arguments -----------------------------------------------------------

const argv = process.argv.slice(2);

/**
 * Read `--name value` off the command line.
 * @param {string} name flag name without the leading dashes
 * @returns {string|true|null} the value, `true` if passed bare, `null` if absent
 */
const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : argv[i + 1] ?? true;
};

const CHECK = argv.includes("--check");
const DRY = argv.includes("--dry");
const LIST = argv.includes("--list");

// ---- reading a repo ------------------------------------------------------

/**
 * Parse a folder's package.json.
 * @param {string} dir folder to look in
 * @returns {object|null} the parsed manifest, or null if absent or malformed
 */
const manifest = (dir) => {
    const p = join(dir, "package.json");
    if (!existsSync(p)) return null;
    // A half-written manifest must not abort a whole sweep.
    try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
};

/**
 * Does this folder look like the given role?
 *
 * The test is the dependency list, because that is the one thing that cannot be renamed
 * without changing what the repo IS. A folder called `shop-web` and a folder called
 * `starci-academy` both depend on `next`, and that is exactly the point.
 *
 * @param {string} dir folder to test
 * @param {{deps: string[]}} role entry from ROLES
 * @returns {string|null} the dependency that matched, or null
 */
const roleOf = (dir, role) => {
    const m = manifest(dir);
    if (!m) return null;
    const deps = { ...(m.dependencies ?? {}), ...(m.devDependencies ?? {}) };

    // A server dependency settles the question. Build tooling travels — this backend carries
    // `vite` to build an internal dashboard, and without this line it matched the front-end
    // role and both roles resolved to the same folder while reporting success.
    if (role !== ROLES.be && ROLES.be.deps.some((d) => d in deps)) return null;

    return role.deps.find((d) => d in deps) ?? null;
};

/** Folders never worth descending into — build output and vendor dumps, plus the cost sink. */
const SKIP = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".mount", ".turbo"]);

/**
 * Yield every directory under `root`, depth-capped.
 * The cap is what keeps this bounded: repos sit a folder or two under a workspace root, so
 * depth 2 finds them without ever walking a whole drive.
 * @param {string} root where to start
 * @param {number} depth levels left to descend
 */
function* walk(root, depth) {
    if (depth < 0 || !existsSync(root)) return;
    let entries;
    // A permission-denied folder is ordinary on Windows; skip it rather than dying.
    try { entries = readdirSync(root, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
        if (!e.isDirectory() || SKIP.has(e.name)) continue;
        const full = join(root, e.name);
        yield full;
        yield* walk(full, depth - 1);
    }
}

// ---- git facts, used to tell two clones apart ----------------------------

/**
 * Run git in a folder and return trimmed stdout, or null.
 * Null is an ordinary answer here — "not a git repo" is not a failure.
 * @param {string} dir repo folder
 * @param {string[]} args arguments after `-C <dir>`
 * @returns {string|null}
 */
const git = (dir, args) => {
    try {
        return execFileSync("git", ["-C", dir, ...args], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    } catch { return null; }
};

/** @returns {string|null} checked-out branch */
const gitBranch = (dir) => git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);

/** @returns {string|null} origin URL — proof that two folders are clones of one repo */
const gitRemote = (dir) => git(dir, ["remote", "get-url", "origin"]);

/**
 * Hash, date and subject of the last commit — the line that lets a human tell a live clone
 * from an abandoned one, which is why the ambiguous case is reported rather than resolved.
 * @returns {string|null}
 */
const headLine = (dir) => git(dir, ["log", "-1", "--format=%h %ad %s", "--date=short"])?.slice(0, 72) ?? null;

// ---- ports, read out of the repo rather than assumed ---------------------

/**
 * Pull `-p 6006` or `--port=6006` out of an npm script line.
 * @param {string|undefined} s the script body
 * @returns {number|null}
 */
const scriptPort = (s) => {
    const m = /(?:-p|--port)[= ](\d+)/.exec(s ?? "");
    return m ? Number(m[1]) : null;
};

/** Framework defaults, used only when the repo states no port of its own. */
const FRAMEWORK_DEFAULT = { next: 3000, nuxt: 3000, vite: 5173, "react-scripts": 3000, "@angular/core": 4200 };

/**
 * Work out the front end's dev and Storybook ports.
 * Reading beats assuming: if someone moves a port, this keeps up, whereas a constant here
 * would quietly become a second and wronger place where the truth is written down.
 *
 * @param {string} dir the FE tree
 * @param {string|null} framework the dependency that identified the role
 * @returns {{dev: number|null, storybook: number|null, source: string}}
 */
function fePorts(dir, framework) {
    const m = manifest(dir);
    const scripts = m?.scripts ?? {};

    const declared = scriptPort(scripts.dev) ?? scriptPort(scripts.start);
    const fallback = FRAMEWORK_DEFAULT[framework] ?? null;

    return {
        dev: declared ?? fallback,
        storybook: scriptPort(scripts.storybook),
        source: declared
            ? "package.json scripts"
            : `package.json scripts; dev port is ${framework ?? "the framework"}'s default`,
    };
}

/**
 * Work out the back end's HTTP port.
 * `.env` wins over the code default, because overriding the default is exactly what it is for.
 *
 * @param {string} dir the BE tree
 * @returns {{port: number|null, source: string|null}}
 */
function bePort(dir) {
    // Common names, in the order a project is likely to mean them.
    const KEYS = ["CORE_PORT", "PORT", "APP_PORT", "HTTP_PORT", "SERVER_PORT"];

    for (const envFile of [".env", ".env.override", ".env.local", ".env.development"]) {
        const f = join(dir, envFile);
        if (!existsSync(f)) continue;
        const text = readFileSync(f, "utf8");
        for (const key of KEYS) {
            const m = new RegExp(`^\\s*${key}\\s*=\\s*(\\d+)`, "m").exec(text);
            if (m) return { port: Number(m[1]), source: `${key} in ${envFile}` };
        }
    }

    // Nothing set locally, so whatever the code defaults to is what will actually be served.
    // Only config-shaped files are read; scanning a whole src tree would be slow and noisy.
    for (const rel of ["src/modules/env/config.ts", "src/config/configuration.ts", "src/config.ts", "src/main.ts"]) {
        const f = join(dir, rel);
        if (!existsSync(f)) continue;
        const text = readFileSync(f, "utf8");
        for (const key of KEYS) {
            const m = new RegExp(`${key}[\\s\\S]{0,120}?defaultValue:\\s*(\\d+)`).exec(text)
                ?? new RegExp(`${key}[^\\n]{0,40}?\\|\\|\\s*(\\d+)`).exec(text)
                ?? new RegExp(`${key}[^\\n]{0,40}?\\?\\?\\s*(\\d+)`).exec(text);
            if (m) return { port: Number(m[1]), source: `${key} default in ${rel}` };
        }
    }

    return { port: null, source: null };
}

// ---- locating a tree -----------------------------------------------------

/**
 * Find one tree, in order of how far the answer can be trusted:
 *   1. `--fe` / `--be` — a human said so
 *   2. `STARCI_FE` / `STARCI_BE` — this machine always says so
 *   3. the repo this skill set sits inside
 *   4. a depth-capped sweep of the ancestor folders
 *
 * @param {"fe"|"be"} key which role
 * @returns {{path: string|null, how: string, matched?: string|null,
 *            candidates?: Array<{path: string, branch: string|null, head: string|null}>}}
 */
function locate(key) {
    const role = ROLES[key];

    // 1. Stated outright. Still verified — a typo should say so rather than be recorded.
    const explicit = flag(key);
    if (typeof explicit === "string") {
        const dir = resolve(explicit);
        if (!existsSync(dir)) return { path: null, how: `--${key} pointed at ${dir}, which does not exist` };
        const matched = roleOf(dir, role);
        // A stated path is honoured even when nothing matched: the human may be pointing at a
        // stack this script has never heard of, and refusing would make the flag useless.
        return {
            path: dir,
            matched,
            how: matched ? `stated with --${key} (depends on ${matched})` : `stated with --${key} (role not auto-confirmed)`,
        };
    }

    // 2. Pinned in the environment, for a machine that always answers the same way.
    const env = process.env[`STARCI_${key.toUpperCase()}`];
    if (env && existsSync(resolve(env))) {
        const dir = resolve(env);
        return { path: dir, matched: roleOf(dir, role), how: `environment variable STARCI_${key.toUpperCase()}` };
    }

    // 3. This script may live inside one of the trees, which makes that one free.
    const here = roleOf(HOME_TREE, role);
    if (here) return { path: HOME_TREE, matched: here, how: `the tree this skill set is cloned into (depends on ${here})` };

    // 4. Sweep upward — the workspace folder, then its parent — never a drive root.
    const roots = [];
    let cur = HOME_TREE;
    while (true) {
        roots.push(cur);
        const up = dirname(cur);
        if (up === cur) break;
        cur = up;
    }

    // Collect EVERY match rather than returning the first: the first is an artefact of which
    // folder happened to be nearest, and nearest is not the same thing as current.
    const found = new Map();
    for (const root of roots) {
        if (root === parsePath(root).root) continue;
        for (const dir of walk(root, 2)) {
            const m = roleOf(dir, role);
            if (m && !found.has(dir)) found.set(dir, m);
        }
    }

    if (found.size === 0) return { path: null, how: `no ${role.label} found — pass --${key} <path>` };

    if (found.size === 1) {
        const [dir, m] = [...found][0];
        return { path: dir, matched: m, how: `the only ${role.label} found nearby (depends on ${m})` };
    }

    // Two or more. Refusing here is the most valuable behaviour in this file — and with a
    // shared skill set it is the common case, since a machine holds many projects at once.
    return {
        path: null,
        how: `${found.size} candidates for ${role.label} — say which with --${key}`,
        candidates: [...found.keys()].map((dir) => ({
            path: dir,
            branch: gitBranch(dir),
            head: headLine(dir),
        })),
    };
}

/**
 * Build the record for one tree: where it is, how it was found, and the facts a skill will
 * ask for later. Derived paths are stored rather than recomputed by each caller, so the
 * convention lives in exactly one place.
 *
 * @param {"fe"|"be"} key
 * @param {ReturnType<typeof locate>} hit
 * @returns {object|null} null when the role was not resolved at all
 */
function describe(key, hit) {
    const role = ROLES[key];
    const dir = hit.path;

    const base = {
        path: dir,
        found_by: hit.how,
        candidates: hit.candidates ?? null,
        depends_on: hit.matched ?? null,
        name: dir ? manifest(dir)?.name ?? basename(dir) : null,
        branch: dir ? gitBranch(dir) : null,
        remote: dir ? gitRemote(dir) : null,
    };
    if (!dir) return base;

    // Markers are recorded only when they exist. A project without `.storybook` is not
    // broken — it simply has no design-system lane, and a null says that honestly.
    for (const [field, folder] of Object.entries(role.markers ?? {})) {
        base[field] = existsSync(join(dir, folder)) ? join(dir, folder) : null;
    }

    if (key === "fe") {
        const p = fePorts(dir, hit.matched);
        base.url = p.dev ? `http://localhost:${p.dev}` : null;
        base.storybook_url = p.storybook ? `http://localhost:${p.storybook}` : null;
        base.ports_found_by = p.source;
    } else {
        const p = bePort(dir);
        base.url = p.port ? `http://localhost:${p.port}` : null;
        base.ports_found_by = p.source;
    }
    return base;
}

// ---- the stored record ---------------------------------------------------

/**
 * Load `.context/workspace.json`, or an empty registry.
 * The shape is `{ current, projects: { <name>: { fe, be } } }` — a registry rather than a
 * single pair, because one machine holds several projects and the skill set serves all of them.
 * @returns {{current: string|null, projects: Record<string, object>}}
 */
const load = () => {
    if (!existsSync(CONTEXT_FILE)) return { current: null, projects: {} };
    try { return JSON.parse(readFileSync(CONTEXT_FILE, "utf8")); } catch { return { current: null, projects: {} }; }
};

/** Print one project's two roles for a human, including rival candidates when there were any. */
const show = (name, project) => {
    console.log(`\nproject  ${name}`);
    for (const key of ["fe", "be"]) {
        const t = project[key];
        if (!t) continue;
        console.log(`\n  ${key.toUpperCase()}`);
        console.log(`    path       ${t.path ?? "— UNRESOLVED"}`);
        console.log(`    found by   ${t.found_by}`);
        for (const c of t.candidates ?? []) console.log(`      - ${c.path}  [${c.branch}]  ${c.head}`);
        if (t.branch) console.log(`    branch     ${t.branch}`);
        if (t.url) console.log(`    url        ${t.url}`);
        if (t.storybook_url) console.log(`    storybook  ${t.storybook_url}`);
        if (t.ports_found_by) console.log(`    ports      ${t.ports_found_by}`);
    }
};

// ---- --list --------------------------------------------------------------

if (LIST) {
    const ctx = load();
    const names = Object.keys(ctx.projects);
    if (!names.length) {
        console.error("Nothing registered on this machine yet.");
        console.error("Run:  node scripts/workspace-setup.mjs --fe <path> --be <path>");
        process.exit(1);
    }
    for (const n of names) {
        const p = ctx.projects[n];
        const mark = n === ctx.current ? "*" : " ";
        console.log(`${mark} ${n.padEnd(20)} fe: ${p.fe?.path ?? "—"}`);
        console.log(`  ${" ".repeat(20)} be: ${p.be?.path ?? "—"}`);
    }
    console.log(`\n* = current. Switch with:  node scripts/workspace-setup.mjs --use <name>`);
    process.exit(0);
}

// ---- --use: switch project without re-detecting ---------------------------

if (typeof flag("use") === "string") {
    const name = flag("use");
    const ctx = load();
    if (!ctx.projects[name]) {
        console.error(`no project registered as "${name}"`);
        console.error(`known: ${Object.keys(ctx.projects).join(" ") || "(none)"}`);
        process.exit(1);
    }
    ctx.current = name;
    mkdirSync(CONTEXT_DIR, { recursive: true });
    writeFileSync(CONTEXT_FILE, JSON.stringify(ctx, null, 2) + "\n");
    console.log(`current project is now "${name}"`);
    show(name, ctx.projects[name]);
    process.exit(0);
}

// ---- --check: is the current record still true? --------------------------

/**
 * A recorded path rots — repos get moved, renamed, deleted, or switched to another branch.
 * This is the cheap call a skill makes before trusting the context.
 */
if (CHECK) {
    const ctx = load();
    const name = ctx.current;
    if (!name || !ctx.projects[name]) {
        console.error("No current project on this machine. Run: node scripts/workspace-setup.mjs");
        process.exit(1);
    }

    let bad = 0;
    for (const key of ["fe", "be"]) {
        const t = ctx.projects[name][key];
        if (!t) continue;

        if (!t.path || !existsSync(t.path)) {
            console.log(`FAIL  ${key}.path — ${t.path ?? "unset"} does not exist`);
            bad++;
            continue;
        }

        // A different branch is not a failure — the tree is still the right one — but it is
        // worth saying, because a skill reading one branch's canon on another will mislead.
        const branch = gitBranch(t.path);
        if (branch !== t.branch) console.log(`WARN  ${key}.branch — recorded ${t.branch}, checked out ${branch}`);
        console.log(`ok    ${key}  ${t.path}  (${branch})`);
    }

    if (bad) {
        console.log(`\n${bad} tree(s) unresolved — re-run: node scripts/workspace-setup.mjs`);
        process.exit(1);
    }
    console.log(`\nok — project "${name}" still resolves on this machine`);
    process.exit(0);
}

// ---- detect and write ----------------------------------------------------

const fe = locate("fe");
const be = locate("be");

const project = {
    fe: describe("fe", fe),
    be: describe("be", be),
};

// One folder cannot be both roles. When detection lands on the same path twice it has matched
// on something incidental, and recording it would send every FE lookup at the backend.
if (project.fe.path && project.fe.path === project.be.path) {
    console.error(`Both roles resolved to the same folder: ${project.fe.path}`);
    console.error("That is a detection failure, not a monorepo answer. State them outright:");
    console.error("  node scripts/workspace-setup.mjs --fe <path> --be <path>");
    process.exit(1);
}

/**
 * Name the project. An explicit `--project` wins; otherwise the FE's package name, then the
 * BE's, then the folder. The name is only a key for `--use`, so a rough one is harmless — but
 * it must be stable, which is why it is derived from the manifest rather than the folder first.
 */
const name = typeof flag("project") === "string"
    ? flag("project")
    : project.fe?.name ?? project.be?.name ?? basename(HOME_TREE);

show(name, project);

const unresolved = ["fe", "be"].filter((k) => !project[k].path);

if (DRY) {
    console.log(`\n--dry: nothing written. Would register "${name}" in ${CONTEXT_FILE}`);
    process.exit(unresolved.length ? 1 : 0);
}

const ctx = load();
ctx.note = "Written per machine by scripts/workspace-setup.mjs. Never commit this file.";
ctx.written_at = new Date().toISOString();
ctx.projects[name] = project;
ctx.current = name;

mkdirSync(CONTEXT_DIR, { recursive: true });
writeFileSync(CONTEXT_FILE, JSON.stringify(ctx, null, 2) + "\n");
console.log(`\nwritten  ${CONTEXT_FILE}   (current project: ${name})`);

// A partial record is still worth writing — the resolved half is usable — but the exit code
// stays non-zero so a caller does not read the missing half as an answer.
if (unresolved.length) {
    console.log(`\nunresolved: ${unresolved.join(", ")}`);
    console.log(`Point at them:  node scripts/workspace-setup.mjs ${unresolved.map((k) => `--${k} <path>`).join(" ")}`);
    process.exit(1);
}
