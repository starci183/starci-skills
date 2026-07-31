#!/usr/bin/env node
/**
 * register-workspace-source.mjs — register which FE and BE source this machine is pointed at,
 * and write the answer to `context/workspace.json` (gitignored, per machine).
 *
 * WHY THIS EXISTS
 * This skill set is shared across sources, not welded to one. Two things vary and both used
 * to be written into the documents:
 *
 *   per machine   where the trees sit — one drive here, another there, a different root again
 *   per project   which trees they even are — a different app has a different FE and BE
 *
 * A path or a repo name inside a skill is therefore wrong twice over. Nothing here knows the
 * name of any particular app: a tree is described by its ROLE (`fe`, `be`), and the answer
 * lives in a file that never travels.
 *
 * IT DOES NOT GUESS
 * You state the two sources. It records them.
 *
 * An earlier version searched the machine for repos that looked like a front end or a back
 * end, and every defect its own test suite found came from that search: 52 candidates for one
 * role because git worktrees are full copies of a repo; a backend claimed as the front end
 * because it carried a bundler to build an internal dashboard; a front-end-only project stuck
 * permanently "ambiguous"
 * because the unnamed role kept matching unrelated repos. Searching produced a confident
 * answer to a question only the person at the keyboard can settle. Now it asks.
 *
 * USAGE
 *   node scripts/register-workspace-source.mjs <fe> <be> [--project <name>]
 *   node scripts/register-workspace-source.mjs --fe <fe> --be <be> [--project <name>]
 *   node scripts/register-workspace-source.mjs --use <name>      switch to a registered project
 *   node scripts/register-workspace-source.mjs --list            what is registered
 *   node scripts/register-workspace-source.mjs --check           is the current record still true
 *   node scripts/register-workspace-source.mjs --dry             print, write nothing
 *
 * A source is either a folder already on disk, or a git URL — a URL is cloned first, into the
 * current directory unless `--into <dir>` says otherwise. Either role may be omitted; a
 * front-end-only project states its front end alone.
 *
 * EXIT CODES
 *   0  every stated source resolved
 *   1  a source was not usable, or a recorded path has moved
 *
 * Read it back with `scripts/read-workspace-context.mjs`, never by parsing this script's output.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, basename } from "node:path";

/** Root of this skill set — the folder holding `scripts/`, `design/`, `context/`. */
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

const CONTEXT_DIR = join(REPO, "context");
const CONTEXT_FILE = join(CONTEXT_DIR, "workspace.json");

/**
 * What is recorded per role.
 *
 * `deps`    dependencies that confirm the role. Used only to ANNOTATE what was stated —
 *           never to choose, because choosing is the thing this script does not do.
 * `label`   what to call it to a human
 * `markers` folders worth recording when present; absence is not a problem, another project
 *           simply organises itself differently
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
 * Read `--name value`.
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

/**
 * Flags that stand alone. Everything else takes the next token as its value.
 * Getting this list wrong is not a small bug: without it, `--dry --project shop --be <dir>`
 * treated "shop" as a bare word and tried to open it as the front-end folder.
 */
const BOOLEAN_FLAGS = new Set(["dry", "check", "list"]);

/**
 * Bare words, in order: the front end then the back end.
 * A token that belongs to a flag is that flag's value, not a positional argument.
 */
const positional = (() => {
    const out = [];
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith("--")) {
            if (!BOOLEAN_FLAGS.has(argv[i].slice(2))) i++;
            continue;
        }
        out.push(argv[i]);
    }
    return out;
})();

/**
 * What the human stated for a role, whichever way they stated it.
 * @param {"fe"|"be"} key
 * @returns {string|null}
 */
const stated = (key) => {
    const f = flag(key);
    if (typeof f === "string") return f;
    const env = process.env[`STARCI_${key.toUpperCase()}`];
    if (env) return env;
    return positional[key === "fe" ? 0 : 1] ?? null;
};

// ---- reading a repo ------------------------------------------------------

/**
 * Parse a folder's package.json.
 * @param {string} dir folder to look in
 * @returns {object|null} the manifest, or null if absent or malformed
 */
const manifest = (dir) => {
    const p = join(dir, "package.json");
    if (!existsSync(p)) return null;
    try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
};

/**
 * Which of the role's dependencies this repo carries, if any.
 * Recorded as a note, never used to decide — see the header.
 * @param {string} dir
 * @param {{deps: string[]}} role
 * @returns {string|null}
 */
const dependencySign = (dir, role) => {
    const m = manifest(dir);
    if (!m) return null;
    const deps = { ...(m.dependencies ?? {}), ...(m.devDependencies ?? {}) };
    return role.deps.find((d) => d in deps) ?? null;
};

// ---- git -----------------------------------------------------------------

/**
 * Run git and return trimmed stdout, or null.
 * Null is an ordinary answer — "not a git repo" is not a failure here.
 * @param {string} dir
 * @param {string[]} args arguments after `-C <dir>`
 * @returns {string|null}
 */
const git = (dir, args) => {
    try {
        return execFileSync("git", ["-C", dir, ...args], {
            encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    } catch { return null; }
};

const gitBranch = (dir) => git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
const gitRemote = (dir) => git(dir, ["remote", "get-url", "origin"]);

/** Hash, date and subject of the last commit — enough to see at a glance how fresh a tree is. */
const headLine = (dir) => git(dir, ["log", "-1", "--format=%h %ad %s", "--date=short"])?.slice(0, 72) ?? null;

/**
 * Does this string name a repository to fetch rather than a folder to open?
 * @param {string} s
 * @returns {boolean}
 */
const isGitUrl = (s) => /^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/.test(s) || s.endsWith(".git");

/**
 * Turn a git URL into a folder on disk, cloning if it is not there yet.
 *
 * The clone goes to the current directory unless `--into` says otherwise. That is a choice
 * the person made by standing somewhere when they ran this, not a location this script
 * invented — and it is printed, so it is never a surprise.
 *
 * @param {string} url
 * @returns {{path: string|null, how: string}}
 */
function fromUrl(url) {
    const into = typeof flag("into") === "string" ? resolve(flag("into")) : process.cwd();
    const name = basename(url.replace(/\.git$/, "").replace(/\/+$/, ""));
    const target = join(into, name);

    if (existsSync(target)) {
        // Reuse only what is provably the same repo. A folder that merely shares a name is a
        // different thing, and silently adopting it is how the wrong tree gets registered.
        const remote = gitRemote(target);
        // Three different situations, and saying which one it is matters — "not a git repo"
        // printed over a perfectly good repo that simply has no origin sends the reader
        // looking for the wrong problem.
        if (remote === null && !existsSync(join(target, ".git"))) {
            return { path: null, how: `${target} already exists and is not a git repo` };
        }
        if (remote === null) {
            return { path: null, how: `${target} already exists as a git repo with no origin, so it cannot be matched against ${url}` };
        }
        const same = remote.replace(/\.git$/, "") === url.replace(/\.git$/, "");
        if (!same) return { path: null, how: `${target} already exists but its origin is ${remote}` };
        return { path: target, how: `already cloned at ${target}` };
    }

    if (DRY) return { path: null, how: `would clone ${url} into ${target}` };

    mkdirSync(into, { recursive: true });
    console.log(`cloning ${url}\n     -> ${target}`);
    try {
        execFileSync("git", ["clone", url, target], { stdio: ["ignore", "inherit", "inherit"] });
    } catch {
        return { path: null, how: `git clone failed for ${url}` };
    }
    return { path: target, how: `cloned from ${url}` };
}

// ---- resolving one role --------------------------------------------------

/**
 * Take what the human stated for a role and turn it into a folder.
 * @param {"fe"|"be"} key
 * @returns {{path: string|null, how: string, stated: boolean}}
 */
function resolveRole(key) {
    const value = stated(key);
    if (!value) return { path: null, how: "not stated", stated: false };

    if (isGitUrl(value)) return { ...fromUrl(value), stated: true };

    const dir = resolve(value);
    if (!existsSync(dir)) return { path: null, how: `${dir} does not exist`, stated: true };
    if (!readdirSync(dir).length) return { path: null, how: `${dir} is empty`, stated: true };
    return { path: dir, how: `stated as ${value}`, stated: true };
}

// ---- ports, read out of the repo rather than assumed ---------------------

/** Pull `-p 6006` or `--port=6006` out of an npm script line. */
const scriptPort = (s) => {
    const m = /(?:-p|--port)[= ](\d+)/.exec(s ?? "");
    return m ? Number(m[1]) : null;
};

/** Framework defaults, used only when the repo states no port of its own. */
const FRAMEWORK_DEFAULT = { next: 3000, nuxt: 3000, vite: 5173, "react-scripts": 3000, "@angular/core": 4200 };

/**
 * The front end's dev and Storybook ports, from its own scripts.
 * Reading beats assuming: a constant here would become a second, wronger place where the
 * truth is written down.
 * @param {string} dir
 * @param {string|null} framework the dependency found, used only to pick a default
 * @returns {{dev: number|null, storybook: number|null, source: string}}
 */
function fePorts(dir, framework) {
    const scripts = manifest(dir)?.scripts ?? {};
    const declared = scriptPort(scripts.dev) ?? scriptPort(scripts.start);
    return {
        dev: declared ?? FRAMEWORK_DEFAULT[framework] ?? null,
        storybook: scriptPort(scripts.storybook),
        source: declared
            ? "package.json scripts"
            : `package.json scripts; dev port is ${framework ?? "the framework"}'s default`,
    };
}

/**
 * The back end's HTTP port. `.env` wins over the code default — that is what an `.env` is for.
 * @param {string} dir
 * @returns {{port: number|null, source: string|null}}
 */
function bePort(dir) {
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

    // Nothing set locally, so whatever the code defaults to is what will be served. Only
    // config-shaped files are read; scanning a whole src tree would be slow and noisy.
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

// ---- the record ----------------------------------------------------------

/**
 * Describe one role for the registry.
 * @param {"fe"|"be"} key
 * @param {ReturnType<typeof resolveRole>} hit
 * @returns {object|null} null when the role was simply not stated
 */
function describe(key, hit) {
    const role = ROLES[key];
    const dir = hit.path;

    // A role nobody stated is absent from this project, not broken. A front-end-only source
    // is normal, and recording an empty shell made `--check` fail on it forever.
    if (!dir && !hit.stated) return null;

    const sign = dir ? dependencySign(dir, role) : null;
    const base = {
        path: dir,
        found_by: hit.how,
        // Says whether the stated folder looks like the role. It is a note for a human, not a
        // veto: a stack this list has never heard of is still whatever the human says it is.
        looks_like_role: dir ? (sign ? `depends on ${sign}` : "no known dependency of this role") : null,
        depends_on: sign,
        name: dir ? manifest(dir)?.name ?? basename(dir) : null,
        branch: dir ? gitBranch(dir) : null,
        head: dir ? headLine(dir) : null,
        remote: dir ? gitRemote(dir) : null,
    };
    if (!dir) return base;

    for (const [field, folder] of Object.entries(role.markers ?? {})) {
        base[field] = existsSync(join(dir, folder)) ? join(dir, folder) : null;
    }

    if (key === "fe") {
        const p = fePorts(dir, sign);
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

/**
 * Load the registry, or an empty one.
 * Shape: `{ current, projects: { <name>: { fe, be } } }` — a registry rather than a single
 * pair, because one machine holds several sources and this set serves all of them.
 */
const load = () => {
    if (!existsSync(CONTEXT_FILE)) return { current: null, projects: {} };
    try { return JSON.parse(readFileSync(CONTEXT_FILE, "utf8")); } catch { return { current: null, projects: {} }; }
};

/** Print one project's roles for a human. */
const show = (name, project) => {
    console.log(`\nproject  ${name}`);
    for (const key of ["fe", "be"]) {
        const t = project[key];
        if (!t) continue;
        console.log(`\n  ${key.toUpperCase()}`);
        console.log(`    path       ${t.path ?? "— UNRESOLVED"}`);
        console.log(`    source     ${t.found_by}`);
        if (t.looks_like_role) console.log(`    looks like ${t.looks_like_role}`);
        if (t.branch) console.log(`    branch     ${t.branch}`);
        if (t.head) console.log(`    head       ${t.head}`);
        if (t.url) console.log(`    url        ${t.url}`);
        if (t.storybook_url) console.log(`    storybook  ${t.storybook_url}`);
        if (t.ports_found_by) console.log(`    ports      ${t.ports_found_by}`);
    }
};

const usage = () => {
    console.error("State the sources — this script does not look for them.\n");
    console.error("  node scripts/register-workspace-source.mjs <fe> <be>");
    console.error("  node scripts/register-workspace-source.mjs --fe <dir|git-url> --be <dir|git-url>\n");
    console.error("A git URL is cloned into the current directory, or into --into <dir>.");
    console.error("Already registered? node scripts/register-workspace-source.mjs --list");
};

// ---- --list --------------------------------------------------------------

if (LIST) {
    const ctx = load();
    const names = Object.keys(ctx.projects);
    if (!names.length) {
        console.error("Nothing registered on this machine yet.\n");
        usage();
        process.exit(1);
    }
    for (const n of names) {
        const p = ctx.projects[n];
        console.log(`${n === ctx.current ? "*" : " "} ${n.padEnd(20)} fe: ${p.fe?.path ?? "—"}`);
        console.log(`  ${" ".repeat(20)} be: ${p.be?.path ?? "—"}`);
    }
    console.log("\n* = current. Switch with:  node scripts/register-workspace-source.mjs --use <name>");
    process.exit(0);
}

// ---- --use ---------------------------------------------------------------

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

// ---- --check -------------------------------------------------------------

/**
 * A recorded path rots: trees get moved, renamed, deleted, or switched to another branch.
 * This is the cheap call a skill makes before trusting the context.
 */
if (CHECK) {
    const ctx = load();
    const name = ctx.current;
    if (!name || !ctx.projects[name]) {
        console.error("No current project on this machine.\n");
        usage();
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
        console.log(`\n${bad} source(s) unresolved — re-run setup with the right paths.`);
        process.exit(1);
    }
    console.log(`\nok — project "${name}" still resolves on this machine`);
    process.exit(0);
}

// ---- register ------------------------------------------------------------

if (!stated("fe") && !stated("be")) {
    usage();
    process.exit(1);
}

const project = {
    fe: describe("fe", resolveRole("fe")),
    be: describe("be", resolveRole("be")),
};

// One folder cannot be both roles. Stating the same path twice is a slip, and recording it
// would send every front-end lookup at the back end.
if (project.fe?.path && project.fe.path === project.be?.path) {
    console.error(`Both roles were given the same folder: ${project.fe.path}`);
    console.error("State them separately, or leave one out if this project has only one.");
    process.exit(1);
}

const statedRoles = ["fe", "be"].filter((k) => project[k]);
const unresolved = statedRoles.filter((k) => !project[k].path);

// Report WHY before anything else. An earlier ordering ran the naming step first, so a source
// that simply did not exist came back as "could not name this project" — the symptom in place
// of the cause, and the one line the person needed was never printed.
if (unresolved.length === statedRoles.length) {
    console.error("No source resolved:\n");
    for (const k of statedRoles) console.error(`  ${k}   ${project[k].found_by}`);
    console.error("");
    usage();
    process.exit(1);
}

/**
 * Name the project. `--project` wins; otherwise the front end's package name, then the back
 * end's. Derived from the manifest rather than the folder, so renaming a checkout does not
 * silently create a second registry entry.
 */
const name = typeof flag("project") === "string"
    ? flag("project")
    : project.fe?.name ?? project.be?.name ?? null;

if (!name) {
    console.error("Could not name this project. Pass --project <name>.");
    process.exit(1);
}

show(name, project);

if (DRY) {
    console.log(`\n--dry: nothing written. Would register "${name}" in ${CONTEXT_FILE}`);
    process.exit(unresolved.length ? 1 : 0);
}

// Nothing usable resolved, so there is nothing worth recording.
if (unresolved.length === Object.values(project).filter(Boolean).length) {
    console.error(`\nNo source resolved. Nothing written.`);
    process.exit(1);
}

const ctx = load();
ctx.note = "Written per machine by scripts/register-workspace-source.mjs. Never commit this file.";
ctx.written_at = new Date().toISOString();
ctx.projects[name] = project;
ctx.current = name;

mkdirSync(CONTEXT_DIR, { recursive: true });
writeFileSync(CONTEXT_FILE, JSON.stringify(ctx, null, 2) + "\n");
console.log(`\nwritten  ${CONTEXT_FILE}   (current project: ${name})`);

// A partial record is still worth having — the resolved half is usable — but the exit code
// stays non-zero so a caller does not read the missing half as an answer.
if (unresolved.length) {
    console.log(`\nunresolved: ${unresolved.join(", ")}`);
    process.exit(1);
}
