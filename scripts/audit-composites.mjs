#!/usr/bin/env node
/**
 * audit-composites.mjs — gate the composite rules a parser can actually settle.
 *
 * WHY ONLY SOME RULES
 * "Is this a reusable shape", "does this prop name a domain entity" — those need judgement, and a
 * script guessing at them produces confident nonsense. What is left is every rule that reduces to
 * a fact about the source: what the file imports, what shape a prop has.
 *
 * THE ONE THAT MATTERS MOST
 * COMPOSITE-3. A UI library is not a tier — it sits beside the whole diagram, reachable from
 * anywhere — so "imports run downward only" never touches it, and a composite reaching past the
 * atom tier straight into the vendor breaks nothing, compiles, and looks ordinary. It is the rule
 * most likely to be broken and the least likely to be noticed, which is precisely the case for
 * spending a gate on it.
 *
 * USAGE
 *   node scripts/audit-composites.mjs <repo>                 # the blueprint tree (.storybook/components)
 *   node scripts/audit-composites.mjs <repo> --tree src      # the app tree (src/components) — same rules
 *   node scripts/audit-composites.mjs <repo> --rule COMPOSITE-3
 *   node scripts/audit-composites.mjs <repo> --quiet
 *
 * The same rules hold on both trees: the app copy is the blueprint minus its anatomy overlay, so a
 * COMPOSITE-4/8/10/3 violation is a violation wherever it renders. Run BOTH before calling it done.
 *
 * EXIT CODES
 *   0  no violation of a checkable rule
 *   1  at least one violation, or the repo argument is unusable
 */

import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const repo = process.argv[2];
if (!repo) {
    console.error("usage: node scripts/audit-composites.mjs <repo> [--rule COMPOSITE-n] [--quiet]");
    console.error("ask the registry:  node scripts/read-workspace-context.mjs fe.path");
    process.exit(1);
}

const only = (() => {
    const i = process.argv.indexOf("--rule");
    return i === -1 ? null : (process.argv[i + 1] ?? "").toUpperCase();
})();
const quiet = process.argv.includes("--quiet");
const tree = (() => {
    const i = process.argv.indexOf("--tree");
    return i !== -1 && (process.argv[i + 1] ?? "").toLowerCase() === "src" ? "src" : "blueprint";
})();

const root = tree === "src" ? join(repo, "src", "components") : join(repo, ".storybook", "components");
const DIR = join(root, "composites");
if (!existsSync(DIR)) {
    console.error(`no composite tier at ${DIR} (tree: ${tree})`);
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
const files = walk(DIR);

/** Comments stripped, so a JSDoc merely naming a vendor component is not read as importing it. */
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const findings = { "COMPOSITE-3": [], "COMPOSITE-3-missing-atom": [], "COMPOSITE-4": [], "COMPOSITE-8": [], "COMPOSITE-10": [] };

// ---- which atoms the house already has ------------------------------------
//
// Needed to tell the two failures apart. A composite importing a vendor Typography when the house
// HAS a Typography atom is a plain error. Importing a vendor Table when the house has no Table is
// a missing atom — same symptom, different work, and reporting them as one number would hide the
// only part of this that is a to-do list.

const ATOMS_DIR = join(root, "atoms");
const houseAtoms = new Set();
if (existsSync(ATOMS_DIR)) {
    for (const name of readdirSync(ATOMS_DIR)) {
        const group = join(ATOMS_DIR, name);
        if (!statSync(group).isDirectory() || SKIP.has(name)) continue;
        for (const atom of readdirSync(group)) {
            if (statSync(join(group, atom)).isDirectory() && !atom.startsWith("_")) houseAtoms.add(atom);
        }
    }
}

// ---- COMPOSITE-3 · the vendor stops at the atom tier ----------------------
//
// `cn` and friends are functions: they compose strings and render nothing, so they are not what
// this rule is about. Anything that renders is.

const VENDOR = /import\s*\{([^}]*)\}\s*from\s*["'](@heroui\/react|@nextui-org\/react|antd|@mui\/material|@chakra-ui\/react)["']/g;
const UTILITY = /^(cn|clsx|tv|cva|twMerge|useDisclosure|type\s+\w+)$/;

for (const file of files) {
    const text = strip(readFileSync(file, "utf8"));
    for (const m of text.matchAll(VENDOR)) {
        const imported = m[1]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => (s.includes(" as ") ? s.split(" as ")[0].trim() : s))
            .filter((n) => !UTILITY.test(n));
        if (!imported.length) continue;

        const known = imported.filter((n) => houseAtoms.has(n));
        const missing = imported.filter((n) => !houseAtoms.has(n));

        if (known.length) {
            findings["COMPOSITE-3"].push({
                file: rel(file),
                detail: `imports ${known.map((n) => `\`${n}\``).join(", ")} from ${m[2]} — the house already has that atom`,
            });
        }
        if (missing.length) {
            findings["COMPOSITE-3-missing-atom"].push({
                file: rel(file),
                detail: `imports ${missing.map((n) => `\`${n}\``).join(", ")} from ${m[2]} — no house atom wraps it yet`,
            });
        }
    }
}

// ---- COMPOSITE-4 · classNames, not className ------------------------------
//
// A composite is where the free string usually enters the system: it declares `className?: string`,
// takes whatever a caller hands over, and forwards it into an atom whose own union says nothing
// about what happened one level up.

function propBlocks(text, kinds = "Props") {
    const out = [];
    const re = new RegExp(`(?:export\\s+)?(?:interface|type)\\s+\\w*(?:${kinds})\\w*\\s*(?:extends\\s+[\\w<>,\\s]+)?=?\\s*\\{`, "g");
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

for (const file of files) {
    const text = strip(readFileSync(file, "utf8"));
    const declared = new Set();
    for (const block of propBlocks(text)) {
        let depth = 0;
        for (const line of block.split("\n")) {
            if (depth === 0) {
                const m = line.trim().match(/^(\w+)\s*\??\s*:/);
                if (m) declared.add(m[1]);
            }
            depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
        }
    }
    if (declared.has("className")) {
        findings["COMPOSITE-4"].push({
            file: rel(file),
            detail: `declares \`className\`${declared.has("classNames") ? " alongside `classNames` — delete the old door, there is no deprecated stage" : " — should be `classNames?: Array<AllowedClassName>`"}`,
        });
    }
}

// ---- COMPOSITE-10 · it decides WHICH and HOW MANY, never the shape --------
//
// The loading state splits on the same line the whole architecture runs on. The SHAPE of one
// shimmer is the atom's, because only it knows the space its value occupies. WHICH parts shimmer
// and HOW MANY is the composite's, because only it knows what it is a shape of — a loading list is
// three rows, and nothing one tier down can supply the number three.
//
// So this gate checks the half a parser can settle: is the composite DRAWING a bar? Choosing a
// count is legitimate and looks like ordinary code; importing a vendor Skeleton does not.
//
// Checked separately from COMPOSITE-3 even though a vendor Skeleton import breaks both, because
// the fixes differ: COMPOSITE-3 says "use the house atom", and there is deliberately no Skeleton
// atom to use. The answer here is to delete the drawing and forward `isSkeleton` instead.

const SKELETON = /\b(Skeleton|HeroSkeleton|SkeletonText|SkeletonCircle)\b/;

for (const file of files) {
    const text = strip(readFileSync(file, "utf8"));
    const importsSkeleton = [...text.matchAll(VENDOR)].some((m) => SKELETON.test(m[1]));
    if (!importsSkeleton) continue;
    findings["COMPOSITE-10"].push({
        file: rel(file),
        detail: "draws its own shimmer — render the real structure with `isSkeleton` forwarded; you choose how many, the atom chooses the shape",
    });
}

// ---- COMPOSITE-8 · what it renders, it must be able to BUILD --------------
//
// A `ReactNode` prop has already been called by the time it arrives. The composite cannot reach
// inside to say "you are loading" — not without cloneElement, which silently overwrites props the
// caller set. So a composite that declares `isSkeleton` and ALSO takes `ReactNode` has promised
// something its own signature makes impossible.
//
// Scoped deliberately to composites that claim a loading state. A composite with no `isSkeleton`
// has promised nothing yet, so its `ReactNode` props are not a contradiction — they are just a
// decision nobody has had to make. Reporting those too would triple the count with cases that are
// not yet wrong, and a gate padded with hypotheticals gets ignored.
//
// The fix is a REFERENCE rather than a node: `ComponentType<{ isSkeleton?: boolean }>` for a
// region, `ComponentType` for an icon, `string` for text the composite wraps itself.

for (const file of files) {
    const text = strip(readFileSync(file, "utf8"));
    if (!/\bisSkeleton\b/.test(text)) continue;

    // Scan Props AND the item/slot shapes a composite renders (`*Item*`/`*Slot*`) — a `ReactNode`
    // field one level in, inside `items[]`, is the same trap as one on the top-level props
    // (COMPOSITE-8, "the same trap, one level in"). `children` is exempt: on an internal wrapper it
    // is a genuine pass-through the composite adds nothing to.
    const nodes = [];
    for (const block of propBlocks(text, "Props|Item|Slot")) {
        let depth = 0;
        for (const line of block.split("\n")) {
            if (depth === 0) {
                const m = line.trim().match(/^(\w+)\s*\??\s*:\s*ReactNode\b/);
                if (m && m[1] !== "children") nodes.push(m[1]);
            }
            depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
        }
    }
    if (!nodes.length) continue;

    findings["COMPOSITE-8"].push({
        file: rel(file),
        detail: `declares \`isSkeleton\` and takes ${nodes.length} \`ReactNode\` prop(s) — ${nodes.slice(0, 6).map((n) => `\`${n}\``).join(", ")}${nodes.length > 6 ? ", …" : ""}; a node arrives already called, so the flag cannot reach inside it`,
    });
}

// ---- report ---------------------------------------------------------------

const RULES = {
    "COMPOSITE-3": "the vendor stops at the atom tier — and this atom already exists",
    "COMPOSITE-3-missing-atom": "a vendor component with no house atom — this list is the atom tier's to-do",
    "COMPOSITE-4": "the prop is `classNames: Array<AllowedClassName>`, and `className` is deleted, not deprecated",
    "COMPOSITE-8": "what it renders it must be able to BUILD — a reference, never an already-called node",
    "COMPOSITE-10": "decide WHICH parts shimmer and HOW MANY — the shape of each is the atom's",
};

console.log(`${repo}\n`);
console.log(`composites found: ${files.length} file(s)\n`);

let total = 0;
for (const [rule, list] of Object.entries(findings)) {
    if (only && rule !== only) continue;
    // The missing-atom list is information, not a failure: nobody can fix it without first adding
    // an atom, and counting it as a violation would make the gate un-greenable by design.
    if (rule !== "COMPOSITE-3-missing-atom") total += list.length;
    const label = rule === "COMPOSITE-3-missing-atom" ? `${list.length} to add` : list.length === 0 ? "ok" : `${list.length} violation(s)`;
    console.log(`${rule}  ${label}\n        ${RULES[rule]}`);
    if (!quiet) {
        for (const v of list.slice(0, 40)) console.log(`        ${v.file}\n            ${v.detail}`);
        if (list.length > 40) console.log(`        … and ${list.length - 40} more`);
    }
    console.log("");
}

if (!only) {
    console.log("Not checked here, because they need judgement rather than parsing:");
    console.log("  COMPOSITE-1 is it a reusable shape · COMPOSITE-2/7 does a prop name a domain entity");
    console.log("  COMPOSITE-5/6/8/9");
    console.log("  See canon/fe/enforce/tiers/composite.md\n");
}

console.log(total ? `${total} violation(s)` : "no violation of a checkable rule");
process.exit(total ? 1 : 0);
