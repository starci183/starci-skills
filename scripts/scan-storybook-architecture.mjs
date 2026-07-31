#!/usr/bin/env node
// Measure the tier architecture of whatever repo you are working in.
// The rules in data/ are universal; the numbers are not. Read them from the repo, never assume.
//
//   node scripts/scan-storybook-architecture.mjs <path-to-repo>          scan its .storybook
//   node scripts/scan-storybook-architecture.mjs <path-to-repo> --violations   only what breaks the direction

import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2];
if (!repo) {
    console.error("usage: node scripts/scan-storybook-architecture.mjs <path-to-repo> [--violations]");
    process.exit(1);
}
const onlyViolations = process.argv.includes("--violations");

const root = join(repo, ".storybook", "components");
if (!existsSync(root)) {
    console.log(`No .storybook/components in ${repo}.`);
    console.log("");
    console.log("This repo has no tier architecture of its own yet. Two ways forward:");
    console.log("  - it is a new repo    -> adopt the tiers in design/storybook/data/tiers.csv as they stand");
    console.log("  - it has components elsewhere -> point this script at that folder instead");
    console.log("");
    console.log("How to read a scan once you have one:");
    console.log("  design/storybook/references/how-to-read-a-scan.md");
    process.exit(0);
}

/**
 * Which imports count as "the vendor" — the component library the house wraps at atom level.
 * A default list of the common ones, overridable, because the rule is universal and the library
 * is not: any repo can name its own with `UI_VENDORS=@acme/ui,some-kit`.
 */
const VENDOR = new RegExp(
    (process.env.UI_VENDORS ?? "@heroui,@mui,antd,@chakra-ui,@mantine,react-bootstrap")
        .split(",")
        .map((v) => `from ["'][^"']*${v.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
        .join("|"),
);

// A tier is a top-level folder. An app namespace holds block/layout/overlay/page inside it.
const APP_TIERS = new Set(["blocks", "layouts", "overlays", "pages"]);
const ORDER = ["atoms", "frames", "composites", "blocks", "layouts", "overlays", "pages"];
const RANK = Object.fromEntries(ORDER.map((t, i) => [t, i]));

function walk(dir, out = []) {
    for (const n of readdirSync(dir)) {
        if (n === "_legacy" || n === "node_modules") continue;
        const p = join(dir, n);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (p.endsWith(".tsx") || p.endsWith(".ts")) out.push(p);
    }
    return out;
}

/** Which tier does this file sit in, reading the path rather than guessing from the name. */
function tierOf(file) {
    const parts = file.slice(root.length + 1).split(/[\\/]/);
    if (RANK[parts[0]] !== undefined) return parts[0];
    for (const p of parts) if (APP_TIERS.has(p)) return p;
    return null;
}

/**
 * Split what a file takes from the vendor into two piles.
 *
 * They are not the same defect and treating them alike buries the real one. A vendor COMPONENT
 * above the wrapping layer is a missing atom: it has a shape, and that shape now sits in domain
 * code where nothing can constrain it. A vendor UTILITY — a class-name merger, a hook — has no
 * shape at all, so no atom could wrap it; the fix is a re-export, not a component.
 *
 * Measured on one real repo: of the files at block level importing the vendor, more than half
 * took only a utility. Counting them together made the number look twice as bad as it was, and
 * a gate that cries wolf on a helper function is a gate people learn to ignore.
 *
 * @param {string} text file contents
 * @returns {{components: string[], utilities: string[]}} imported names, split by capitalisation
 */
function vendorImports(text) {
    const components = [], utilities = [];
    for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
        if (!VENDOR.test(`from "${m[2]}"`)) continue;
        for (const raw of m[1].split(",")) {
            const name = raw.split(/\s+as\s+/)[0].trim();
            if (!name) continue;
            // A capitalised export is a component; a lowercase one is a function or a hook.
            (/^[A-Z]/.test(name) ? components : utilities).push(name);
        }
    }
    return { components, utilities };
}

const files = walk(root);
const counts = {}, vendor = {}, vendorComp = {}, vendorUtil = {}, edges = {}, violations = [];
const vendorComponentFiles = [];

for (const f of files) {
    const from = tierOf(f);
    if (!from) continue;
    counts[from] = (counts[from] ?? 0) + 1;

    const text = readFileSync(f, "utf8");
    if (VENDOR.test(text)) vendor[from] = (vendor[from] ?? 0) + 1;

    const vi = vendorImports(text);
    if (vi.components.length) {
        vendorComp[from] = (vendorComp[from] ?? 0) + 1;
        vendorComponentFiles.push({ tier: from, file: f.slice(repo.length + 1), names: vi.components });
    }
    if (vi.utilities.length) vendorUtil[from] = (vendorUtil[from] ?? 0) + 1;

    for (const m of text.matchAll(/from ["'][^"']*components\/([a-z]+)/g)) {
        const to = m[1];
        if (RANK[to] === undefined || to === from) continue;
        const key = `${from} -> ${to}`;
        edges[key] = (edges[key] ?? 0) + 1;
        // Legal direction is downward: a higher tier may import a lower one.
        if (RANK[to] > RANK[from]) violations.push({ file: f.slice(repo.length + 1), from, to });
    }
}

if (onlyViolations) {
    if (!violations.length) { console.log("no import runs against the direction"); process.exit(0); }
    for (const v of violations) console.log(`${v.from} -> ${v.to}   ${v.file}`);
    console.log(`\n${violations.length} violation(s)`);
    process.exit(1);
}

// ---- where the shared / per-app line falls in THIS repo --------------------
//
// Discovered, never declared. A tier folder at the top level belongs to no app and is shared by
// all of them; a folder that is not a tier name is an app namespace, and only the upper tiers
// live inside it. Reading it from the tree keeps this true for any repo that adopted the shape,
// including ones with different app names and different counts.

const topLevel = readdirSync(root).filter((n) => n !== "_legacy" && n !== "node_modules" && statSync(join(root, n)).isDirectory());
const sharedTiers = topLevel.filter((n) => RANK[n] !== undefined);
const namespaces = topLevel.filter((n) => RANK[n] === undefined);

// A shared tier copied under an app namespace is the moment two apps stop sharing a vocabulary,
// and nothing else in the tree announces it.
const stolen = [];
for (const ns of namespaces) {
    for (const n of readdirSync(join(root, ns))) {
        if (RANK[n] !== undefined && !APP_TIERS.has(n)) stolen.push(`${ns}/${n}`);
    }
}

console.log(`${repo}\n`);
console.log(`shared by every app   ${sharedTiers.join(" · ") || "(none)"}`);
console.log(`per app               ${namespaces.join(" · ") || "(none)"}`);
if (stolen.length) {
    console.log(`\nA SHARED TIER HAS BEEN COPIED UNDER AN APP: ${stolen.join(", ")}`);
    console.log("That is the moment two apps stop sharing a vocabulary. It has one home.");
}
console.log("");
console.log("tier          files   vendor component   vendor utility");
for (const t of ORDER) {
    if (!counts[t]) continue;
    console.log(`  ${t.padEnd(12)} ${String(counts[t]).padStart(4)}   ${String(vendorComp[t] ?? 0).padStart(16)}   ${String(vendorUtil[t] ?? 0).padStart(14)}`);
}

console.log("\nimports across tiers");
for (const [k, n] of Object.entries(edges).sort((a, b) => b[1] - a[1])) {
    const [from, to] = k.split(" -> ");
    const against = RANK[to] > RANK[from] ? "   AGAINST THE DIRECTION" : "";
    console.log(`  ${k.padEnd(26)} ${String(n).padStart(4)}${against}`);
}

// ---- invariants, then signals ---------------------------------------------
//
// The split matters. An INVARIANT is true at any size — a repo with twelve components and one
// with a thousand both obey it, so breaking one is a failure and the exit code says so. A SIGNAL
// is a ratio: it says the shape looks wrong, which is worth a look and never worth a build
// failure. Absolute counts are neither, which is why none appear here — a count is only ever a
// fact about one repo on one day.

const ABOVE = ORDER.slice(RANK.composites + 1);
const failures = [], signals = [];

if (violations.length) failures.push(`${violations.length} import(s) run against the direction — see --violations`);
if (stolen.length) failures.push(`a shared tier is copied under an app namespace: ${stolen.join(", ")}`);
if (edges && Object.keys(edges).some((k) => k.startsWith("atoms -> "))) failures.push("an atom imports another tier — at that moment it is a composite with the wrong name");
if (vendorComp.pages) failures.push(`${vendorComp.pages} page(s) import a vendor component — a page building a shape inline means a block is missing`);

const atoms = counts.atoms ?? 0, comps = counts.composites ?? 0;
if (atoms && comps > atoms * 3) signals.push(`composites outnumber atoms ${comps}:${atoms} — shapes are being assembled repeatedly instead of named once`);
if ((counts.frames ?? 0) > 20) signals.push(`${counts.frames} frames — frames answer how things are arranged, and there are not many arrangements; some are probably composites`);
if ((counts.pages ?? 0) > (counts.blocks ?? 0)) signals.push(`more pages than blocks — pages are likely building shapes inline`);

const debt = ABOVE.reduce((a, t) => a + (vendorComp[t] ?? 0), 0);
const helpers = ABOVE.reduce((a, t) => a + (vendorUtil[t] ?? 0), 0);
if (debt) signals.push(`${debt} file(s) above composite import a vendor COMPONENT — each is a missing atom`);
if (helpers) signals.push(`${helpers} file(s) above composite import only a vendor utility — not a missing atom; re-export it instead`);

console.log("");
for (const s of signals) console.log(`SIGNAL  ${s}`);
for (const f of failures) console.log(`FAIL    ${f}`);
if (!failures.length) console.log("ok      every invariant holds");

if (debt && process.argv.includes("--debt")) {
    console.log("\nvendor components above the wrapping layer:");
    for (const d of vendorComponentFiles.filter((d) => ABOVE.includes(d.tier))) {
        console.log(`  ${d.tier.padEnd(10)} ${d.names.join(", ").padEnd(24)} ${d.file}`);
    }
}

process.exit(failures.length ? 1 : 0);
