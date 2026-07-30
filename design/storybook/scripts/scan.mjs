#!/usr/bin/env node
// Measure the tier architecture of whatever repo you are working in.
// The rules in data/ are universal; the numbers are not. Read them from the repo, never assume.
//
//   node scripts/scan.mjs <path-to-repo>          scan its .storybook
//   node scripts/scan.mjs <path-to-repo> --violations   only what breaks the direction

import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2];
if (!repo) {
    console.error("usage: node scripts/scan.mjs <path-to-repo> [--violations]");
    process.exit(1);
}
const onlyViolations = process.argv.includes("--violations");

const root = join(repo, ".storybook", "components");
if (!existsSync(root)) {
    console.log(`No .storybook/components in ${repo}.`);
    console.log("");
    console.log("This repo has no tier architecture of its own yet. Two ways forward:");
    console.log("  - it is a new repo    -> adopt the tiers in data/tiers.csv as they stand");
    console.log("  - it has components elsewhere -> point this script at that folder instead");
    console.log("");
    console.log("A reference measurement from a repo that does have one:");
    console.log("  references/reference-measurement.md");
    process.exit(0);
}

// A tier is a top-level folder. An app namespace holds block/layout/overlay/page inside it.
const APP_TIERS = new Set(["blocks", "layouts", "overlays", "pages"]);
const ORDER = ["atoms", "behaviors", "frames", "composites", "blocks", "layouts", "overlays", "pages"];
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

const files = walk(root);
const counts = {}, vendor = {}, edges = {}, violations = [];

for (const f of files) {
    const from = tierOf(f);
    if (!from) continue;
    counts[from] = (counts[from] ?? 0) + 1;

    const text = readFileSync(f, "utf8");
    if (/from ["'][^"']*@heroui|from ["']@mui|from ["']antd/.test(text)) vendor[from] = (vendor[from] ?? 0) + 1;

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

console.log(`${repo}\n`);
console.log("tier          files   touching vendor");
for (const t of ORDER) {
    if (!counts[t]) continue;
    console.log(`  ${t.padEnd(12)} ${String(counts[t]).padStart(4)}   ${String(vendor[t] ?? 0).padStart(4)}`);
}

console.log("\nimports across tiers");
for (const [k, n] of Object.entries(edges).sort((a, b) => b[1] - a[1])) {
    const [from, to] = k.split(" -> ");
    const against = RANK[to] > RANK[from] ? "   AGAINST THE DIRECTION" : "";
    console.log(`  ${k.padEnd(26)} ${String(n).padStart(4)}${against}`);
}

console.log(`\n${violations.length} import(s) against the direction`);
if (violations.length) console.log("run with --violations to see which files");

const above = ORDER.slice(RANK.composites + 1).reduce((a, t) => a + (vendor[t] ?? 0), 0);
if (above) console.log(`${above} file(s) above the composite tier import a vendor directly — each is a missing atom`);
