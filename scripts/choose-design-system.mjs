#!/usr/bin/env node
/**
 * storybook.mjs — decide which storybook the whole ecosystem uses, and record it.
 *
 * WHY THIS EXISTS
 * A design system is ONE thing shared by every source in the ledger, not one per project. An
 * app with no `.storybook/` of its own is not missing a design system — it borrows the
 * ecosystem's. Recording that at the registry level is what stops each project growing its own
 * copy and drifting apart.
 *
 * WHY IT REFUSES TO SCAN THE DISK
 * A machine can easily hold two clones of one repo. Both carry `.storybook/`, both carry a
 * `main.*`, both declare a `storybook` script, both share one origin — every technical test
 * passes on both, and one of them may be months behind. Nothing about the folders separates
 * them; only the ledger does. So candidates come from registered sources, never from a sweep.
 *
 * WHY IT PREFERS A CLONE OVER A COPY
 * A clone keeps a line home: `git pull` refreshes it, and its commit can be compared with the
 * upstream to say how far behind it has fallen. A copy drifts in silence.
 *
 * USAGE
 *   node scripts/choose-design-system.mjs                       what is recorded, and what could be
 *   node scripts/choose-design-system.mjs choose                adopt the one usable storybook in the ledger
 *   node scripts/choose-design-system.mjs choose <path>         adopt a storybook you built yourself
 *   node scripts/choose-design-system.mjs generate [--into <dir>]
 *                                                    use the canonical book — reuse a clone,
 *                                                    or fetch one and register it
 *   node scripts/choose-design-system.mjs --check               is the recorded one still usable
 *
 * EXIT CODES
 *   0  a storybook is recorded, or the listing printed
 *   1  nothing usable, several candidates, or the recorded one has gone
 *
 * Read it back with `scripts/read-workspace-context.mjs design_system.path`.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, basename } from "node:path";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTEXT_DIR = join(REPO, "context");
const CONTEXT_FILE = join(CONTEXT_DIR, "workspace.json");

/**
 * Where the canonical design system lives. It ships inside a front-end app repo rather than as
 * a package, so fetching the book means fetching that repo.
 *
 * The default points at StarCi's. Any team can point it somewhere else without touching a line
 * of this file — which is the difference between a default and a hardcoded fact.
 *
 * Overridable so a fork or an internal mirror can be pointed at, and so the tests can stand a
 * local bare repo in for the network.
 */
const CANONICAL_REPO = process.env.DESIGN_SYSTEM_REPO || "https://github.com/starci-lab/starci-academy";

// ---- arguments -----------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : argv[i + 1] ?? true;
};
const BOOLEAN_FLAGS = new Set(["check"]);
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

const [command, target] = positional;
const CHECK = argv.includes("--check");

// ---- the ledger ----------------------------------------------------------

const load = () => {
    if (!existsSync(CONTEXT_FILE)) return null;
    try { return JSON.parse(readFileSync(CONTEXT_FILE, "utf8")); } catch { return null; }
};

const save = (registry) => {
    mkdirSync(CONTEXT_DIR, { recursive: true });
    writeFileSync(CONTEXT_FILE, JSON.stringify(registry, null, 2) + "\n");
};

const registry = load();
if (!registry) {
    console.error("This machine has no workspace context yet.");
    console.error("Run:  node scripts/register-workspace-source.mjs --fe <dir> --be <dir>");
    process.exit(1);
}

// ---- what makes a storybook usable ---------------------------------------

/**
 * Judge a `.storybook/` folder.
 *
 * A folder alone proves nothing — the workspace record marks `fe.design_system` from
 * `existsSync` alone, and an empty `.storybook/` passes that. A storybook is usable when it
 * carries its own config AND the repo knows how to start it; either half missing means someone
 * would open it and find nothing to render.
 *
 * @param {string} root the repo holding the folder
 * @returns {{path: string, usable: boolean, why: string}|null} null when there is no folder
 */
function inspect(root) {
    const path = join(root, ".storybook");
    if (!existsSync(path)) return null;

    const hasConfig = readdirSync(path).some((f) => /^main\.(ts|js|mjs|cjs|tsx)$/.test(f));
    let hasScript = false;
    try {
        hasScript = Boolean(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts?.storybook);
    } catch { hasScript = false; }

    if (hasConfig && hasScript) return { path, usable: true, why: "has main.* and a storybook script" };
    const missing = [!hasConfig && "no main.*", !hasScript && "no storybook script"].filter(Boolean);
    return { path, usable: false, why: missing.join(", ") };
}

// ---- git -----------------------------------------------------------------

const git = (dir, args) => {
    try {
        return execFileSync("git", ["-C", dir, ...args], {
            encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    } catch { return null; }
};

const gitRemote = (dir) => git(dir, ["remote", "get-url", "origin"]);
const gitCommit = (dir) => git(dir, ["rev-parse", "--short", "HEAD"]);
const gitHeadLine = (dir) => git(dir, ["log", "-1", "--format=%h %ad %s", "--date=short"])?.slice(0, 64) ?? null;

/** Compare two remote URLs ignoring the parts that never change what repo it is. */
const sameRepo = (a, b) => {
    const norm = (u) => (u ?? "").replace(/\.git$/, "").replace(/^git@([^:]+):/, "https://$1/").replace(/\/+$/, "").toLowerCase();
    return norm(a) === norm(b);
};

/** Is this folder a checkout of the canonical book? Judged by origin, never by folder name. */
const isCanonical = (dir) => sameRepo(gitRemote(dir), CANONICAL_REPO);

// ---- candidates come from the ledger, not the disk -----------------------

/**
 * Every registered source, flattened, with its storybook verdict.
 * Both roles are examined: nothing says a design system cannot live beside an API, and
 * assuming otherwise would be exactly the kind of guess this set avoids.
 *
 * @returns {Array<{project: string, role: string, root: string, sb: object, canonical: boolean}>}
 */
function candidates() {
    const out = [];
    for (const [name, project] of Object.entries(registry.projects ?? {})) {
        for (const role of ["fe", "be"]) {
            const root = project[role]?.path;
            if (!root || !existsSync(root)) continue;
            const sb = inspect(root);
            if (!sb) continue;
            out.push({ project: name, role, root, sb, canonical: isCanonical(root) });
        }
    }
    return out;
}

/** Write the ecosystem's design system into the ledger. */
function adopt({ path, root, from }) {
    registry.design_system = {
        path,
        from,
        repo: gitRemote(root),
        commit: gitCommit(root),
        head: gitHeadLine(root),
        recorded_at: new Date().toISOString(),
    };
    save(registry);
    console.log(`\ndesign system for this ledger:`);
    console.log(`  path    ${path}`);
    console.log(`  from    ${from}`);
    if (registry.design_system.repo) console.log(`  repo    ${registry.design_system.repo}`);
    if (registry.design_system.head) console.log(`  head    ${registry.design_system.head}`);
    console.log(`\nEvery project in this ledger now reads its blueprint from here.`);
    console.log(`Ask for it with:  node scripts/read-workspace-context.mjs design_system.path`);
}

const show = () => {
    const ds = registry.design_system;
    if (ds) {
        console.log("recorded design system");
        console.log(`  path    ${ds.path}`);
        console.log(`  from    ${ds.from}`);
        if (ds.head) console.log(`  head    ${ds.head}`);
    } else {
        console.log("No design system recorded for this ledger yet.");
    }

    const found = candidates();
    if (found.length) {
        console.log("\nstorybooks among the registered sources:");
        for (const c of found) {
            const mark = c.canonical ? "canon" : "     ";
            console.log(`  ${mark}  ${c.sb.usable ? "usable  " : "UNUSABLE"}  ${c.project}.${c.role}  ${c.sb.path}`);
            if (!c.sb.usable) console.log(`                    ${c.sb.why}`);
        }
    } else {
        console.log("\nNo registered source carries a .storybook folder.");
    }
    console.log("\nchoose <path> | choose | generate [--into <dir>] | --check");
};

// ---- --check -------------------------------------------------------------

if (CHECK) {
    const ds = registry.design_system;
    if (!ds) {
        console.error("No design system recorded. Run: node scripts/choose-design-system.mjs choose");
        process.exit(1);
    }
    if (!existsSync(ds.path)) {
        console.log(`FAIL  ${ds.path} does not exist`);
        process.exit(1);
    }
    const root = dirname(ds.path);
    const sb = inspect(root);
    if (!sb?.usable) {
        console.log(`FAIL  ${ds.path} is no longer usable — ${sb?.why ?? "the folder went away"}`);
        process.exit(1);
    }
    // A moved commit is not a failure, but it is the thing that quietly makes two machines
    // disagree about what the design system says, so it is always reported.
    const now = gitCommit(root);
    if (ds.commit && now !== ds.commit) {
        console.log(`WARN  recorded at ${ds.commit}, now at ${now} — the blueprint has moved`);
    }
    console.log(`ok    ${ds.path}  (${sb.why})`);
    process.exit(0);
}

// ---- choose --------------------------------------------------------------

if (command === "choose") {
    // An explicit path is the only way a storybook that is not the canonical one gets adopted. Building
    // your own is a deliberate act, so claiming it is one too — nothing here will notice it and
    // decide on your behalf.
    if (target) {
        const given = resolve(target);
        const root = basename(given) === ".storybook" ? dirname(given) : given;
        const sb = inspect(root);
        if (!sb) {
            console.error(`No .storybook folder at ${root}`);
            process.exit(1);
        }
        if (!sb.usable) {
            console.error(`${sb.path} is not usable — ${sb.why}`);
            console.error("A folder without a config is a shell; fix it before pointing the ledger at it.");
            process.exit(1);
        }
        adopt({ path: sb.path, root, from: `stated as ${target}` });
        process.exit(0);
    }

    const usable = candidates().filter((c) => c.sb.usable);

    if (!usable.length) {
        console.error("No registered source carries a usable storybook.\n");
        console.error("Either point at one you built:   node scripts/choose-design-system.mjs choose <path>");
        console.error("Or fetch the canonical one:      node scripts/choose-design-system.mjs generate");
        process.exit(1);
    }

    // The bias is the canonical book, deliberately — it is the ecosystem's reference, and
    // anything else being adopted silently would be a decision made behind the user's back.
    const canon = usable.filter((c) => c.canonical);
    const pool = canon.length ? canon : usable;

    if (pool.length > 1) {
        console.error(`${pool.length} registered sources carry a usable storybook — say which:\n`);
        for (const c of pool) console.error(`  ${c.project}.${c.role}  ${c.sb.path}\n      ${gitHeadLine(c.root)}`);
        console.error(`\n  node scripts/choose-design-system.mjs choose <path>`);
        process.exit(1);
    }

    const [only] = pool;
    adopt({
        path: only.sb.path,
        root: only.root,
        from: `registered source ${only.project}.${only.role}${only.canonical ? " (canonical)" : ""}`,
    });
    process.exit(0);
}

// ---- generate ----------------------------------------------------------

if (command === "generate") {
    // Reuse before fetch. A clone already in the ledger is the same design system, and pulling
    // a second copy would create exactly the drift this file exists to prevent.
    const already = candidates().find((c) => c.canonical && c.sb.usable);
    if (already) {
        console.log(`The canonical storybook is already registered — reusing it rather than cloning again.`);
        adopt({
            path: already.sb.path,
            root: already.root,
            from: `registered source ${already.project}.${already.role} (canonical)`,
        });
        process.exit(0);
    }

    const into = typeof flag("into") === "string" ? resolve(flag("into")) : process.cwd();
    // Name the checkout after the repo it came from, not after a constant — otherwise a mirror
    // or a fork lands in a folder claiming to be something it is not.
    const repoName = basename(CANONICAL_REPO.replace(/\.git$/, "").replace(/\/+$/, ""));
    const targetDir = join(into, repoName);

    if (existsSync(targetDir)) {
        if (!isCanonical(targetDir)) {
            console.error(`${targetDir} already exists and is not a checkout of ${CANONICAL_REPO}.`);
            console.error("Clone somewhere else with --into <dir>, or point at yours with `choose <path>`.");
            process.exit(1);
        }
        const sb = inspect(targetDir);
        if (!sb?.usable) {
            console.error(`${targetDir} is a checkout of the canonical repo but its storybook is not usable — ${sb?.why ?? "no .storybook"}`);
            process.exit(1);
        }
        console.log(`Found an existing checkout at ${targetDir} — using it.`);
        adopt({ path: sb.path, root: targetDir, from: `existing checkout at ${targetDir}` });
        process.exit(0);
    }

    console.log(`cloning ${CANONICAL_REPO}\n     -> ${targetDir}`);
    mkdirSync(into, { recursive: true });
    try {
        execFileSync("git", ["clone", CANONICAL_REPO, targetDir], { stdio: ["ignore", "inherit", "inherit"] });
    } catch {
        console.error(`\ngit clone failed. If the repo is private, authenticate first, then re-run.`);
        process.exit(1);
    }

    const sb = inspect(targetDir);
    if (!sb?.usable) {
        console.error(`Cloned, but the storybook is not usable — ${sb?.why ?? "no .storybook folder"}`);
        process.exit(1);
    }

    // Register the clone as a source of its own, so `--list` shows it and nobody later wonders
    // where this folder came from.
    registry.projects ??= {};
    registry.projects[repoName] ??= {
        fe: {
            path: targetDir,
            found_by: `cloned by storybook.mjs generate`,
            name: repoName,
            design_system: sb.path,
        },
        be: null,
    };
    save(registry);

    adopt({ path: sb.path, root: targetDir, from: `cloned from ${CANONICAL_REPO}` });
    console.log(`Also registered as project "${repoName}" so --list and --check watch it.`);
    process.exit(0);
}

// ---- no command ----------------------------------------------------------

if (!command) {
    show();
    process.exit(registry.design_system ? 0 : 1);
}

console.error(`unknown command: ${command}`);
console.error("commands: choose [<path>] | generate [--into <dir>] | --check");
process.exit(1);
