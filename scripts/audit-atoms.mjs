#!/usr/bin/env node
/**
 * audit-atoms.mjs — check a repo's atoms against the rules in
 * `design/storybook/architecture/elements/atom.md`.
 *
 * WHAT IT CHECKS, AND WHY THESE THREE
 * Of the nine atom rules, three are decidable by reading code. The rest — "is this really one
 * element", "does it know data" — need judgement, and a script that pretends to answer them
 * would produce confident nonsense.
 *
 *   ATOM-3  an atom imports no other tier
 *   ATOM-4  every atom exposes `isSkeleton`
 *   ATOM-5  `className` passed to an atom carries POSITION only, never appearance
 *
 * WHY ATOM-5 IS AUDITED AT THE CALL SITE
 * The rule is about what callers are allowed to pass, so the evidence is in the callers, not in
 * the atom. An atom cannot stop `text-red-500` being handed to it; only a reader — or this — can
 * see it happen. That is also why it is the rule that erodes quietly: every violation compiles.
 *
 * USAGE
 *   node scripts/audit-atoms.mjs <path-to-repo>
 *   node scripts/audit-atoms.mjs <path-to-repo> --rule ATOM-5
 *   node scripts/audit-atoms.mjs <path-to-repo> --quiet     counts only
 *
 * EXIT CODES
 *   0  no violation of a checkable rule
 *   1  at least one violation
 *
 * The class lists below are Tailwind-shaped because that is what the rule was written against.
 * A repo on another system points this at its own vocabulary with `POSITION_PREFIXES=` /
 * `APPEARANCE_PREFIXES=`.
 */

import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const repo = process.argv[2];
if (!repo) {
    console.error("usage: node scripts/audit-atoms.mjs <path-to-repo> [--rule ATOM-n] [--quiet]");
    process.exit(1);
}
const only = (() => {
    const i = process.argv.indexOf("--rule");
    return i === -1 ? null : (process.argv[i + 1] ?? "").toUpperCase();
})();
const quiet = process.argv.includes("--quiet");

const root = join(repo, ".storybook", "components");
if (!existsSync(root)) {
    console.error(`No .storybook/components in ${repo}.`);
    process.exit(1);
}

const ATOMS_DIR = join(root, "atoms");
if (!existsSync(ATOMS_DIR)) {
    console.error(`No atoms tier in ${repo}. Nothing to audit.`);
    process.exit(1);
}

// ---- what counts as position, and what counts as appearance ---------------
//
// Position answers "where does this sit inside its parent" — a fact about the PARENT, which the
// atom cannot know, so it has to be passable. Appearance answers "what does this look like" — a
// decision the design system already made and exposed as props.
//
// The test behind the split: would the class still make sense if the atom moved to a completely
// different screen? Position classes stop making sense. Appearance classes would still apply,
// which is exactly why they must not travel through `className`.

const POSITION = (process.env.POSITION_PREFIXES ?? [
    "flex-", "grow", "shrink", "basis-", "order-",
    "self-", "justify-self-", "place-self-",
    "col-", "row-",
    "w-", "h-", "min-w-", "max-w-", "min-h-", "max-h-", "size-",
    "m-", "mt-", "mr-", "mb-", "ml-", "mx-", "my-", "-m",
    "absolute", "relative", "fixed", "sticky", "static",
    "top-", "right-", "bottom-", "left-", "inset-", "z-",
    "hidden", "block", "inline", "flex", "grid", "contents",
    "translate-", "-translate-",
].join(",")).split(",").map((s) => s.trim());

const APPEARANCE = (process.env.APPEARANCE_PREFIXES ?? [
    "text-", "bg-", "font-", "leading-", "tracking-",
    "p-", "pt-", "pr-", "pb-", "pl-", "px-", "py-",
    "rounded", "shadow", "border", "ring-", "outline-",
    "opacity-", "gap-", "space-", "divide-",
    "uppercase", "lowercase", "capitalize", "italic", "underline", "line-through", "truncate",
].join(",")).split(",").map((s) => s.trim());

/**
 * Which bucket a single utility class falls in.
 * Responsive and state prefixes are stripped first: `md:text-sm` is still an appearance class,
 * and pretending otherwise would let every violation hide behind a breakpoint.
 *
 * @param {string} raw one class token
 * @returns {"position"|"appearance"|"unknown"}
 */
function classify(raw) {
    const cls = raw.replace(/^(?:[a-z0-9]+:)+/, "").replace(/^!/, "");
    if (!cls) return "unknown";
    const hit = (list) => list.some((p) => (p.endsWith("-") ? cls.startsWith(p) : cls === p || cls.startsWith(`${p}-`)));
    // Appearance is tested first: `border-l-2` is appearance even though `border` looks structural.
    if (hit(APPEARANCE)) return "appearance";
    if (hit(POSITION)) return "position";
    return "unknown";
}

// ---- walking --------------------------------------------------------------

const SKIP = new Set(["_legacy", "node_modules", "dist", "build"]);

function walk(dir, out = []) {
    for (const n of readdirSync(dir)) {
        if (SKIP.has(n)) continue;
        const p = join(dir, n);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (p.endsWith(".tsx") || p.endsWith(".ts")) out.push(p);
    }
    return out;
}

const atomFiles = walk(ATOMS_DIR).filter((f) => !f.split(/[\\/]/).pop().startsWith("_"));
const allFiles = walk(root);
const rel = (f) => relative(repo, f).replace(/\\/g, "/");

/** Component names this repo's atoms export — the vocabulary ATOM-5 protects. */
const atomNames = new Set();
for (const f of atomFiles) {
    const text = readFileSync(f, "utf8");
    for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
        for (const part of m[1].split(",")) {
            const name = (part.includes(" as ") ? part.split(" as ")[1] : part).trim();
            if (/^[A-Z]\w*$/.test(name)) atomNames.add(name);
        }
    }
    for (const m of text.matchAll(/export\s+(?:const|function|class)\s+([A-Z]\w*)/g)) atomNames.add(m[1]);
}

const findings = { "ATOM-3": [], "ATOM-4": [], "ATOM-5": [], "ATOM-5-type": [] };

// ---- ATOM-3 · an atom imports no other tier -------------------------------

const OTHER_TIERS = /from ["'][^"']*components\/(frames|composites|blocks|layouts|overlays|pages)\b/;

for (const f of atomFiles) {
    const text = readFileSync(f, "utf8");
    for (const m of text.matchAll(new RegExp(OTHER_TIERS, "g"))) {
        findings["ATOM-3"].push({ file: rel(f), detail: `imports ${m[1]}` });
    }
}

// ---- ATOM-4 · every atom exposes isSkeleton -------------------------------
//
// Checked per component folder, not per file: an atom is allowed to declare the prop in a types
// file beside the component, and failing it for that would be pedantry rather than a finding.

const atomFolders = new Map();
for (const f of atomFiles) {
    const parts = f.split(/[\\/]/);
    const folder = parts.slice(0, -1).join("/");
    if (!atomFolders.has(folder)) atomFolders.set(folder, []);
    atomFolders.get(folder).push(f);
}

for (const [folder, group] of atomFolders) {
    const text = group.map((f) => readFileSync(f, "utf8")).join("\n");
    // A component folder that renders nothing (constants, maps) is not an atom.
    if (!/\breturn\s*\(|\breturn\s*</.test(text)) continue;
    // An atom that renders no value of its own says so, in one line, where it can be read and
    // argued with. Inferring this instead would be wrong in both directions — exempting one that
    // should shimmer, demanding a shimmer from a divider — and a wrong exemption stays invisible
    // until a row jumps in production.
    if (/@noSkeleton\b/.test(text)) continue;
    if (!/\bisSkeleton\b/.test(text)) {
        findings["ATOM-4"].push({ file: relative(repo, folder).replace(/\\/g, "/"), detail: "no isSkeleton, and no @noSkeleton claim" });
    }
}

// ---- ATOM-5 (type) · the prop is a constrained union, not a free string ----
//
// `className?: string` cannot be constrained: every value type-checks, so the rule can only be
// enforced by a reviewer noticing. `classNames?: Array<AllowedClassName>` moves the same rule
// into the compiler. An atom still declaring the string form has the escape hatch open, and
// every call site below is downstream of that one decision.

for (const [folder, group] of atomFolders) {
    const text = group.map((f) => readFileSync(f, "utf8")).join("\n");
    if (!/\breturn\s*\(|\breturn\s*</.test(text)) continue;
    // Not anchored to the start of a line: an interface written on one line is legal TypeScript
    // and would otherwise slip through. The word boundary keeps `wrapperClassName` out.
    if (/\bclassName\??\s*:\s*string/.test(text)) {
        findings["ATOM-5-type"].push({
            file: relative(repo, folder).replace(/\\/g, "/"),
            detail: "declares `className?: string` — should be `classNames?: Array<AllowedClassName>`",
        });
    }
}

// ---- ATOM-5 · className on an atom carries position only -------------------

/**
 * Where a JSX name in this file actually came from.
 *
 * A tag name is not an identity. One repo can hold three different `Button`s — the house atom,
 * the component library's, and a legacy one — and matching on the name alone reports all three
 * as the same thing. That produced two false findings and one prop added to an atom for a call
 * site that never used it.
 *
 * @param {string} text file contents
 * @returns {Map<string,string>} local name -> module specifier it was imported from
 */
function importOrigins(text) {
    const origins = new Map();
    for (const m of text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
        for (const raw of m[1].split(",")) {
            const part = raw.trim();
            if (!part) continue;
            const local = (part.includes(" as ") ? part.split(" as ")[1] : part).trim();
            origins.set(local, m[2]);
        }
    }
    for (const m of text.matchAll(/import\s+([A-Z]\w*)\s+from\s*["']([^"']+)["']/g)) origins.set(m[1], m[2]);
    return origins;
}

/** Is this name, in this file, the house atom rather than a vendor or legacy component? */
const isHouseAtom = (origins, name, file) => {
    const from = origins.get(name);
    // Not imported at all: it is declared in this file, so it is an atom only if the file is one.
    if (from === undefined) return file.includes(`${sep}atoms${sep}`);
    if (/_legacy/.test(from)) return false;
    return /components\/atoms\//.test(from) || /\/atoms\//.test(from);
};

if (atomNames.size) {
    // `<Atom … className="a b c">` and `<Atom … className={cn("a b", cond && "d")}>`.
    // Only literal strings are read; an expression the script cannot see is left alone rather
    // than guessed at, and that is the honest limit of this check.
    const OPEN = new RegExp(`<(${[...atomNames].join("|")})\\b`, "g");

    /**
     * The text of one opening tag, from `<Name` to its OWN closing `>`.
     *
     * A flat `[^>]*?>` cannot do this. A prop can hold nested JSX — `label={<div className="gap-2">…}`
     * — and the first `>` in the file then belongs to the inner element, so the scan swallows the
     * child's classes and reports them against the parent. That produced a finding on an atom
     * that had no className at all.
     *
     * @param {string} text file contents
     * @param {number} start index of `<`
     * @returns {string} the opening tag, or "" if it never closes
     */
    function openingTag(text, start) {
        let depth = 0, quote = null;
        for (let i = start; i < text.length; i++) {
            const ch = text[i];
            if (quote) { if (ch === quote && text[i - 1] !== "\\") quote = null; continue; }
            if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
            if (ch === "{") depth++;
            else if (ch === "}") depth--;
            else if (ch === ">" && depth === 0) return text.slice(start, i + 1);
        }
        return "";
    }

    /**
     * This tag's own `className`, ignoring any belonging to JSX nested inside a prop.
     *
     * @param {string} tag one opening tag, `<Name … >`
     * @returns {string|{expr: string}|null} the literal, the expression to search, or null
     */
    function ownClassName(tag) {
        let depth = 0, quote = null;
        for (let i = 0; i < tag.length; i++) {
            const ch = tag[i];
            if (quote) { if (ch === quote && tag[i - 1] !== "\\") quote = null; continue; }
            if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
            if (ch === "{") { depth++; continue; }
            if (ch === "}") { depth--; continue; }
            if (depth !== 0) continue;
            // "classNames" also starts with "className" — without this guard the new prop is read
            // as the old one, and a migration looks like it never happened.
            if (!tag.startsWith("className", i) || /[A-Za-z0-9_]/.test(tag[i + 9] ?? "")) continue;

            const eq = tag.indexOf("=", i);
            if (eq === -1) return null;
            let j = eq + 1;
            while (/\s/.test(tag[j])) j++;
            if (tag[j] === '"') {
                const end = tag.indexOf('"', j + 1);
                return end === -1 ? null : tag.slice(j + 1, end);
            }
            if (tag[j] === "{") {
                let d = 0;
                for (let k = j; k < tag.length; k++) {
                    if (tag[k] === "{") d++;
                    else if (tag[k] === "}" && --d === 0) return { expr: tag.slice(j + 1, k) };
                }
            }
            return null;
        }
        return null;
    }

    for (const f of allFiles) {
        const text = readFileSync(f, "utf8");
        const origins = importOrigins(text);
        for (const hit of text.matchAll(OPEN)) {
            const name = hit[1];
            const whole = openingTag(text, hit.index);
            if (!whole) continue;
            if (!isHouseAtom(origins, name, f)) continue;
            // Only THIS tag's own `className`. A prop can hold nested JSX with classes of its
            // own — `label={<div className="gap-2">…}` — and reading the first match in the tag
            // reports the child's classes against the parent. The attribute counts only when it
            // sits at brace depth 0 of the tag.
            const own = ownClassName(whole);
            if (own === null) continue;
            const literals = typeof own === "string"
                ? [own]
                : [...own.expr.matchAll(/"([^"]*)"|'([^']*)'|`([^`$]*)`/g)].map((m) => m[1] ?? m[2] ?? m[3]);

            const bad = [];
            for (const lit of literals) {
                for (const cls of lit.split(/\s+/).filter(Boolean)) {
                    if (classify(cls) === "appearance") bad.push(cls);
                }
            }
            if (bad.length) {
                findings["ATOM-5"].push({
                    file: rel(f),
                    detail: `<${name}> got ${[...new Set(bad)].join(" ")}`,
                });
            }
        }
    }
}

// ---- report ---------------------------------------------------------------

const RULES = {
    "ATOM-3": "an atom imports no other tier — importing one means it is arranging children",
    "ATOM-4": "every atom exposes `isSkeleton` — only the atom knows the space its value will occupy",
    "ATOM-5": "`className` on an atom carries POSITION only — appearance is already a prop",
    "ATOM-5-type": "the prop should be `classNames?: Array<AllowedClassName>` — a free string cannot be constrained",
};

let total = 0;
console.log(`${repo}\n`);
console.log(`atoms found: ${atomFolders.size} component folder(s), ${atomNames.size} exported name(s)\n`);

for (const [rule, list] of Object.entries(findings)) {
    if (only && rule !== only) continue;
    total += list.length;
    const head = `${rule}  ${list.length === 0 ? "ok" : `${list.length} violation(s)`}`;
    console.log(`${head}\n        ${RULES[rule]}`);
    if (!quiet) {
        for (const v of list.slice(0, 40)) console.log(`        ${v.file}\n            ${v.detail}`);
        if (list.length > 40) console.log(`        … and ${list.length - 40} more`);
    }
    console.log("");
}

if (!only) {
    console.log("Not checked here, because they need judgement rather than parsing:");
    console.log("  ATOM-1 is it one element · ATOM-2 does it know data · ATOM-6/7/8/9");
    console.log("  See design/storybook/architecture/elements/atom.md\n");
}

console.log(total ? `${total} violation(s)` : "no violation of a checkable rule");
process.exit(total ? 1 : 0);
