#!/usr/bin/env node
/**
 * workspace.mjs — read this machine's workspace context.
 *
 * WHY THIS EXISTS
 * Every skill that needs a path asks here instead of writing one down. A skill set shared
 * across projects cannot name a repo or a folder: which trees to use is a per-project answer,
 * and where they sit is a per-machine one. Both live in `context/workspace.json`, which is
 * gitignored and was measured on the machine that is running right now.
 *
 * The file is a registry — `{ current, projects: { <name>: { fe, be } } }` — and every read
 * here resolves against `current`, so a skill asks for `fe.path` and gets the FE of whatever
 * project this machine is pointed at. Switch with `register-workspace-source.mjs --use <name>`.
 *
 * WHY IT IS A SEPARATE FILE FROM register-workspace-source.mjs
 * Reading happens constantly and must be cheap and free of side effects. Writing happens once
 * per machine and touches the disk. Keeping them apart means a skill can read the context with
 * no chance of rewriting it, and the read path stays small enough to trust at a glance.
 *
 * USAGE
 *   node scripts/read-workspace-context.mjs              everything, laid out for a human
 *   node scripts/read-workspace-context.mjs fe.path      one value, bare — safe inside $(...)
 *   node scripts/read-workspace-context.mjs --json       the whole record, for another script to parse
 *
 * EXIT CODES
 *   0  the value (or the record) was printed
 *   1  no context on this machine, or no value at the key asked for
 *
 * The non-zero exit on a missing context is the point: a caller that ignores it gets a loud
 * failure rather than an empty string silently standing in for a path.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** Root of this skill set — the folder holding `scripts/` and `context/`. */
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONTEXT_FILE = join(REPO, "context", "workspace.json");

// No context means this machine has never been set up. Say so with the exact command that
// fixes it, rather than printing an empty record that reads like a valid answer.
if (!existsSync(CONTEXT_FILE)) {
    console.error("This machine has no workspace context yet.");
    console.error("Run:  node scripts/register-workspace-source.mjs");
    process.exit(1);
}

const registry = JSON.parse(readFileSync(CONTEXT_FILE, "utf8"));
const argv = process.argv.slice(2);

// Resolve against the current project. A registry with no `current` is a half-written setup,
// and answering from an arbitrary project would be worse than answering not at all.
const project = registry.projects?.[registry.current];
if (!project) {
    console.error("The workspace context has no current project.");
    console.error("Run:  node scripts/register-workspace-source.mjs --list");
    process.exit(1);
}

/**
 * What a caller sees: the current project's roles, plus which project answered.
 *
 * `design_system` is deliberately NOT per project. There is exactly one book — starci-academy's
 * `.storybook/` — and every source in the ledger reads it; a registered source must not carry a
 * `.storybook/` of its own (check-single-source-of-truth.mjs enforces that). Keeping the book at
 * the registry level is what stops each project growing its own copy and drifting apart.
 * `fe.design_system` is the narrower, diagnostic fact: whether THIS project happens to carry a
 * `.storybook/` folder — normally null, and a non-null here is what the gate flags.
 */
/** Env-var prefix for this project's secrets: values live at `<PROJECT>_<NAME>`. */
const SECRET_PREFIX = String(registry.current).toUpperCase().replace(/[^A-Z0-9]+/g, "_");

const ctx = {
    ...project,
    design_system: registry.design_system ?? null,
    project: registry.current,
    written_at: registry.written_at,
};

// ---- the whole record, for another script --------------------------------

if (argv.includes("--json")) {
    console.log(JSON.stringify(ctx, null, 2));
    process.exit(0);
}

// ---- the project's secret env-var names, one per line ---------------------
// For a setter script to iterate: prints `<PROJECT>_<NAME>` for each declared secret. Names only,
// never values.
if (argv.includes("--secrets")) {
    for (const name of project.secrets ?? []) console.log(`${SECRET_PREFIX}_${name}`);
    process.exit(0);
}

// ---- one value, for a shell ----------------------------------------------

/** The first non-flag argument is a dotted key such as `fe.path` or `be.url`. */
const key = argv.find((a) => !a.startsWith("--"));

// ---- a secret, resolved from the environment (never stored on disk) -------
// Secrets never live in workspace.json — only their NAMES do, in the project's `secrets` manifest.
// The value lives in an environment variable `<PROJECT>_<KEY>`, and `secret.VPS_PASS` reads
// `process.env.<PROJECT>_VPS_PASS`. A missing one exits non-zero and names the env var to set,
// WITHOUT ever printing a value — so a secret cannot leak into a log through this path, and a
// public checkout of this skill set never carries a credential.
if (key && key.startsWith("secret.")) {
    const name = key.slice("secret.".length);
    const envVar = `${SECRET_PREFIX}_${name}`;
    // Project-scoped first, then the bare global name. A per-project secret (a VPS password that
    // differs per app) lives at `<PROJECT>_<NAME>`; a per-user token that is the same everywhere
    // (a Claude Code OAuth token, a personal GitHub PAT) lives at the bare `<NAME>` the tool itself
    // reads — so `CLAUDE_CODE_OAUTH_TOKEN` set once, globally, resolves for every project.
    const value = process.env[envVar] || process.env[name];
    if (value === undefined || value === "") {
        console.error(`secret "${name}" is not set for project "${registry.current}".`);
        console.error(`Set it in your environment as:  ${envVar}   (or globally as ${name})`);
        const manifest = project.secrets ?? [];
        if (manifest.length) console.error(`this project declares: ${manifest.join(" ")}`);
        process.exit(1);
    }
    // Bare value, no newline — meant to be captured by $(...) or piped straight into
    // `gh secret set`. Never echo it into a log.
    process.stdout.write(value);
    process.exit(0);
}

if (key) {
    // Walk the dotted path, stopping at the first missing level instead of throwing.
    const value = key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), ctx);

    // A null value is as much a failure as a missing one: `fe.path` is null exactly when setup
    // could not resolve that tree, and printing "null" into a shell variable would let the
    // caller go on to build a path out of it.
    if (value === undefined || value === null) {
        console.error(`workspace context has no value at "${key}"`);
        const known = Object.keys(ctx)
            .filter((k) => typeof ctx[k] === "object" && ctx[k] !== null)
            .map((k) => Object.keys(ctx[k]).map((s) => `${k}.${s}`).join(" "))
            .join(" ");
        console.error(`known keys: ${known}`);
        process.exit(1);
    }

    // Bare output, no label and no quotes — this is meant to be captured by $(...).
    console.log(typeof value === "object" ? JSON.stringify(value) : String(value));
    process.exit(0);
}

// ---- everything, for a human ---------------------------------------------

for (const tree of ["fe", "be"]) {
    const t = ctx[tree];
    if (!t) continue;
    console.log(`\n${tree.toUpperCase()}`);
    console.log(`  path       ${t.path ?? "— UNRESOLVED"}`);
    if (t.branch) console.log(`  branch     ${t.branch}`);
    if (t.url) console.log(`  url        ${t.url}`);
    if (t.storybook_url) console.log(`  storybook  ${t.storybook_url}`);
    if (t.design_system) console.log(`  blueprint  ${t.design_system}`);
    if (t.artifacts) console.log(`  artifacts  ${t.artifacts}`);
}

// Secrets are names only in the record; the values live in the environment. Show which of the
// project's declared secrets are actually present, so a missing one is visible before a deploy
// needs it — and never the value itself.
const declared = project.secrets ?? [];
if (declared.length) {
    console.log("\nSECRETS  (values live in env as <PROJECT>_<KEY>, never on disk)");
    for (const name of declared) {
        const set = Boolean(process.env[`${SECRET_PREFIX}_${name}`] || process.env[name]);
        console.log(`  ${set ? "ok  " : "MISS"} ${SECRET_PREFIX}_${name}`);
    }
}

// Which project answered, and when it was measured — a stale record is then visible without
// having to run --check.
console.log(`\nproject  ${ctx.project}   recorded ${ctx.written_at}`);
console.log("one value:  node scripts/read-workspace-context.mjs fe.path");
