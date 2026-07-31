#!/usr/bin/env node
// Query the tier rules. These are universal; for the numbers of a specific repo use scan.mjs.
//
//   node scripts/search.mjs tiers
//   node scripts/search.mjs tier atom
//   node scripts/search.mjs import frame atom

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Minimal CSV reader: handles quoted cells containing commas. */
function read(name) {
    const file = join(ROOT, "data", `${name}.csv`);
    if (!existsSync(file)) { console.error(`no such table: ${name}`); process.exit(1); }
    const lines = readFileSync(file, "utf8").trim().split("\n");
    const split = (line) => {
        const out = [];
        let cell = "", quoted = false;
        for (const ch of line) {
            if (ch === '"') { quoted = !quoted; continue; }
            if (ch === "," && !quoted) { out.push(cell); cell = ""; continue; }
            cell += ch;
        }
        out.push(cell);
        return out.map((c) => c.trim());
    };
    const head = split(lines[0]);
    return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
}

const [cmd, a, b] = process.argv.slice(2);

if (!cmd || cmd === "tiers") {
    for (const r of read("tiers")) console.log(`${r.tier.padEnd(12)} ${r.owns}`);
    console.log("\nnode scripts/search.mjs tier <name> | import <from> <to>");
    console.log("For a specific repo's numbers: node .claude/scripts/scan-storybook-architecture.mjs <path-to-repo>");
    process.exit(0);
}

if (cmd === "tier") {
    const hit = read("tiers").find((r) => r.tier === a);
    if (!hit) { console.error(`unknown tier: ${a}`); process.exit(1); }
    console.log(`# ${hit.tier}`);
    console.log(`  owns          ${hit.owns}`);
    console.log(`  never         ${hit.never}`);
    console.log(`  may import    ${hit.may_import}`);
    console.log(`  belongs here  ${hit.signal_it_belongs_here}`);
    console.log(`  misplaced if  ${hit.signal_it_is_misplaced}`);
    process.exit(0);
}

if (cmd === "import") {
    const rows = read("import-rules").filter((r) => r.from === a && (!b || r.to === b || r.to === "anything"));
    if (!rows.length) {
        console.log(`No rule covers ${a} -> ${b ?? "*"}.`);
        console.log("A direction with no rule is not a permission. Ask before crossing it.");
        process.exit(1);
    }
    for (const r of rows) {
        const verdict = r.allowed === "yes" ? "ALLOWED" : r.allowed === "no" ? "FORBIDDEN" : r.allowed.toUpperCase();
        console.log(`${r.from} -> ${r.to}   ${verdict}`);
        if (r.rule) console.log(`  ${r.rule}`);
        if (r.why) console.log(`  why: ${r.why}`);
    }
    process.exit(0);
}

console.error(`unknown command: ${cmd}`);
console.error("commands: tiers | tier <name> | import <from> <to>");
process.exit(1);
