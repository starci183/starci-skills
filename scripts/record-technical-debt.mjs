#!/usr/bin/env node
/**
 * record-technical-debt.mjs — park a piece of known-wrong work where it can be found again.
 *
 * WHY THIS EXISTS
 * A decision to not fix something is a real decision, and it evaporates. It lives in the middle
 * of a conversation that ends, and by the next session all that survives is the code — which
 * looks exactly like code nobody ever thought about. The next reader cannot tell "this was
 * weighed and deferred" from "this was never noticed", so they either re-litigate it from
 * scratch or copy it, believing it to be the house pattern.
 *
 * So the deferral gets written down, next to the skill set that will read it, in the same shape
 * every time. Not a TODO in a source file: a TODO says what to do and never says WHY IT WAS NOT
 * DONE, and the why is the only part a later reader cannot reconstruct.
 *
 * WHAT AN ENTRY IS NOT
 * Not a bug tracker, not a backlog, not a wish. Debt is specific: named files, a named rule they
 * break, and a stated reason the fix was postponed. If you cannot fill in `--why`, what you have
 * is an idea, and an idea does not belong here.
 *
 * PATHS ARE RECORDED BY ROLE, NEVER ABSOLUTE
 * An entry says `--role fe` and a path relative to that tree. Which folder `fe` means is a
 * per-machine answer that `read-workspace-context.mjs` already owns, so an entry written on one
 * machine still resolves on the next. An absolute path here would be a second, competing, and
 * quietly wrong copy of the workspace registry.
 *
 * USAGE
 *   node scripts/record-technical-debt.mjs add --title "..." --role fe --path <p> --why "..."
 *   node scripts/record-technical-debt.mjs list [--role fe] [--closed] [--all]
 *   node scripts/record-technical-debt.mjs show <id>
 *   node scripts/record-technical-debt.mjs close <id> --how "..."
 *   node scripts/record-technical-debt.mjs --check
 *
 * EXIT CODES
 *   0  did what was asked
 *   1  refused — a required field is missing, or an id does not exist
 *   2  `--check` found entries whose recorded paths no longer exist
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";
import { execFileSync } from "node:child_process";

/** Root of this skill set — the folder holding `scripts/`, `context/` and `debt/`. */
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Where entries live. The override exists so the test suite can write into a sandbox instead of
 * into your real notes — a suite that has to be pointed away from production data by hand is one
 * `cd` away from deleting it.
 */
const DEBT_DIR = process.env.CLAUDE_DEBT_DIR || join(REPO, "debt");

/** The roles an entry may be filed under. `claude` is this skill set's own debt. */
const ROLES = ["fe", "be", "design_system", "claude"];

/** How much work the fix is, as a rough shape. Deliberately three steps, not an estimate. */
const COSTS = ["small", "medium", "large"];

// ---- argument parsing -----------------------------------------------------

/**
 * Flags that take no value. Without this list, `--check add` would read `add` as the value of
 * `--check` and then find no command at all — the same class of bug the workspace script had.
 */
const BOOLEAN_FLAGS = new Set(["check", "all", "closed", "json"]);

/** Flags that may appear more than once and collect into a list. */
const REPEATED_FLAGS = new Set(["path"]);

function parseArgs(argv) {
    const flags = {};
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith("--")) {
            positional.push(arg);
            continue;
        }
        const name = arg.slice(2);
        if (BOOLEAN_FLAGS.has(name)) {
            flags[name] = true;
            continue;
        }
        const value = argv[++i];
        if (value === undefined) {
            fail(`--${name} needs a value`);
        }
        if (REPEATED_FLAGS.has(name)) (flags[name] ??= []).push(value);
        else flags[name] = value;
    }
    return { flags, positional };
}

function fail(message, ...extra) {
    console.error(message);
    for (const line of extra) console.error(line);
    process.exit(1);
}

// ---- the entry file format ------------------------------------------------

/**
 * An entry is a markdown file with a small frontmatter block. Markdown because the body is meant
 * to be read by a person and by a model, and both already read markdown; frontmatter because the
 * fields that get filtered on — role, state, rule — must be machine-readable without parsing prose.
 *
 * The parser is deliberately tiny and handles only what this script writes: `key: value` and
 * `key: [a, b]`. Reaching for a YAML dependency would put a package between the skill set and its
 * own notes, and there is nothing here that needs it.
 */
function parseEntry(text, id) {
    const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return null;
    const meta = { id };
    for (const line of match[1].split("\n")) {
        const at = line.indexOf(":");
        if (at === -1) continue;
        const key = line.slice(0, at).trim();
        const raw = line.slice(at + 1).trim();
        meta[key] = raw.startsWith("[")
            ? raw.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean)
            : raw;
    }
    meta.body = match[2];
    return meta;
}

function serialiseEntry(meta, body) {
    const front = Object.entries(meta)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(", ")}]` : v}`)
        .join("\n");
    return `---\n${front}\n---\n\n${body}`;
}

function readAll() {
    if (!existsSync(DEBT_DIR)) return [];
    return readdirSync(DEBT_DIR)
        .filter((f) => f.endsWith(".md") && f !== "README.md")
        .map((f) => parseEntry(readFileSync(join(DEBT_DIR, f), "utf8"), f.replace(/\.md$/, "")))
        .filter(Boolean)
        .sort((a, b) => String(a.opened).localeCompare(String(b.opened)));
}

/**
 * `Cut className from atoms` -> `cut-classname-from-atoms`, so the filename reads as the title.
 *
 * Long titles are cut at a word boundary, never mid-word: an id ending in `max-w` reads as a
 * different thing from `max-w-40`, and the id is what a person types into `show` and `close`.
 * Pass `--id` when the auto-slug would be a mouthful — a title is a sentence, an id is a handle.
 */
function slugify(title) {
    const full = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    if (full.length <= 60) return full;
    const cut = full.slice(0, 60);
    return cut.slice(0, cut.lastIndexOf("-"));
}

const today = () => new Date().toISOString().slice(0, 10);

// ---- resolving a role to a folder ----------------------------------------

/**
 * Ask the workspace registry where a role lives. This shells out rather than reading
 * `context/workspace.json` directly, so there is exactly one piece of code that knows the
 * registry's shape — the moment two do, they drift.
 *
 * Returns null when the machine has no context, or the role is unregistered. That is not an
 * error: an entry can be written before the tree is registered, and only `--check` needs the
 * folder to exist.
 */
function resolveRole(role) {
    if (role === "claude") return REPO;
    try {
        const out = execFileSync(
            process.execPath,
            [join(REPO, "scripts", "read-workspace-context.mjs"), `${role}.path`],
            { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
        );
        return out.trim() || null;
    } catch {
        return null;
    }
}

// ---- commands -------------------------------------------------------------

/**
 * Write a new entry.
 *
 * `--why` is required and the requirement is the point of the whole tool. An entry without it
 * records that something is wrong, which the code already showed; the reason it stayed wrong is
 * the part that only exists in someone's head right now.
 */
function add(flags) {
    const title = flags.title ?? fail("add needs --title");
    const why = flags.why ?? fail(
        "add needs --why",
        "",
        "The reason for deferring is the one thing a later reader cannot recover from the code.",
        "If there is no reason yet, this is not debt — it is a task.",
    );
    const role = flags.role ?? "fe";
    if (!ROLES.includes(role)) fail(`--role must be one of: ${ROLES.join(", ")}`);

    const cost = flags.cost ?? "medium";
    if (!COSTS.includes(cost)) fail(`--cost must be one of: ${COSTS.join(", ")}`);

    const paths = flags.path ?? [];
    // An absolute path would pin the entry to this machine and silently outlive the tree it
    // names. Refuse it here rather than let `--check` report a phantom later.
    for (const p of paths) {
        if (isAbsolute(p) || /^[A-Za-z]:[\\/]/.test(p)) {
            fail(
                `--path must be relative to the ${role} tree, not absolute: ${p}`,
                `Which folder "${role}" means is per-machine; the registry already answers that.`,
            );
        }
    }

    mkdirSync(DEBT_DIR, { recursive: true });

    // Two deferrals of the same thing on different days are the same debt, not two. Reuse the
    // slug and let the writer see the collision instead of quietly creating `-2`.
    const id = flags.id ?? slugify(title);
    const file = join(DEBT_DIR, `${id}.md`);
    if (existsSync(file)) {
        fail(
            `debt "${id}" already exists`,
            `Edit it, close it, or pass --id <other-name>: ${file}`,
        );
    }

    const meta = {
        title,
        role,
        state: "open",
        cost,
        opened: today(),
    };
    if (flags.rule) meta.rule = flags.rule;
    if (flags["blocked-by"]) meta.blocked_by = flags["blocked-by"];
    if (paths.length) meta.paths = paths;

    const body = [
        `## What is wrong`,
        ``,
        flags.what ?? title,
        ``,
        `## Why it was left`,
        ``,
        why,
        ``,
        `## What paying it looks like`,
        ``,
        flags.fix ?? "_Not worked out yet._",
        ``,
        ...(flags.note ? [`## Notes`, ``, flags.note, ``] : []),
    ].join("\n");

    writeFileSync(file, serialiseEntry(meta, body), "utf8");
    console.log(`recorded  ${id}`);
    console.log(`          ${file}`);
}

/** One line per entry — short enough that listing is cheaper than remembering. */
function list(flags) {
    let entries = readAll();
    if (!entries.length) {
        console.log("No debt recorded on this machine.");
        console.log('Record some:  node scripts/record-technical-debt.mjs add --title "..." --why "..."');
        return;
    }
    if (flags.role) entries = entries.filter((e) => e.role === flags.role);
    if (!flags.all) entries = entries.filter((e) => (flags.closed ? e.state === "closed" : e.state === "open"));

    if (flags.json) {
        console.log(JSON.stringify(entries.map(({ body, ...rest }) => rest), null, 2));
        return;
    }

    if (!entries.length) {
        console.log("Nothing matches.");
        return;
    }

    for (const e of entries) {
        const mark = e.state === "closed" ? "×" : "·";
        const rule = e.rule ? ` ${e.rule}` : "";
        console.log(`${mark} ${String(e.id).padEnd(38)} ${String(e.role).padEnd(13)} ${String(e.cost).padEnd(6)}${rule}`);
        console.log(`    ${e.title}`);
    }
    const open = readAll().filter((e) => e.state === "open").length;
    console.log(`\n${entries.length} shown · ${open} open`);
}

function show(id) {
    const file = join(DEBT_DIR, `${id}.md`);
    if (!existsSync(file)) fail(`no debt with id "${id}"`, "List them:  node scripts/record-technical-debt.mjs list --all");
    process.stdout.write(readFileSync(file, "utf8"));
}

/**
 * Close an entry rather than delete it. A paid debt is evidence: it says the shape was noticed,
 * weighed, and settled — which is exactly what stops the next reader reintroducing it.
 */
function close(id, flags) {
    const file = join(DEBT_DIR, `${id}.md`);
    if (!existsSync(file)) fail(`no debt with id "${id}"`);
    const entry = parseEntry(readFileSync(file, "utf8"), id);
    if (entry.state === "closed") fail(`"${id}" is already closed (${entry.closed})`);

    const how = flags.how ?? fail(
        "close needs --how",
        "What actually settled it — the fix, or the reason it stopped being debt.",
    );

    const { body, id: _id, ...meta } = entry;
    meta.state = "closed";
    meta.closed = today();
    writeFileSync(file, serialiseEntry(meta, `${body.trimEnd()}\n\n## Paid ${meta.closed}\n\n${how}\n`), "utf8");
    console.log(`closed  ${id}`);
}

/**
 * Do the recorded paths still exist?
 *
 * Debt rots in both directions. A path can disappear because somebody paid the debt without
 * closing the entry — in which case the entry is now lying about the codebase — or because the
 * file moved, in which case the debt is still real but no longer findable. Either way the entry
 * needs a human, and neither is visible by reading it.
 *
 * Exits 2 on any miss, so this can gate a session without anyone reading the output.
 */
function check() {
    const entries = readAll().filter((e) => e.state === "open");
    if (!entries.length) {
        console.log("No open debt to check.");
        return;
    }

    const roots = new Map();
    let missing = 0;
    let unresolved = 0;

    for (const e of entries) {
        const paths = e.paths ?? [];
        if (!paths.length) continue;

        if (!roots.has(e.role)) roots.set(e.role, resolveRole(e.role));
        const root = roots.get(e.role);

        if (!root) {
            unresolved++;
            console.log(`?  ${e.id}`);
            console.log(`     role "${e.role}" is not registered on this machine — cannot check its paths`);
            continue;
        }

        const gone = paths.filter((p) => !existsSync(join(root, p)));
        if (!gone.length) continue;
        missing++;
        console.log(`!  ${e.id}`);
        for (const p of gone) console.log(`     gone: ${p}`);
    }

    console.log(
        `\n${entries.length} open · ${missing} with vanished paths · ${unresolved} unresolvable role`,
    );
    if (missing) {
        console.log("\nA vanished path means one of two things, and only you can say which:");
        console.log("  - the debt was paid and the entry was never closed  ->  close it");
        console.log("  - the code moved and the entry now points nowhere   ->  update its paths");
        process.exit(2);
    }
}

// ---- dispatch -------------------------------------------------------------

const { flags, positional } = parseArgs(process.argv.slice(2));
const command = positional[0];

if (flags.check) check();
else if (command === "add") add(flags);
else if (command === "show") show(positional[1] ?? fail("show needs an id"));
else if (command === "close") close(positional[1] ?? fail("close needs an id"), flags);
else if (command === "list" || command === undefined) list(flags);
else fail(`unknown command "${command}"`, "", "add · list · show · close · --check");
