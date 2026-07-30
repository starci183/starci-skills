#!/usr/bin/env node
// Query the storybook architecture tables. Never open a CSV whole.
//
//   node scripts/search.mjs tier atom
//   node scripts/search.mjs group composite
//   node scripts/search.mjs import frame atom
//   node scripts/search.mjs tiers

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

const show = (row, skip = []) => {
    for (const [k, v] of Object.entries(row)) {
        if (!v || v === "-" || skip.includes(k)) continue;
        console.log(`  ${k.padEnd(14)} ${v}`);
    }
};

const [cmd, a, b] = process.argv.slice(2);

if (!cmd || cmd === "tiers") {
    for (const r of read("tiers")) console.log(`${r.tier.padEnd(10)} ${String(r.count).padStart(4)}  ${r.owns}`);
    console.log("\nnode scripts/search.mjs tier <name> | group <tier> | import <from> <to>");
    process.exit(0);
}

if (cmd === "tier") {
    const hit = read("tiers").find((r) => r.tier === a);
    if (!hit) { console.error(`unknown tier: ${a}`); process.exit(1); }
    console.log(`# ${hit.tier}  ${hit.folder}  (${hit.count} files)`);
    show(hit, ["tier", "folder", "count"]);
    process.exit(0);
}

if (cmd === "group") {
    const rows = read("groups").filter((r) => r.tier === a);
    if (!rows.length) { console.error(`no groups for tier: ${a}`); process.exit(1); }
    for (const r of rows) console.log(`${(r.group === "-" ? "(flat)" : r.group).padEnd(14)} ${String(r.count).padStart(4)}  ${r.holds}`);
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
        console.log(`${r.from} -> ${r.to}   ${verdict}${r.measured_count && r.measured_count !== "-" ? `   (${r.measured_count} in the real tree)` : ""}`);
        if (r.rule) console.log(`  ${r.rule}`);
    }
    process.exit(0);
}

console.error(`unknown command: ${cmd}`);
process.exit(1);
