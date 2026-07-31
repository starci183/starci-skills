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
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
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
 * `design_system` is deliberately NOT per project. One storybook serves every source in the
 * ledger — a new app does not lack a design system, it borrows the ecosystem's. Keeping it at
 * the registry level is what stops each project growing its own copy and drifting apart.
 * `fe.design_system` still means something different and narrower: does THIS project happen to
 * carry a `.storybook/` folder of its own.
 */
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

// ---- one value, for a shell ----------------------------------------------

/** The first non-flag argument is a dotted key such as `fe.path` or `be.url`. */
const key = argv.find((a) => !a.startsWith("--"));

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

// Which project answered, and when it was measured — a stale record is then visible without
// having to run --check.
console.log(`\nproject  ${ctx.project}   recorded ${ctx.written_at}`);
console.log("one value:  node scripts/read-workspace-context.mjs fe.path");
