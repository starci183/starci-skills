#!/usr/bin/env node
/**
 * audit-frames.mjs — gate the rules of the `frame` tier that a parser can actually settle.
 *
 * WHY ONLY SOME RULES
 * Six of the eleven frame rules are judgement: whether a prop "describes content", whether a
 * component "owns direction". A script guessing at those is wrong in both directions, and a wrong
 * gate is worse than no gate — it gets trusted. What is left here is every rule that reduces to a
 * fact about the source: which shape a prop has, what the file imports, whether a threshold
 * appears in the props or only inside a class string.
 *
 * WHAT IT CANNOT SEE
 * Whether the frame is *correct*, only whether it is *legal*. A frame passing every gate here can
 * still be arranging the wrong thing. See design/storybook/architecture/elements/frame.md.
 *
 * USAGE
 *   node scripts/audit-frames.mjs <repo>            all checkable rules
 *   node scripts/audit-frames.mjs <repo> --rule FRAME-10
 *   node scripts/audit-frames.mjs <repo> --quiet    counts only
 *
 * EXIT CODES
 *   0  no violation of a checkable rule
 *   1  at least one violation, or the repo argument is unusable
 */

import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const repo = process.argv[2];
if (!repo) {
    console.error("usage: node scripts/audit-frames.mjs <repo> [--rule FRAME-n] [--quiet]");
    console.error("ask the registry:  node scripts/read-workspace-context.mjs fe.path");
    process.exit(1);
}

const only = (() => {
    const i = process.argv.indexOf("--rule");
    return i === -1 ? null : (process.argv[i + 1] ?? "").toUpperCase();
})();
const quiet = process.argv.includes("--quiet");

const root = join(repo, ".storybook", "components");
const FRAMES_DIR = join(root, "frames");
if (!existsSync(FRAMES_DIR)) {
    console.error(`no frame tier at ${FRAMES_DIR}`);
    console.error("a repo with no frames/ folder has nothing for this gate to say");
    process.exit(1);
}

const SKIP = new Set(["_legacy", "node_modules", "dist", "build"]);

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        if (SKIP.has(name)) continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.tsx?$/.test(p) && !/\.stories\.tsx?$/.test(p)) out.push(p);
    }
    return out;
}

const rel = (f) => relative(repo, f).replace(/\\/g, "/");

/** Every frame source. Files starting `_` are shared tables, not components. */
const frameFiles = walk(FRAMES_DIR).filter((f) => !f.split(/[\\/]/).pop().startsWith("_"));

const findings = {
    "FRAME-3": [],
    "FRAME-4": [],
    "FRAME-8": [],
    "FRAME-9": [],
    "FRAME-10": [],
    "FRAME-11": [],
};

// ---- helpers --------------------------------------------------------------

/**
 * The body of every `interface *Props` / `type *Props = {` block in a file.
 *
 * Brace-counted rather than regex-terminated: a prop whose type is an inline object literal
 * contains a `}` of its own, and a lazy match would stop there and report the rest of the
 * interface as missing.
 */
function propBlocks(text) {
    const out = [];
    const re = /(?:export\s+)?(?:interface|type)\s+\w*Props\w*\s*(?:extends\s+[\w<>,\s]+)?=?\s*\{/g;
    for (const m of [...text.matchAll(re)]) {
        let depth = 1;
        let i = m.index + m[0].length;
        for (; i < text.length && depth > 0; i++) {
            if (text[i] === "{") depth++;
            else if (text[i] === "}") depth--;
        }
        out.push(text.slice(m.index + m[0].length, i - 1));
    }
    return out;
}

/** Declared prop names across every Props block in a file. */
function declaredProps(text) {
    const names = new Set();
    for (const block of propBlocks(text)) {
        // Only depth-0 members: a nested object type's fields are not this component's props.
        let depth = 0;
        for (const line of block.split("\n")) {
            const trimmed = line.trim();
            if (depth === 0) {
                const m = trimmed.match(/^(\w+)\s*\??\s*:/);
                if (m) names.add(m[1]);
            }
            depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
        }
    }
    return names;
}

/** Strip comments so a rule never fires on prose that merely mentions the thing. */
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// ---- FRAME-3 · imports run downward only ----------------------------------
//
// A frame may reach DOWN to atoms. Reaching sideways or up means it is arranging something it
// should have been handed, which makes it a composite wearing a frame's name.

const UPWARD = /from ["'][^"']*components\/(composites|blocks|layouts|overlays|pages)\b/;

for (const file of frameFiles) {
    const text = readFileSync(file, "utf8");
    for (const line of text.split("\n")) {
        const m = line.match(UPWARD);
        if (m) findings["FRAME-3"].push({ file: rel(file), detail: `imports from \`${m[1]}\` — imports run downward only` });
    }
}

// ---- FRAME-4 · classNames, not className ----------------------------------
//
// Same closed union as an atom. `className?: string` cannot be constrained, so the rule could
// only ever be enforced by a reviewer noticing.

for (const file of frameFiles) {
    const text = stripComments(readFileSync(file, "utf8"));
    const props = declaredProps(text);
    if (props.has("className") && !props.has("classNames")) {
        findings["FRAME-4"].push({ file: rel(file), detail: "declares `className?: string` and no `classNames` — should be `classNames?: Array<AllowedClassName>`" });
    }
}

// ---- FRAME-8 · chrome that exists as an atom must be imported, not drawn ---
//
// Only the SECOND half of FRAME-8 is checkable. Whether an imported atom was "handed in by the
// caller" needs a person; whether a frame hand-draws a separator while an atom for it exists does
// not. The signal is a chrome-shaped prop with no corresponding atom import.

const CHROME_PROPS = /^(divider|separator|rule|dividers|separators)$/;
const IMPORTS_DIVIDER = /from ["'][^"']*atoms\/[^"']*Divider/;

for (const file of frameFiles) {
    const text = readFileSync(file, "utf8");
    const props = [...declaredProps(stripComments(text))].filter((p) => CHROME_PROPS.test(p));
    if (!props.length || IMPORTS_DIVIDER.test(text)) continue;
    findings["FRAME-8"].push({
        file: rel(file),
        detail: `declares \`${props.join("`, `")}\` but imports no Divider atom — chrome drawn by hand has no name, no props and no story`,
    });
}

// ---- FRAME-9 · `items` or named slots, never `children` -------------------
//
// `children: ReactNode` is a door that can never be narrowed: it accepts anything forever, and no
// later version can constrain it, because the thing to constrain has no name. A named slot keeps
// that possibility open — today ReactNode, tomorrow an array of a known element type.
//
// An earlier version of this gate fired only when `children` sat ALONGSIDE a slot, treating a
// frame that took children alone as legal. That let the unconstrainable case through in exactly
// the frames arranging the most children.

const NAMED_SLOTS = ["body", "main", "start", "end", "rail", "aside", "header", "footer", "content"];

for (const file of frameFiles) {
    const text = stripComments(readFileSync(file, "utf8"));
    const props = declaredProps(text);
    if (!props.has("children")) continue;

    const slots = NAMED_SLOTS.filter((s) => props.has(s));
    const fallback = slots.length
        ? new RegExp(`(${slots.join("|")})\\s*\\?\\?\\s*children`).exec(text)
        : null;

    // Two doors is the worse case and worth naming separately: half the callers are already on a
    // slot, so the migration is half done and the prop list says nothing about which is real.
    if (slots.length) {
        findings["FRAME-9"].push({
            file: rel(file),
            detail: `takes \`children\` AND named slot(s) \`${slots.join("`, `")}\`${fallback ? ` — \`${fallback[0]}\`` : ""}; close the \`children\` door`,
        });
    } else if (props.has("items")) {
        findings["FRAME-9"].push({ file: rel(file), detail: "takes `children` AND `items` — a frame that repeats a list must not also wrap free-form content" });
    } else {
        findings["FRAME-9"].push({
            file: rel(file),
            detail: "takes `children` — a name is what a later type can constrain; give the region a named slot (`body`)",
        });
    }
}

// ---- FRAME-10 · a shape change names its width, as a prop -----------------
//
// Two failures. A boolean threshold says THAT the shape changes and refuses to say where. A
// threshold buried in a class string is worse: the width is real and deliberate, but absent from
// the prop list, so no review that reads the API can see it.

const BOOLEAN_THRESHOLD = /^(wrap|stackOnMobile|stackOnTablet|collapseOnMobile|isStacked|responsive)$/;
/** A breakpoint prefix in a class string — `md:`, `lg:`, `@app-xl:`, `@container-sm:`. */
const BURIED_THRESHOLD = /["'`][^"'`]*(?:^|[\s"'`])@?[\w-]*\b(sm|md|lg|xl|2xl):[\w[\]/.-]+/;
/** A prop whose value names the width — `at`, `breakpoint`, `switchAt`, `from`. */
const NAMED_THRESHOLD = /^(at|breakpoint|switchAt|stackAt|from|until)$/;

for (const file of frameFiles) {
    const text = readFileSync(file, "utf8");
    const bare = stripComments(text);
    const props = declaredProps(bare);

    for (const p of [...props].filter((p) => BOOLEAN_THRESHOLD.test(p))) {
        findings["FRAME-10"].push({ file: rel(file), detail: `\`${p}\` changes shape without naming a width — a boolean fires wherever the content happens to overflow` });
    }

    if ([...props].some((p) => NAMED_THRESHOLD.test(p))) continue;
    const buried = bare.split("\n").find((l) => BURIED_THRESHOLD.test(l) && /className|cn\(/.test(l));
    if (buried) {
        findings["FRAME-10"].push({
            file: rel(file),
            detail: `changes shape at a breakpoint written into a class string, with no prop naming it — \`${buried.trim().slice(0, 76)}\``,
        });
    }
}

// ---- FRAME-11 · the name always; the switch only with chrome --------------
//
// Two separate checks, because the two props answer to different rules.
//
// `anatPart` is universal: a frame cannot name itself (FRAME-2), so every frame takes one.
//
// `showAnatomy` is NOT universal. Its only job is naming chrome the frame drew itself — the
// divider a stack interleaves, the wrapper a grid adds. A frame with no chrome has nothing to
// name, so declaring it there promises a behaviour that does not exist.
//
// This gate therefore reads USAGE, not declaration. An earlier version checked only that the prop
// was declared, went green, and five frames were carrying a switch nothing ever read — three of
// them added by a sweep that was told to copy "the existing convention". A gate that accepts a
// declaration accepts a promise; only reading the body checks whether it is kept.

/** Lines that merely declare or destructure the prop — not a use of its value. */
const isDeclaration = (line, prop) =>
    new RegExp(`${prop}\\s*\\??\\s*:|${prop}\\s*=\\s*(false|true)\\s*[,)]|^\\s*${prop}\\s*,`).test(line);

for (const file of frameFiles) {
    const text = stripComments(readFileSync(file, "utf8"));
    const props = declaredProps(text);

    if (!props.has("anatPart")) {
        findings["FRAME-11"].push({
            file: rel(file),
            detail: "missing `anatPart` — a frame absent from the inspection overlay is absent from every review of every screen holding it",
        });
    }

    if (!props.has("showAnatomy")) continue;

    const read = text.split("\n").some((l) => l.includes("showAnatomy") && !isDeclaration(l, "showAnatomy"));
    if (!read) {
        findings["FRAME-11"].push({
            file: rel(file),
            detail: "declares `showAnatomy` and never reads it — the switch names chrome the frame drew itself; with no chrome there is nothing to name, and the prop promises a behaviour it does not have",
        });
    }
}

// ---- report ---------------------------------------------------------------

const RULES = {
    "FRAME-3": "imports run downward only — a frame reaching up is arranging what it was handed",
    "FRAME-4": "the prop is `classNames: Array<AllowedClassName>` — the same closed union an atom takes",
    "FRAME-8": "chrome that exists as an atom is imported, never hand-drawn",
    "FRAME-9": "`items` or named slots — never `children`, which no later type can constrain",
    "FRAME-10": "a shape change names its width in a PROP, never buried in a class string",
    "FRAME-11": "every frame takes `anatPart`; only a frame with chrome takes `showAnatomy` — and must READ it",
};

console.log(`${repo}\n`);
console.log(`frames found: ${frameFiles.length} file(s)\n`);

let total = 0;
for (const [rule, list] of Object.entries(findings)) {
    if (only && rule !== only) continue;
    total += list.length;
    console.log(`${rule}  ${list.length === 0 ? "ok" : `${list.length} violation(s)`}\n        ${RULES[rule]}`);
    if (!quiet) {
        for (const v of list.slice(0, 40)) console.log(`        ${v.file}\n            ${v.detail}`);
        if (list.length > 40) console.log(`        … and ${list.length - 40} more`);
    }
    console.log("");
}

if (!only) {
    console.log("Not checked here, because they need judgement rather than parsing:");
    console.log("  FRAME-1 does it own arrangement · FRAME-2 does it ask what its children are");
    console.log("  FRAME-5/6/7, and the first half of FRAME-8 (was the atom handed in by the caller)");
    console.log("  See design/storybook/architecture/elements/frame.md\n");
}

console.log(total ? `${total} violation(s)` : "no violation of a checkable rule");
process.exit(total ? 1 : 0);
