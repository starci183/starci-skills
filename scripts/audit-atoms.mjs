#!/usr/bin/env node
/**
 * audit-atoms.mjs — check a repo's atoms against the rules in
 * `canon/fe/enforce/tiers/atom.md`.
 *
 * EVERY RULE APPEARS IN THE OUTPUT. NOT EVERY RULE IS A VERDICT.
 * An earlier cut checked five rules and printed one line naming the rest as "needs judgement".
 * Four times now, a rule with no check has gone green while the tree broke it — FRAME-11, FRAME-9,
 * ATOM-8, and ATOM-10, which was not even in the not-checked line. A rule nobody reports is a rule
 * nobody enforces, so all eleven are reported here, in two kinds:
 *
 *   VIOLATION — decidable by reading code. Counted, and sets the exit code.
 *   SUSPECT   — the rule needs a person, so the script hands over evidence instead of a verdict.
 *               Printed with the file and what triggered it. Never counted, never fails the gate.
 *
 * The split is the honest one. "Is this really one element" cannot be parsed, and a script
 * pretending otherwise produces confident nonsense — but staying silent is how the last four got
 * through, so the candidates go on the page and a person answers them.
 *
 *   ATOM-1   places a child the caller handed in                          suspect
 *   ATOM-2   knows a domain entity                                        suspect
 *   ATOM-3   imports another tier                                         violation
 *   ATOM-4   exposes `isSkeleton`, or claims `@noSkeleton`                violation
 *   ATOM-4-shape  shimmer width is a fraction; height is never passable   violation
 *   ATOM-5   `className` at a CALL SITE carries position only             violation
 *   ATOM-5-type   the prop is a closed union, not a free string           violation
 *   ATOM-6   decides its own appearance, and keeps the classes private    suspect
 *   ATOM-7   confirmation rule — satisfied when 1, 2 and 8 are            derived
 *   ATOM-8   renders another atom from a list                             violation
 *   ATOM-9   the vendor stops at `Base`                                   violation
 *   ATOM-10  takes the inspection switch, never the part name             violation
 *   ATOM-11  the app's copy is the same file minus the anatomy overlay    violation
 *
 * WHY ATOM-5 IS AUDITED AT THE CALL SITE
 * The rule is about what callers are allowed to pass, so the evidence is in the callers, not in
 * the atom. An atom cannot stop `text-red-500` being handed to it; only a reader — or this — can
 * see it happen. That is also why it is the rule that erodes quietly: every violation compiles.
 *
 * TWO TREES, ONE GATE
 * A design system that keeps a blueprint (`.storybook/components`) and a copy the app imports
 * (`src/components`) has to hold both to the same rules, or the copy drifts — it already has.
 * `--tree src` points every check at the copy. The one rule that genuinely differs is ATOM-10:
 * the copy carries no inspection tooling at all, so there the rule reads "no anatomy, anywhere".
 *
 * USAGE
 *   node scripts/audit-atoms.mjs <path-to-repo>
 *   node scripts/audit-atoms.mjs <path-to-repo> --tree src
 *   node scripts/audit-atoms.mjs <path-to-repo> --rule 5
 *   node scripts/audit-atoms.mjs <path-to-repo> --rule 5-type
 *   node scripts/audit-atoms.mjs <path-to-repo> --quiet        counts only
 *   node scripts/audit-atoms.mjs <path-to-repo> --suspects     suspects too, in full
 *
 * EXIT CODES
 *   0  no violation of a checkable rule
 *   1  at least one violation
 *
 * The class lists below are Tailwind-shaped because that is what the rule was written against.
 * A repo on another system points this at its own vocabulary with `POSITION_PREFIXES=` /
 * `APPEARANCE_PREFIXES=`, and names its component library in `VENDOR_MODULES=`.
 */

import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const repo = process.argv[2];
if (!repo) {
    console.error("usage: node scripts/audit-atoms.mjs <path-to-repo> [--tree src] [--rule n] [--quiet] [--suspects]");
    process.exit(1);
}
const arg = (flag) => {
    const i = process.argv.indexOf(flag);
    return i === -1 ? null : (process.argv[i + 1] ?? "");
};
/**
 * A rule is named with its tier — `ATOM-5`, not `rule 5`. Every doc at this layer cross-references
 * another tier's rules, and a bare number there cannot say which tier it means. `--rule 5` is
 * still accepted as shorthand because the tier is not in doubt once you have picked the script.
 */
const only = (() => {
    const raw = (arg("--rule") ?? "").trim();
    if (!raw) return null;
    return `ATOM-${raw.replace(/^(?:atom|rule)[-\s]*/i, "")}`;
})();
const quiet = process.argv.includes("--quiet");
const showSuspects = process.argv.includes("--suspects");

/**
 * Which tree to audit. The blueprint carries the inspection tooling; the copy the app imports
 * carries none, and that difference is a rule (ATOM-10), not a tolerance.
 */
const tree = (arg("--tree") ?? "storybook").toLowerCase();
if (!["storybook", "src"].includes(tree)) {
    console.error(`--tree takes "storybook" or "src", not "${tree}"`);
    process.exit(1);
}
const TREE_ROOT = tree === "src" ? join("src", "components") : join(".storybook", "components");

const root = join(repo, TREE_ROOT);
if (!existsSync(root)) {
    console.error(`No ${TREE_ROOT.replace(/\\/g, "/")} in ${repo}.`);
    process.exit(1);
}

const ATOMS_DIR = join(root, "atoms");
if (!existsSync(ATOMS_DIR)) {
    console.error(`No atoms tier in ${repo}/${TREE_ROOT.replace(/\\/g, "/")}. Nothing to audit.`);
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

/** The component library this system wraps. ATOM-9 is about where its imports are allowed to sit. */
const VENDOR = (process.env.VENDOR_MODULES ?? "@heroui/react,@nextui-org/react,@radix-ui,@mui/material")
    .split(",").map((s) => s.trim()).filter(Boolean);

/**
 * Nouns this product's domain is made of. ATOM-2 is the line that decides the tier, and the
 * cheapest evidence that it was crossed is an atom naming one of these in a prop.
 */
const DOMAIN_WORDS = (process.env.DOMAIN_WORDS ?? [
    "course", "lesson", "module", "chapter", "enrollment", "challenge", "submission",
    "quiz", "flashcard", "deck", "attempt", "interview", "payment", "order", "invoice",
    "subscription", "leaderboard", "consultant", "headhunting",
].join(",")).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

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

/**
 * Where ATOM-5 looks for call sites — every file that can render an atom, not just the ones in the
 * component tree.
 *
 * The stories are call sites. They are the densest ones in the repo: every atom has a file whose
 * whole job is calling it every way it can be called. An earlier cut walked `components/` only, so
 * three hundred and seventy story files were never opened, and the rule reported two violations
 * out of half a repo while reading as a whole-repo number. A gate that names its own scope nowhere
 * is a gate whose zero cannot be trusted.
 */
const STORIES_DIR = join(repo, ".storybook", "stories");
const callSiteFiles = existsSync(STORIES_DIR) ? [...allFiles, ...walk(STORIES_DIR)] : allFiles;
const rel = (f) => relative(repo, f).replace(/\\/g, "/");
const relFolder = (d) => relative(repo, d).replace(/\\/g, "/");

/**
 * Drop comments before looking for rendered tags. A JSDoc saying "renders a `ButtonBase` per item"
 * would otherwise be read as the code doing it — the rule would then fire on files that merely
 * describe the shape it forbids.
 */
const stripBlockComments = (t) =>
    t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

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

/** Files grouped by component folder — several rules are about the component, not one file. */
const atomFolders = new Map();
for (const f of atomFiles) {
    const folder = f.split(/[\\/]/).slice(0, -1).join(sep);
    if (!atomFolders.has(folder)) atomFolders.set(folder, []);
    atomFolders.get(folder).push(f);
}

/**
 * A folder that renders nothing — constants, token tables, maps — is not a component, and the
 * rules about props and skeletons have nothing to attach to.
 *
 * The implicit-return arrow has to count. An earlier cut looked for `return (` only, so a component
 * written `const ToastBase = (p) => (<Alert … />)` was silently not a component: every per-folder
 * rule skipped it and the gate printed `ok` for a folder it had never opened. That is the same
 * failure as a rule with no check, one level down — the check exists, and quietly audits nothing.
 */
const rendersSomething = (text) => /\breturn\s*[(<]|=>\s*[(<]/.test(text);

const findings = {
    "ATOM-1": [], "ATOM-2": [], "ATOM-3": [], "ATOM-4": [], "ATOM-4-shape": [],
    "ATOM-5": [], "ATOM-5-type": [], "ATOM-6": [], "ATOM-8": [], "ATOM-9": [], "ATOM-10": [],
    "ATOM-11": [],
};

/** Rules the script hands over rather than decides. Reported in full, never counted. */
const SUSPECT = new Set(["ATOM-1", "ATOM-2", "ATOM-6"]);

// ---- ATOM-1 · an atom is one element --------------------------------------
//
// Not parseable, so this reports candidates. The rule's own wording gives the cheapest signal:
// "if it places a child the caller handed in, it is a composite that took the wrong name". A
// `children` prop is exactly that, rendered verbatim.
//
// It is a SUSPECT and not a violation because the tier has real members that hold content they
// did not choose — a popover, a tooltip, a toast are chrome around someone else's node, and the
// examples file lists all three as atoms. Telling those from a composite needs a person.

for (const [folder, group] of atomFolders) {
    const text = group.map((f) => readFileSync(f, "utf8")).join("\n");
    if (!rendersSomething(text)) continue;
    const stripped = stripBlockComments(text);
    const declares = /\bchildren\??\s*:\s*(React\.)?ReactNode\b/.test(stripped);
    const renders = /\{\s*children\s*\}/.test(stripped);
    if (declares || renders) {
        findings["ATOM-1"].push({
            file: relFolder(folder),
            detail: `takes \`children\` — confirm the content is its own chrome, not a child the caller placed`,
        });
    }
}

// ---- ATOM-2 · it knows nothing about data ---------------------------------
//
// The dividing question for the whole architecture is "does it know a domain entity". A prop
// called `courseId` answers it. Reported rather than counted, because a word can be innocent —
// `order` is a domain noun and also `order-first`.

for (const [folder, group] of atomFolders) {
    const text = stripBlockComments(group.map((f) => readFileSync(f, "utf8")).join("\n"));
    if (!rendersSomething(text)) continue;
    const hits = new Set();
    for (const m of text.matchAll(/^\s*(?:readonly\s+)?([a-z]\w*)\??\s*:/gm)) {
        const prop = m[1];
        if (/^\w+Id$/.test(prop) && prop !== "id") hits.add(prop);
        else if (DOMAIN_WORDS.some((w) => prop.toLowerCase() === w || prop.toLowerCase().startsWith(w))) hits.add(prop);
    }
    if (hits.size) {
        findings["ATOM-2"].push({
            file: relFolder(folder),
            detail: `prop(s) name a domain entity: ${[...hits].join(", ")}`,
        });
    }
}

// ---- ATOM-3 · an atom imports nothing from this system --------------------
//
// Two shapes of the same violation. Importing a HIGHER tier (a frame, a composite) is an atom
// arranging its own children. Importing ANOTHER ATOM is an atom assembling the vocabulary rather
// than being a word in it — a composite in the atom folder. Both are caught here.
//
// The vendor is not this system, so a vendor import is fine (ATOM-9). And a `_`-prefixed sibling
// (`_allowed-class-name`, `_field`, `_skeleton`) is shared material below the naming line, not a
// tier member — importing it is not composing an atom. A VALUE import from another atom's file is
// the violation; a `import type` is only sharing a type and is exempted, because a shared enum is
// not an assembled component.

const OTHER_TIERS = /from ["'][^"']*components\/(frames|composites|blocks|layouts|overlays|pages|features)\b/;

for (const f of atomFiles) {
    const text = readFileSync(f, "utf8");
    const self = `/atoms/${relative(ATOMS_DIR, f).replace(/\\/g, "/").split("/").slice(0, -1).join("/")}`;

    for (const m of text.matchAll(new RegExp(OTHER_TIERS, "g"))) {
        findings["ATOM-3"].push({ file: rel(f), detail: `imports ${m[1]} — a higher tier; the atom is arranging its own children` });
    }

    // A VALUE import from another atom folder. `import type { … }` is skipped: sharing a type is
    // not composing a component.
    for (const m of text.matchAll(/import\s+(type\s+)?(?:\{[^}]*\}|[\w*]+)[^;\n]*?from\s*["']([^"']*\/atoms\/[^"']+)["']/g)) {
        if (m[1]) continue; // import type
        const from = m[2];
        if (/\/_[\w-]+/.test(from.replace(/.*\/atoms\//, "/"))) continue; // _-prefixed shared material
        const otherFolder = from.replace(/.*(\/atoms\/.*?)\/[^/]+$/, "$1").replace(/.*(\/atoms\/[^/]+)$/, "$1");
        if (from.includes(self + "/") || from.endsWith(self)) continue; // own Base / tokens
        findings["ATOM-3"].push({ file: rel(f), detail: `imports the \`${from.replace(/.*\/atoms\//, "").replace(/\/[^/]+$/, "")}\` atom — a component that composes another atom is a composite` });
    }
}

// ---- ATOM-8 · an atom that renders another atom is a composite -------------
//
// ATOM-3 catches an atom reaching to ANOTHER TIER. It cannot catch the commonest version of the
// same mistake: a `Group` sitting in the same folder as the atom it repeats. `ButtonGroup` renders
// N `ButtonBase`, imports nothing from outside atoms/, and passes every other gate — while being a
// composite by every rule that matters.
//
// The distinction that makes this checkable: taking `items` is NOT the signal. A vendor tabs or
// menu is one element whose options are its data, and those are real atoms. Rendering ANOTHER ATOM
// is the signal — that is placing atoms side by side, which is a composite's whole job.

const renderedAtom = new RegExp(`<(${[...atomNames].join("|")})\\b`, "g");

for (const f of atomFiles) {
    const text = stripBlockComments(readFileSync(f, "utf8"));
    const self = f.split(/[\\/]/).pop().replace(/\.tsx?$/, "");

    // REPETITION is the checkable half. An atom rendering another atom ONCE is usually its own
    // chrome — Alert's close button, Button's pending spinner — and telling that apart from a
    // genuine composite needs a person. An atom rendering another atom N TIMES FROM A LIST is not
    // ambiguous: that is placing atoms side by side, which is the definition of the tier above.
    //
    // Firing on the single case too would bury the certain findings under judgement calls, and a
    // gate whose output has to be triaged stops being read.
    // Only the file's OWN name is exempt. Being in the same folder is NOT a defence once we are
    // inside a `.map()`: `Chip.tsx` rendering `ChipBase` once is one component split across two
    // files, but `ChipGroup.tsx` rendering `ChipBase` per item is the arrangement itself — and
    // both live in `chips/Chip/`. An earlier cut exempted the whole folder and went green on all
    // four `*Group` files, which are the clearest violations in the tier.
    const isSelf = (n) => n === self || n.startsWith("_");

    const repeated = new Set();
    for (const m of text.matchAll(/\.map\(/g)) {
        // Scan the map callback: from `.map(` to the end of its balanced parens.
        let depth = 0;
        let i = m.index + m[0].length - 1;
        for (; i < text.length; i++) {
            if (text[i] === "(") depth++;
            else if (text[i] === ")" && --depth === 0) break;
        }
        for (const hit of text.slice(m.index, i).matchAll(renderedAtom)) {
            if (!isSelf(hit[1])) repeated.add(hit[1]);
        }
    }
    if (!repeated.size) continue;

    findings["ATOM-8"].push({
        file: rel(f),
        detail: `renders ${[...repeated].map((n) => `\`${n}\``).join(", ")} once per item — repeating an atom from a list is a composite`,
    });
}

// ---- ATOM-4 · every atom exposes isSkeleton -------------------------------
//
// Checked per component folder, not per file: an atom is allowed to declare the prop in a types
// file beside the component, and failing it for that would be pedantry rather than a finding.

for (const [folder, group] of atomFolders) {
    const text = group.map((f) => readFileSync(f, "utf8")).join("\n");
    if (!rendersSomething(text)) continue;
    // An atom that renders no value of its own says so, in one line, where it can be read and
    // argued with. Inferring this instead would be wrong in both directions — exempting one that
    // should shimmer, demanding a shimmer from a divider — and a wrong exemption stays invisible
    // until a row jumps in production.
    if (/@noSkeleton\b/.test(text)) continue;
    if (!/\bisSkeleton\b/.test(text)) {
        findings["ATOM-4"].push({ file: relFolder(folder), detail: "no isSkeleton, and no @noSkeleton claim" });
    }
}

// ---- ATOM-4-shape · a shimmer is a fraction wide, and never a passed height -
//
// The caller knows roughly how much of the line the value will fill. It does not know how many rem
// that is on this screen, and neither does the atom — the answer depends on the container. So the
// width scale is fractions, and the height is not passable at all: the line box is the one thing a
// skeleton exists to preserve, and only the atom knows it.

for (const [folder, group] of atomFolders) {
    for (const f of group) {
        const text = stripBlockComments(readFileSync(f, "utf8"));
        if (!/\b(isSkeleton|skeleton)/i.test(text)) continue;

        // A fixed width OFFERED TO THE CALLER — in the type of a width prop, or as that prop's
        // default. A fixed width the atom picks for itself is not this rule: the canon says the
        // atom owns its resting shape, so a per-size table of `w-24`/`w-16` inside the component
        // is exactly right, and flagging it told two agents their correct code was wrong.
        // The rule is about the SCALE a caller reaches for, and a caller can only reach a prop.
        const offered = text.match(
            /\btype\s+\w*(?:Skeleton|Width)\w*\s*=[^;]*|\b\w*[wW]idth\s*\??\s*:\s*[^;\n]*|\b\w*[wW]idth\s*=\s*["'`][^"'`]*["'`]/g,
        ) ?? [];
        const fixed = new Set();
        for (const decl of offered) {
            for (const m of decl.matchAll(/["'`](w-(?:\d+|\[[^\]]+\]))["'`]/g)) fixed.add(m[1]);
        }
        if (fixed.size) {
            findings["ATOM-4-shape"].push({
                file: rel(f),
                detail: `skeleton width fixed at ${[...fixed].join(", ")} — the scale is a fraction of the container`,
            });
        }
        // A height the caller supplies. The prop name is the tell; the value never matters.
        for (const m of text.matchAll(/\b(skeletonHeight|skeletonLines?Height|height)\??\s*:\s*(?:number|string)/g)) {
            findings["ATOM-4-shape"].push({
                file: rel(f),
                detail: `takes \`${m[1]}\` — height is never passable, the line box belongs to the atom`,
            });
        }
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
    if (!rendersSomething(text)) continue;
    // Not anchored to the start of a line: an interface written on one line is legal TypeScript
    // and would otherwise slip through. The word boundary keeps `wrapperClassName` out.
    if (/\bclassName\??\s*:\s*string/.test(text)) {
        findings["ATOM-5-type"].push({
            file: relFolder(folder),
            detail: "declares `className?: string` — should be `classNames?: Array<AllowedClassName>`",
        });
    }
}

// ---- ATOM-6 · it composes classes for its own appearance ------------------
//
// Deciding how it looks is this tier's work, and the class strings behind a variant are private.
// Two shapes betray the opposite, and both are candidates rather than verdicts:
//
//   a spread onto the rendered element — `{...props}` hands the vendor's whole surface, className
//   included, to whoever called; the closed union above it then means nothing.
//
//   no `cn(` and no appearance prop at all — the component has no look of its own to decide, which
//   usually means the look is still arriving from outside.

const APPEARANCE_PROPS = /\b(size|tone|variant|color|weight|shape|radius|intensity|emphasis)\??\s*:/;

for (const [folder, group] of atomFolders) {
    const text = stripBlockComments(group.map((f) => readFileSync(f, "utf8")).join("\n"));
    if (!rendersSomething(text)) continue;

    const spread = text.match(/\{\s*\.\.\.\s*(props|rest|restProps|others)\s*\}/);
    if (spread) {
        findings["ATOM-6"].push({
            file: relFolder(folder),
            detail: `spreads \`...${spread[1]}\` onto what it renders — every vendor prop, className included, travels through it`,
        });
    } else if (!/\bcn\(/.test(text) && !APPEARANCE_PROPS.test(text)) {
        findings["ATOM-6"].push({
            file: relFolder(folder),
            detail: "composes no classes and exposes no appearance prop — confirm it has a look of its own to decide",
        });
    }
}

// ---- ATOM-9 · the vendor stops at Base ------------------------------------
//
// Where a `Base` file sits beside a plain name, the `Base` holds the vendor import and the plain
// name is the house version with the vendor's freedom removed. The whole point is that the library
// can be swapped in one file — which stops being true the moment the plain name imports it too.

const importsVendor = (text) => VENDOR.some((v) => new RegExp(`from\\s*["'][^"']*${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text));

// Only the PLAIN NAME is checked — the file called after its folder, the one everything above
// talks to. A third atom in the same folder that wraps the vendor itself is not a leak: the rule's
// subject is "the vendor stops at this tier", and an atom is this tier. `TabsExtended` builds a
// different compound tree from the same library and was flagged for it, which read as a violation
// of a rule it actually keeps. The pair is the mechanism, not the rule.
for (const [folder, group] of atomFolders) {
    const hasBase = group.some((f) => /Base\.tsx?$/.test(f));
    if (!hasBase) continue;
    const name = folder.split(/[\\/]/).pop();
    for (const f of group) {
        const file = f.split(/[\\/]/).pop().replace(/\.tsx?$/, "");
        if (file !== name && file !== "index") continue;
        const text = readFileSync(f, "utf8");
        if (importsVendor(text)) {
            findings["ATOM-9"].push({
                file: rel(f),
                detail: "the house version imports the vendor while its `Base` sits beside it — the swap is no longer one file",
            });
        }
    }
}

// A vendor import ABOVE the atom tier is the same leak read from the other end, and it is real —
// but it is the composite tier's rule 3, and `audit-composites.mjs` already reports it. Counting
// it here too would put one problem in two gates, and then neither total means anything: the atom
// tier would read as 85 violations for something no atom did. The count below stays the number of
// atoms whose own vendor line leaks, which is the only part this gate can answer for.
const vendorAbove = allFiles.filter(
    (f) => !f.includes(`${sep}atoms${sep}`) && !f.includes(`${sep}frames${sep}`) && importsVendor(readFileSync(f, "utf8")),
).length;

// ---- ATOM-10 · the switch travels down, the name does not -----------------
//
// An atom is the one thing in the system that knows it is a rule and not a spacer. A caller
// passing the name in is a caller describing the atom — the same failure as passing it
// `text-red-500`, one level over.
//
// The copy the app imports carries no inspection tooling at all, so on that tree the rule reads
// "no anatomy, anywhere" — and any anatomy found there is drift from the blueprint, not a name
// dispute.

for (const [folder, group] of atomFolders) {
    for (const f of group) {
        const text = stripBlockComments(readFileSync(f, "utf8"));

        if (tree === "src") {
            const found = ["showAnatomy", "anatPart", "data-anat-part"].filter((k) => text.includes(k));
            if (found.length) {
                findings["ATOM-10"].push({
                    file: rel(f),
                    detail: `carries ${found.join(", ")} — this tree has no inspection overlay to feed`,
                });
            }
            continue;
        }

        if (/\banatPart\??\s*:/.test(text)) {
            findings["ATOM-10"].push({
                file: rel(f),
                detail: "declares `anatPart` — an atom writes its own name; only a frame takes one",
            });
        }
        // The switch has to be declared wherever the badge is emitted, or the overlay has no way
        // to turn it on — the FRAME-11 failure, one tier down.
        if (/data-anat-part/.test(text) && !/\bshowAnatomy\b/.test(text)) {
            findings["ATOM-10"].push({
                file: rel(f),
                detail: "emits `data-anat-part` without taking `showAnatomy` — a badge nothing can switch off",
            });
        }
        // A caller-supplied name winning over the atom's own is the violation with teeth: two
        // callers label the same component two ways and the overlay stops being a map.
        for (const m of text.matchAll(/data-anat-part=\{([^}]*)\}/g)) {
            if (/\banatPart\s*\?\?/.test(m[1])) {
                findings["ATOM-10"].push({
                    file: rel(f),
                    detail: "prefers the caller's `anatPart` over its own name — the atom knows better than the caller here",
                });
            }
        }
    }
}

// ---- ATOM-11 · the app's copy is the same file minus the anatomy overlay ---
//
// This is the one rule that is about a PAIR of trees rather than one, so it runs whichever tree
// was pointed at — asking it from the copy's side and from the blueprint's side has to give the
// same answer, or the rule would depend on who ran it.
//
// The comparison strips exactly the lines the rule permits to differ. What is left has to match,
// and the failure it catches is the one that hides best: a fix applied on one side only, with
// every other gate green because the gates were pointed at the side that got fixed.

const BLUEPRINT_ATOMS = join(repo, ".storybook", "components", "atoms");
const COPY_ATOMS = join(repo, "src", "components", "atoms");

if (existsSync(BLUEPRINT_ATOMS) && existsSync(COPY_ATOMS)) {
    /**
     * The two trees name the entry file differently, and both names are right for their side.
     *
     * The blueprint names it after the component — `Button/Button.tsx` — because a person scanning
     * Storybook's sidebar cannot tell forty files called `index.tsx` apart. The app imports the
     * folder, so there it is `Button/index.tsx` and no call site repeats the name in its path.
     * Comparing raw paths would report every component in the tier as missing from both sides, so
     * the entry is folded to one key before the sets are compared. Siblings keep their names.
     *
     * @param {string} p path relative to the tier root, forward-slashed
     * @returns {string} the same path with the entry file reduced to `·entry`
     */
    const foldEntry = (p) => {
        const parts = p.split("/");
        const file = parts[parts.length - 1].replace(/\.tsx?$/, "");
        const folder = parts[parts.length - 2];
        return file === "index" || file === folder
            ? [...parts.slice(0, -1), "·entry"].join("/")
            : p;
    };

    /** Folded path -> { key: the path as written on that side, file: absolute }. */
    const listing = (base) =>
        new Map(walk(base).map((f) => {
            const key = relative(base, f).replace(/\\/g, "/");
            return [foldEntry(key), { key, file: f }];
        }));

    const blueprint = listing(BLUEPRINT_ATOMS);
    const copy = listing(COPY_ATOMS);

    // The entry file has to actually carry the app-side name, or the folder import a call site is
    // supposed to write does not resolve.
    for (const [folded, v] of copy) {
        if (!folded.endsWith("·entry")) continue;
        if (!/(^|\/)index\.tsx?$/.test(v.key)) {
            findings["ATOM-11"].push({
                file: `src/components/atoms/${v.key}`,
                detail: "the app's entry file is `index.tsx` — a call site imports the folder, not the name twice",
            });
        }
    }

    // The component set first, because a whole component missing is a different failure from a
    // file inside one differing, and reading it off a list of file paths is how it gets missed.
    // Taken in both directions: an atom only the copy has is one nobody designed and no gate
    // reading the blueprint will ever see; an atom only the blueprint has is a word the app cannot
    // say, so whatever screen needed it hand-rolled something instead.
    const componentsOf = (listed) =>
        new Set([...listed.values()].map((v) => v.key.split("/").slice(0, -1).join("/")).filter(Boolean));

    const bpComponents = componentsOf(blueprint);
    const cpComponents = componentsOf(copy);
    for (const c of bpComponents) {
        if (!cpComponents.has(c)) {
            findings["ATOM-11"].push({
                file: `atoms/${c}`,
                detail: "a component the blueprint has and the app's copy does not — the app cannot say this word",
            });
        }
    }
    for (const c of cpComponents) {
        if (!bpComponents.has(c)) {
            findings["ATOM-11"].push({
                file: `atoms/${c}`,
                detail: "a component only the app's copy has — nobody designed it, and no story or gate on the blueprint will see it",
            });
        }
    }

    for (const [folded, v] of blueprint) {
        if (!copy.has(folded)) {
            findings["ATOM-11"].push({
                file: `.storybook/components/atoms/${v.key}`,
                detail: "in the blueprint, missing from the app's copy — the change never crossed",
            });
        }
    }
    for (const [folded, v] of copy) {
        if (!blueprint.has(folded)) {
            findings["ATOM-11"].push({
                file: `src/components/atoms/${v.key}`,
                detail: "in the app's copy, absent from the blueprint — usually a tier move that crossed one way",
            });
        }
    }

    // Three things are normalised away before comparing, and each one is a permitted difference
    // rather than a tolerance:
    //
    //   the inspection tooling — removed at ATTRIBUTE level, not by dropping whole lines. An
    //   earlier cut dropped any line mentioning it, which reported a false difference whenever
    //   `data-anat-part={…}` shared a line with a real attribute: the copy correctly keeps the
    //   attribute beside it, the blueprint line vanishes entirely, and the two stop matching.
    //
    //   the import root — `@sb-components/x` and `@/components/x` are the same import written from
    //   two trees. Left in, this fires on every file in the tier at once, which is the signature of
    //   a rule mis-stated rather than a tree gone wrong.
    //
    //   whitespace — two files differing only in how a prop list wrapped are the same file, and
    //   reporting that trains people to ignore the rule.
    //   comments — the blueprint explains the inspection tooling in prose that means nothing in a
    //   tree without it, and that prose does not contain the keywords, so no token strip can find
    //   it. Comparing code and leaving comments out is the honest line: this rule is about what the
    //   two files DO. A doc-only divergence is real but it is not what ATOM-11 was written to catch.
    // The tooling is removed TOKEN by token, never by dropping a line. `showAnatomy` shares a line
    // with real code all the time — a destructured parameter list, a type member beside another
    // member, a JSX tag with other attributes — and deleting the line takes the real code with it.
    // The copy then keeps the correct remainder, the blueprint has nothing left to match it, and
    // the rule reports drift that only the stripping created.
    const normalise = (t) =>
        stripBlockComments(t)
            .replace(/\s*data-anat-part=\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, "")
            .replace(/\s*\b(?:showAnatomy|anatPart)\s*=\s*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|"[^"]*")/g, "")
            // Stops at `)` as well as `;` `,` `}`. Without it, a typed PARAMETER swallows the rest
            // of its own signature — `showAnatomy: boolean) => {` took the paren and the arrow with
            // it, and the two trees then differed by a function header the strip had eaten.
            .replace(/\b(?:showAnatomy|anatPart)\s*\??\s*:\s*[^;,)\n}]+/g, "")
            // The identifier plus whatever binds to it. The default in a destructured parameter
            // list is the case that bites: `showAnatomy = false,` leaves `= false,` behind if only
            // the name is removed, and that orphan is then a difference the copy can never have.
            .replace(/\b(?:showAnatomy|anatPart)\b\s*(?:=\s*(?:\{[^{}]*\}|"[^"]*"|[\w.]+))?\s*,?/g, "")
            // Whatever the removals left behind in a list — `{ , a }`, `a, , b`, `a, }`.
            .replace(/,\s*,/g, ",")
            .replace(/([{(])\s*,/g, "$1")
            .replace(/,\s*([})])/g, "$1")
            // A JSX comment leaves `{}` behind once its body is stripped. The copy, written without
            // the comment, has nothing there at all.
            .replace(/\{\s*\}/g, "")
            .replace(/(["'])@sb-components\//g, "$1@/components/")
            // One atom importing another: the blueprint reaches `…/Avatar/Avatar`, the copy reaches
            // `…/Avatar`, because the copy's entry is `index.tsx`. That is the entry-naming rule
            // seen from the importing side, and it follows from the rule rather than breaking it.
            .replace(/(["'][^"']*\/(\w+))\/\2(["'])/g, "$1$3")
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);

    for (const [folded, v] of blueprint) {
        const twin = copy.get(folded);
        if (!twin) continue;
        const a = normalise(readFileSync(v.file, "utf8"));
        const b = normalise(readFileSync(twin.file, "utf8"));

        // Equality is decided on the token stream, not on lines. The blueprint writes JSX one
        // attribute per line so that removing the anatomy attribute is a safe edit; the app copy
        // comes back from Prettier compact. Same code, different wrapping — and a line-based
        // comparison calls that drift on almost every file, which is how a rule stops being read.
        // Whitespace around punctuation goes too. The blueprint writes JSX one attribute per line
        // so the anatomy attribute can be removed safely; the copy comes back from Prettier with
        // the same tag on one line. Flattened, that is a stray space before `>` — and a rule that
        // calls a space drift is a rule nobody reads twice.
        const flat = (lines) =>
            lines.join(" ").replace(/\s+/g, " ").replace(/\s*([<>{}()[\],;:])\s*/g, "$1").trim();
        if (flat(a) === flat(b)) continue;

        const inCopy = new Set(b);
        const inBlueprint = new Set(a);
        const onlyBlueprint = a.filter((l) => !inCopy.has(l)).length;
        const onlyCopy = b.filter((l) => !inBlueprint.has(l)).length;
        findings["ATOM-11"].push({
            file: `atoms/${v.key}`,
            detail: `the two trees differ beyond the overlay — ${onlyBlueprint} line(s) only in the blueprint, ${onlyCopy} only in the app's copy`,
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

    /**
     * The same text with the inside of every string and template literal blanked out, position for
     * position. Tag hunting runs on this; extraction still runs on the original.
     *
     * Stories carry JSX inside strings — a `code:` field showing the snippet the example renders —
     * and a scanner reading those finds a `<Typography` that is not code. It then runs to the next
     * real `>`, swallows the wrapper div's classes on the way, and reports an appearance violation
     * against an atom that was never called. One story was flagged for a class three lines away
     * from it, on an element of a different kind.
     *
     * @param {string} t file contents
     * @returns {string} same length, literals replaced by spaces
     */
    function maskLiterals(t) {
        const out = t.split("");
        let quote = null;
        for (let i = 0; i < t.length; i++) {
            const ch = t[i];
            if (quote) {
                if (ch === quote && t[i - 1] !== "\\") quote = null;
                else if (ch !== "\n") out[i] = " ";
                continue;
            }
            if (ch === '"' || ch === "'" || ch === "`") quote = ch;
        }
        return out.join("");
    }

    for (const f of callSiteFiles) {
        const text = readFileSync(f, "utf8");
        const masked = maskLiterals(text);
        const origins = importOrigins(text);
        for (const hit of masked.matchAll(OPEN)) {
            const name = hit[1];
            // Boundaries come from the masked copy so a `>` inside a literal cannot end the tag;
            // the text handed on is the real one, because the class values live inside quotes.
            const span = openingTag(masked, hit.index);
            if (!span) continue;
            const whole = text.slice(hit.index, hit.index + span.length);
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
    "ATOM-1": "an atom is ONE element — a child the caller handed in makes it a composite",
    "ATOM-2": "it knows nothing about data — naming a domain entity is the line that decides the tier",
    "ATOM-3": "an atom imports no other tier — importing one means it is arranging children",
    "ATOM-4": "every atom exposes `isSkeleton` — only the atom knows the space its value will occupy",
    "ATOM-4-shape": "a shimmer is a FRACTION of its container wide, and its height is never passable",
    "ATOM-5": "`className` on an atom carries POSITION only — appearance is already a prop",
    "ATOM-5-type": "the prop should be `classNames?: Array<AllowedClassName>` — a free string cannot be constrained",
    "ATOM-6": "it decides its own appearance, and the class strings behind a variant stay private",
    "ATOM-8": "an atom that renders ANOTHER atom is a composite — taking `items` is not the signal, rendering an atom is",
    "ATOM-9": "the vendor stops at `Base` — so the library can be swapped in one file",
    "ATOM-10": tree === "src"
        ? "this tree carries no inspection tooling — `showAnatomy` and `anatPart` belong to the blueprint only"
        : "it takes the inspection SWITCH and never the part NAME — an atom knows what it is",
    "ATOM-11": "the app's copy is the blueprint minus the anatomy overlay — and a change lands in both",
};

let violations = 0;
let suspects = 0;
console.log(`${repo}`);
console.log(`tree: ${TREE_ROOT.replace(/\\/g, "/")}\n`);
console.log(`atoms found: ${atomFolders.size} component folder(s), ${atomNames.size} exported name(s)\n`);

for (const [rule, list] of Object.entries(findings)) {
    if (only && rule !== only) continue;
    const isSuspect = SUSPECT.has(rule);
    if (isSuspect) suspects += list.length;
    else violations += list.length;

    const label = list.length === 0
        ? "ok"
        : isSuspect ? `${list.length} to judge` : `${list.length} violation(s)`;
    console.log(`${rule}  ${label}\n        ${RULES[rule]}`);

    // Suspects are evidence for a person, and a long list of them buries the verdicts. They print
    // in full only when asked for, or when the rule was named with --rule.
    const show = !quiet && (!isSuspect || showSuspects || only === rule);
    if (show) {
        // Naming one rule is asking to read it, so the cap comes off. Left on for a full run,
        // where one rule with 78 findings would otherwise push every other rule off the screen.
        const cap = only ? list.length : 40;
        for (const v of list.slice(0, cap)) console.log(`        ${v.file}\n            ${v.detail}`);
        if (list.length > cap) console.log(`        … and ${list.length - cap} more`);
    } else if (isSuspect && list.length && !quiet) {
        console.log(`        (run with --suspects, or --rule ${rule.replace(/^ATOM-/, "")}, to read them)`);
    }
    console.log("");
}

if (!only && vendorAbove) {
    console.log(`ATOM-9  note: ${vendorAbove} file(s) above the atom tier import the vendor directly.`);
    console.log("        Each is a missing atom, counted by audit-composites.mjs rule 3, not here.\n");
}

if (!only) {
    console.log("ATOM-7  derived");
    console.log("        it belongs here when it renders a value with no child of its own to place —");
    console.log("        satisfied exactly when ATOM-1, ATOM-2 and ATOM-8 are. Nothing separate to check.\n");
}

console.log(violations ? `${violations} violation(s)` : "no violation of a checkable rule");
if (suspects) console.log(`${suspects} candidate(s) needing judgement — these do not fail the gate`);
process.exit(violations ? 1 : 0);
