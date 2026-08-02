#!/usr/bin/env node
// Gate the DATA, not the prose. A row missing a cell, an id that drifted from its section,
// a component named in "don't choose" that exists nowhere else — none of these break tsc,
// and none of them are visible when the table is read as markdown.
//
//   node scripts/validate-component-matrix.mjs
//
// FAIL exits 1. WARN is printed and exits 0 — a warning is a question, not a verdict.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const fails = [];
const warns = [];
const fail = (m) => fails.push(m);
const warn = (m) => warns.push(m);

function rawRows(name) {
    const file = join(ROOT, "canon", "fe", "explore", "component", "data", `${name}.csv`);
    if (!existsSync(file)) { fail(`data/${name}.csv is missing`); return null; }
    const lines = readFileSync(file, "utf8").trim().split(/\r?\n/);
    const split = (line, where) => {
        const out = [];
        let cell = "", quoted = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (quoted && line[i + 1] === '"') { cell += '"'; i++; continue; }
                quoted = !quoted;
                continue;
            }
            if (ch === "," && !quoted) { out.push(cell); cell = ""; continue; }
            cell += ch;
        }
        if (quoted) fail(`${name}.csv:${where} has an unclosed quote`);
        out.push(cell);
        return out.map((c) => c.trim());
    };
    const head = split(lines[0], 1);
    const rows = [];
    lines.slice(1).forEach((l, i) => {
        const cells = split(l, i + 2);
        if (cells.length !== head.length) {
            fail(`${name}.csv:${i + 2} has ${cells.length} cells, header declares ${head.length}`);
            return;
        }
        rows.push(Object.fromEntries(cells.map((v, j) => [head[j], v])));
    });
    return { head, rows };
}

const required = (name, rows, cols) => {
    for (const [i, r] of rows.entries()) {
        for (const c of cols) {
            if (!r[c]) fail(`${name}.csv:${i + 2} — ${c} is empty; ${r.id ?? r.section ?? r.name} cannot answer without it`);
        }
    }
};

// ---- sections.csv -------------------------------------------------------

const sections = rawRows("sections");
let slugs = [];
if (sections) {
    required("sections", sections.rows, ["section", "num", "title", "deciding_test"]);
    slugs = sections.rows.map((r) => r.section);
    const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
    if (dupes.length) fail(`sections.csv — duplicate slug: ${[...new Set(dupes)].join(", ")}`);
    const nums = sections.rows.map((r) => Number(r.num)).sort((a, b) => a - b);
    nums.forEach((n, i) => {
        if (n !== i + 1) fail(`sections.csv — section numbers must run 1..${nums.length} with no gap; found ${n} at position ${i + 1}`);
    });
}

// ---- matrix.csv ---------------------------------------------------------

const matrix = rawRows("matrix");
if (matrix) {
    required("matrix", matrix.rows, ["id", "section", "you_have", "choose"]);

    const ids = matrix.rows.map((r) => r.id);
    const dupes = ids.filter((s, i) => ids.indexOf(s) !== i);
    if (dupes.length) fail(`matrix.csv — duplicate id: ${[...new Set(dupes)].join(", ")}`);

    const counter = {};
    for (const [i, r] of matrix.rows.entries()) {
        const where = `matrix.csv:${i + 2}`;
        if (slugs.length && !slugs.includes(r.section)) {
            fail(`${where} — section "${r.section}" is not in sections.csv`);
            continue;
        }
        counter[r.section] = (counter[r.section] ?? 0) + 1;
        const expected = `${r.section}-${String(counter[r.section]).padStart(2, "0")}`;
        if (r.id !== expected) fail(`${where} — id is ${r.id}, position says ${expected}`);
    }

    // A lookup cell is read by a script, not rendered. Markdown left in it is noise
    // that every consumer then has to strip again.
    const MARKUP = [
        [/\*\*/, "bold marker **"],
        [/`/, "backtick"],
        [/\[[^\]]+\]\([^)]*\)/, "markdown link"],
    ];
    for (const [i, r] of matrix.rows.entries()) {
        for (const col of ["you_have", "choose", "entry_point", "dont_choose"]) {
            for (const [re, label] of MARKUP) {
                if (re.test(r[col] ?? "")) fail(`matrix.csv:${i + 2} — ${col} still carries a ${label}`);
            }
        }
    }

    // Every component the table can hand you.
    const NAME = /\b[A-Z][a-zA-Z]*[a-z][A-Z][a-zA-Z]*\b|\b(?:Chip|Flex|Container|Avatar|Image|Logo|Badge|Divider|Tabs|Table|Toolbar|Skeleton|Disclosure|Tooltip|Popover|Modal|Drawer|Alert|Toast|Card|List|Section)\b/g;
    const known = new Set();
    for (const r of matrix.rows) for (const m of (r.choose ?? "").match(NAME) ?? []) known.add(m);
    const doors = rawRows("not-a-door");
    if (doors) {
        required("not-a-door", doors.rows, ["name", "belongs_to", "only_touch_when"]);
        for (const d of doors.rows) for (const m of (d.name ?? "").match(NAME) ?? []) known.add(m);
    }

    const missing = new Map();
    for (const [i, r] of matrix.rows.entries()) {
        for (const m of (r.dont_choose ?? "").match(NAME) ?? []) {
            if (!known.has(m) && !missing.has(m)) missing.set(m, `matrix.csv:${i + 2}`);
        }
    }
    for (const [name, where] of missing) {
        warn(`${where} — "don't choose ${name}" names something no row ever chooses. Typo, or a row that was never written?`);
    }
}

// ---- references/traps.md ------------------------------------------------

const traps = join(ROOT, "canon", "fe", "explore", "component", "references", "traps.md");
if (!existsSync(traps)) {
    fail("references/traps.md is missing");
} else {
    const blocks = readFileSync(traps, "utf8").split(/^## /m).slice(1).map((b) => b.split("\n")[0].trim());
    for (const s of slugs) if (!blocks.includes(s)) fail(`traps.md has no block for section "${s}"`);
    for (const b of blocks) if (slugs.length && !slugs.includes(b)) fail(`traps.md has a block "${b}" that is not a section`);
}

// ---- verdict ------------------------------------------------------------

for (const w of warns) console.log(`WARN  ${w}`);
for (const f of fails) console.log(`FAIL  ${f}`);

const counts = matrix ? `${matrix.rows.length} rows, ${slugs.length} sections` : "no matrix";
if (fails.length) {
    console.log(`\n${fails.length} failure(s), ${warns.length} warning(s) — ${counts}`);
    process.exit(1);
}
console.log(`\nok — ${counts}, ${warns.length} warning(s)`);
