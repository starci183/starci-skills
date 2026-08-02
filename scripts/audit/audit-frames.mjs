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
 * still be arranging the wrong thing. See canon/fe/enforce/tiers/frame.md.
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

const arg = (flag) => {
    const i = process.argv.indexOf(flag);
    return i === -1 ? null : (process.argv[i + 1] ?? "");
};
/** `--rule 10` is what a person types; the tier is not in doubt once this script was chosen. */
const only = (() => {
    const raw = (arg("--rule") ?? "").trim();
    return raw ? `FRAME-${raw.replace(/^(?:frame|rule)[-\s]*/i, "")}` : null;
})();
const quiet = process.argv.includes("--quiet");
const showSuspects = process.argv.includes("--suspects");

/**
 * Which tree. The blueprint carries the inspection overlay; the copy the app imports carries none,
 * and FRAME-12 is the rule that says so.
 */
const tree = (arg("--tree") ?? "storybook").toLowerCase();
if (!["storybook", "src"].includes(tree)) {
    console.error(`--tree takes "storybook" or "src", not "${tree}"`);
    process.exit(1);
}
const root = tree === "src" ? join(repo, "src", "components") : join(repo, ".storybook", "components");
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

/**
 * EVERY RULE IS REPORTED. NOT EVERY RULE IS A VERDICT.
 *
 * An earlier cut checked six and named the rest in one closing line as "needs judgement". A rule
 * nobody reports is a rule nobody enforces — that is how FRAME-11 and FRAME-9 both went green over
 * a tree that broke them. So the judgement rules print their candidates and hand them to a person,
 * counted separately and never failing the gate.
 */
const findings = {
    "FRAME-1": [],
    "FRAME-2": [],
    "FRAME-3": [],
    "FRAME-4": [],
    "FRAME-5": [],
    "FRAME-8": [],
    "FRAME-9": [],
    "FRAME-10": [],
    "FRAME-11": [],
    "FRAME-12": [],
};

/** Reported with evidence, never counted — these need a person, not a parser. */
const SUSPECT = new Set(["FRAME-1", "FRAME-2", "FRAME-5"]);

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
    // Declaring BOTH is the state this rule most needs to catch, and the earlier `&& !classNames`
    // guard let it through — every frame in the tier held two doors, one of them the closed union
    // and one of them a free string, and the gate read that as compliance. Canon is explicit that
    // there is no `@deprecated` stage: the old prop goes in the same change the new one arrives.
    if (props.has("className")) {
        findings["FRAME-4"].push({
            file: rel(file),
            detail: props.has("classNames")
                ? "declares `className?: string` BESIDE `classNames` — a second door, still open"
                : "declares `className?: string` — should be `classNames?: Array<AllowedClassName>`",
        });
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

    // On the app's copy the rule inverts. There is no overlay there to feed, so a frame carrying
    // `anatPart` is drift from the blueprint rather than a frame doing its job — the same shape as
    // ATOM-10 read against `--tree src`. Demanding the prop on that tree would have every frame in
    // the app fail a rule it is right to break.
    if (tree === "src") {
        const carried = ["showAnatomy", "anatPart", "data-anat-part"].filter((k) => text.includes(k));
        if (carried.length) {
            findings["FRAME-11"].push({
                file: rel(file),
                detail: `carries ${carried.join(", ")} — this tree has no inspection overlay to feed`,
            });
        }
        continue;
    }

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

// ---- FRAME-1 / FRAME-2 / FRAME-5 · the judgement three ---------------------
//
// FRAME-7 is the detection signal for FRAME-2, so both are answered by the same evidence: a prop
// that makes the CALLER DESCRIBE ITS OWN CONTENT. `title`, `label`, `icon`, `description` are the
// shapes of that failure — a frame taking one has stopped being indifferent to what it arranges.
// Reported rather than counted, because a `label` on a frame can legitimately name the region for
// assistive tech rather than describe the content.

const CONTENT_PROPS = /^(title|label|text|description|caption|heading|subtitle|icon|image|avatar|value)$/i;
const ARRANGEMENT_PROPS = /^(gap|direction|align|justify|wrap|at|columns|rows|padding|inset|dividers?|reverse|as|items|children|anatPart|showAnatomy|classNames)$/;

for (const file of frameFiles) {
    const text = stripComments(readFileSync(file, "utf8"));
    const props = [...declaredProps(text)];

    const content = props.filter((p) => CONTENT_PROPS.test(p));
    if (content.length) {
        findings["FRAME-2"].push({
            file: rel(file),
            detail: `takes ${content.map((p) => `\`${p}\``).join(", ")} — a prop that makes the caller describe its own content`,
        });
    }

    // FRAME-1 owns direction, seam, alignment and its own chrome. A prop that is neither an
    // arrangement word nor a named slot is the cheapest sign that something else moved in here.
    const stray = props.filter((p) => !ARRANGEMENT_PROPS.test(p) && !CONTENT_PROPS.test(p) && !/^(start|end|rail|body|main|aside|header|footer|top|bottom|leading|trailing)$/.test(p));
    if (stray.length) {
        findings["FRAME-1"].push({
            file: rel(file),
            detail: `prop(s) outside arrangement and slots: ${stray.map((p) => `\`${p}\``).join(", ")} — confirm each is direction, seam, alignment, or the frame's own chrome`,
        });
    }

    // FRAME-5 is about WHAT a frame composes, not whether it composes. Arrangement is its job;
    // appearance is the atom's word. The checkable half is the appearance token appearing in a
    // frame's own class strings — legal only when it is chrome the frame draws itself, which is a
    // call a person makes. Measured on a healthy tier, eight of nine frames have none of these.
    const appearance = new Set();
    for (const m of text.matchAll(/"([^"]*)"/g)) {
        for (const cls of m[1].split(/\s+/)) {
            const bare = cls.replace(/^(?:[\w@.-]+:)+/, "");
            if (/^(border|bg-|rounded|shadow|ring-|text-(?!start|center|end)|font-|opacity-|italic|uppercase)/.test(bare)) appearance.add(bare);
        }
    }
    if (appearance.size) {
        findings["FRAME-5"].push({
            file: rel(file),
            detail: `composes appearance: ${[...appearance].join(" ")} — legal only as chrome the frame draws itself, and by FRAME-8 chrome with an atom must import it`,
        });
    }
}

// ---- FRAME-12 · the app's copy is the blueprint minus the overlay ----------
//
// Kept identical to ATOM-11's comparison, deliberately: two gates disagreeing about what "the same
// file" means would be worse than either being slightly wrong.

const BLUEPRINT_FRAMES = join(repo, ".storybook", "components", "frames");
const COPY_FRAMES = join(repo, "src", "components", "frames");

if (existsSync(BLUEPRINT_FRAMES) && existsSync(COPY_FRAMES)) {
    const foldEntry = (p) => {
        const parts = p.split("/");
        const file = parts[parts.length - 1].replace(/\.tsx?$/, "");
        const folder = parts[parts.length - 2];
        return file === "index" || file === folder ? [...parts.slice(0, -1), "·entry"].join("/") : p;
    };
    const listing = (base) =>
        new Map(walk(base).map((f) => {
            const key = relative(base, f).replace(/\\/g, "/");
            return [foldEntry(key), { key, file: f }];
        }));

    const blueprint = listing(BLUEPRINT_FRAMES);
    const copy = listing(COPY_FRAMES);

    for (const [folded, v] of copy) {
        if (folded.endsWith("·entry") && !/(^|\/)index\.tsx?$/.test(v.key)) {
            findings["FRAME-12"].push({
                file: `src/components/frames/${v.key}`,
                detail: "the app's entry file is `index.tsx` — a call site imports the folder, not the name twice",
            });
        }
    }
    for (const [folded, v] of blueprint) {
        if (!copy.has(folded)) findings["FRAME-12"].push({ file: `.storybook/components/frames/${v.key}`, detail: "in the blueprint, missing from the app's copy — the change never crossed" });
    }
    for (const [folded, v] of copy) {
        if (!blueprint.has(folded)) findings["FRAME-12"].push({ file: `src/components/frames/${v.key}`, detail: "in the app's copy, absent from the blueprint — nobody designed it" });
    }

    const normalise = (t) =>
        stripComments(t)
            .replace(/\s*data-anat-part=\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, "")
            .replace(/\s*\b(?:showAnatomy|anatPart)\s*=\s*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|"[^"]*")/g, "")
            // Stops at `)` too — a typed parameter otherwise swallows its own signature's tail.
            .replace(/\b(?:showAnatomy|anatPart)\s*\??\s*:\s*[^;,)\n}]+/g, "")
            .replace(/\b(?:showAnatomy|anatPart)\b\s*(?:=\s*(?:\{[^{}]*\}|"[^"]*"|[\w.]+))?\s*,?/g, "")
            .replace(/,\s*,/g, ",")
            .replace(/([{(])\s*,/g, "$1")
            .replace(/,\s*([})])/g, "$1")
            .replace(/\{\s*\}/g, "")
            .replace(/(["'])@sb-components\//g, "$1@/components/")
            .replace(/(["'][^"']*\/(\w+))\/\2(["'])/g, "$1$3")
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
    const flat = (lines) => lines.join(" ").replace(/\s+/g, " ").replace(/\s*([<>{}()[\],;:])\s*/g, "$1").trim();

    for (const [folded, v] of blueprint) {
        const twin = copy.get(folded);
        if (!twin) continue;
        const a = normalise(readFileSync(v.file, "utf8"));
        const b = normalise(readFileSync(twin.file, "utf8"));
        if (flat(a) === flat(b)) continue;
        const inCopy = new Set(b);
        const inBlueprint = new Set(a);
        findings["FRAME-12"].push({
            file: `frames/${v.key}`,
            detail: `the two trees differ beyond the overlay — ${a.filter((l) => !inCopy.has(l)).length} line(s) only in the blueprint, ${b.filter((l) => !inBlueprint.has(l)).length} only in the app's copy`,
        });
    }
}

// ---- report ---------------------------------------------------------------

const RULES = {
    "FRAME-1": "it owns direction, seam, alignment, and its own chrome — nothing else",
    "FRAME-2": "it never asks what its children are — FRAME-7 is this rule's detection signal",
    "FRAME-3": "imports run downward only — a frame reaching up is arranging what it was handed",
    "FRAME-5": "composing classes is this tier's work",
    "FRAME-12": "the app's copy is the blueprint minus the overlay — and a change lands in both",
    "FRAME-4": "the prop is `classNames: Array<AllowedClassName>` — the same closed union an atom takes",
    "FRAME-8": "chrome that exists as an atom is imported, never hand-drawn",
    "FRAME-9": "`items` or named slots — never `children`, which no later type can constrain",
    "FRAME-10": "a shape change names its width in a PROP, never buried in a class string",
    "FRAME-11": "every frame takes `anatPart`; only a frame with chrome takes `showAnatomy` — and must READ it",
};

console.log(`${repo}`);
console.log(`tree: ${relative(repo, root).replace(/\\/g, "/")}\n`);
console.log(`frames found: ${frameFiles.length} file(s)\n`);

let violations = 0;
let suspects = 0;
for (const [rule, list] of Object.entries(findings)) {
    if (only && rule !== only) continue;
    const isSuspect = SUSPECT.has(rule);
    if (isSuspect) suspects += list.length;
    else violations += list.length;

    const label = list.length === 0 ? "ok" : isSuspect ? `${list.length} to judge` : `${list.length} violation(s)`;
    console.log(`${rule}  ${label}\n        ${RULES[rule]}`);

    const show = !quiet && (!isSuspect || showSuspects || only === rule);
    if (show) {
        const cap = only ? list.length : 40;
        for (const v of list.slice(0, cap)) console.log(`        ${v.file}\n            ${v.detail}`);
        if (list.length > cap) console.log(`        … and ${list.length - cap} more`);
    } else if (isSuspect && list.length && !quiet) {
        console.log(`        (run with --suspects, or --rule ${rule.replace(/^FRAME-/, "")}, to read them)`);
    }
    console.log("");
}

if (!only) {
    console.log("FRAME-6 / FRAME-7  derived");
    console.log("        FRAME-6 confirms a placement and FRAME-7 detects a wrong one — both are");
    console.log("        answered by FRAME-1 and FRAME-2 above. The first half of FRAME-8 (was the");
    console.log("        atom handed in by the caller?) still needs a person.\n");
}

console.log(violations ? `${violations} violation(s)` : "no violation of a checkable rule");
if (suspects) console.log(`${suspects} candidate(s) needing judgement — these do not fail the gate`);
process.exit(violations ? 1 : 0);
