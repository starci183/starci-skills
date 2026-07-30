#!/usr/bin/env node
// Look up library/matrix.md by the shape of data you are holding.
// The file is 73 KB; never open it whole. Ask it a question instead.
//
//   node scripts/matrix.mjs "list with descriptions"   search the left column
//   node scripts/matrix.mjs --section 4                print one section
//   node scripts/matrix.mjs --sections                 list the sections
//   node scripts/matrix.mjs --component SurfaceCard    reverse lookup, for auditing only
//
// Entering by component name is backwards for building. It is allowed here only to answer
// "what shape is this component for", which is an audit question, not a build question.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const text = readFileSync(join(ROOT, "library", "matrix.md"), "utf8");
const lines = text.split("\n");

// Walk once, tagging every table row with the section it sits under.
const sections = [];
const rows = [];
let current = null;

for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const h = l.match(/^##\s+(.+)$/);
    if (h) {
        current = { title: h[1].trim(), line: i + 1 };
        sections.push(current);
        continue;
    }
    const t = l.trim();
    if (!t.startsWith("|") || !t.endsWith("|")) continue;
    if (/^[|\s:-]+$/.test(t.replace(/`[^`]*`/g, "X"))) continue;

    const cells = t.slice(1, -1).split("|").map(s => s.trim());
    if (cells.length < 2) continue;
    rows.push({ section: current?.title ?? "(before any section)", line: i + 1, cells });
}

const strip = s => s.replace(/\*\*/g, "").replace(/`/g, "");
const fmt = r => {
    const out = [`  ${strip(r.cells[0])}`];
    out.push(`      -> ${strip(r.cells[1] ?? "")}`);
    if (r.cells[2]) out.push(`         props: ${strip(r.cells[2])}`);
    if (r.cells[3]) out.push(`         not:   ${strip(r.cells[3])}`);
    return out.join("\n");
};

const args = process.argv.slice(2);

if (!args.length || args[0] === "--sections") {
    console.log("Enter by what you are holding, not by a component you already have in mind.\n");
    for (const s of sections) console.log(`  ${s.title}`);
    console.log(`\n  node scripts/matrix.mjs "<the shape of data in your hand>"`);
    process.exit(0);
}

if (args[0] === "--section") {
    const want = args.slice(1).join(" ").toLowerCase();
    const hit = sections.find(s => s.title.toLowerCase().includes(want));
    if (!hit) { console.log(`No section matches "${want}". Run --sections.`); process.exit(1); }
    console.log(`## ${hit.title}\n`);
    for (const r of rows.filter(r => r.section === hit.title)) console.log(fmt(r) + "\n");
    process.exit(0);
}

const reverse = args[0] === "--component";
const q = (reverse ? args.slice(1) : args).join(" ").toLowerCase();
const col = reverse ? 1 : 0;

const hits = rows.filter(r => (r.cells[col] ?? "").toLowerCase().includes(q));

if (!hits.length) {
    console.log(`No row matches "${q}".`);
    console.log("");
    console.log("No row matching your shape does NOT mean improvise. It means one of two things:");
    console.log("  - you described the shape in words the table does not use. Try --sections.");
    console.log("  - the library genuinely has no answer. Draw the proposed entry as a widget");
    console.log("    and let the teacher rule on it.");
    process.exit(1);
}

const byS = {};
for (const h of hits) (byS[h.section] ??= []).push(h);
for (const [s, list] of Object.entries(byS)) {
    console.log(`## ${s}`);
    for (const r of list) console.log(fmt(r));
    console.log("");
}
console.log(`${hits.length} row(s). Full context: library/matrix.md`);
