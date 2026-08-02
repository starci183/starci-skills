#!/usr/bin/env node
/**
 * search.mjs — ask the component lookup table which component a shape of data demands.
 *
 * WHY THIS EXISTS
 * The table used to be a single 75 KB markdown file. Reading one 170-byte row meant loading
 * all of it, and 57% of that file is prose that nobody needs while looking a row up. The rows
 * now live in `data/matrix.csv` and this script hands back one at a time — 356 bytes for a
 * single row against 75,780 for the file it replaced.
 *
 * THE DIRECTION THE TABLE IS READ
 * Enter from the SHAPE OF DATA in hand and read rightward to exactly one component. Reading
 * backward from a component name is how a wrong shell survives a review, so the one command
 * that does it (`used-by`) prints a warning before its results and is labelled audit-only.
 *
 * USAGE
 *   node scripts/search.mjs                     the 15 sections and their deciding test
 *   node scripts/search.mjs shape "<words>"     rows whose case matches those words
 *   node scripts/search.mjs section <slug>      every row of one section
 *   node scripts/search.mjs row <id>            one row, in full
 *   node scripts/search.mjs traps <slug>        the trap block of one section
 *   node scripts/search.mjs used-by <Name>      AUDIT ONLY — which cases pick this component
 *
 * EXIT CODES
 *   0  something was found and printed
 *   1  nothing matched, or the command/section/row asked for does not exist
 *
 * Never open `data/matrix.csv` whole. One question touches one row.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** Root of this skill — the folder holding `data/`, `references/`, `scripts/`. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Read a CSV from `data/` into an array of row objects keyed by the header.
 *
 * Written by hand rather than pulled from a package because this skill set has no
 * `package.json` and no `node_modules` — it must run on a bare `node` on any machine.
 * The parser handles the two things the data actually contains: cells quoted because they
 * hold a comma, and `""` standing for a literal quote inside such a cell.
 *
 * @param {string} name table name without the .csv suffix
 * @returns {Array<Record<string, string>>} one object per data row
 */
function read(name) {
    const file = join(ROOT, "canon", "fe", "explore", "component", "data", `${name}.csv`);
    if (!existsSync(file)) { console.error(`no such table: ${name}`); process.exit(1); }

    const lines = readFileSync(file, "utf8").trim().split(/\r?\n/);

    /** Split one CSV line into cells, honouring quotes and doubled quotes. */
    const split = (line) => {
        const out = [];
        let cell = "", quoted = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                // A doubled quote inside a quoted cell is one literal quote character.
                if (quoted && line[i + 1] === '"') { cell += '"'; i++; continue; }
                quoted = !quoted;
                continue;
            }
            // A comma only ends a cell when it is not inside quotes.
            if (ch === "," && !quoted) { out.push(cell); cell = ""; continue; }
            cell += ch;
        }
        out.push(cell);
        return out.map((c) => c.trim());
    };

    const head = split(lines[0]);
    return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
}

/**
 * Print `text` after `label`, wrapping continuation lines under the text rather than under
 * the label. Cells here run to a couple of hundred characters; unwrapped they turn a terminal
 * into a wall and the answer stops being readable at the moment it matters most.
 *
 * @param {string} label left-hand label, already padded to the column width
 * @param {string} text the cell
 * @param {number} [width] wrap column
 */
const wrap = (label, text, width = 92) => {
    if (!text) return;
    const pad = " ".repeat(label.length);
    const words = text.split(" ");
    let line = "";
    const out = [];
    for (const w of words) {
        if ((line + " " + w).trim().length > width) { out.push(line); line = w; }
        else line = (line ? line + " " : "") + w;
    }
    if (line) out.push(line);
    out.forEach((l, i) => console.log(`${i === 0 ? label : pad}${l}`));
};

/**
 * Print one matrix row in the order the table is meant to be read:
 * what you hold, what to choose, where the content goes, what NOT to choose.
 * @param {Record<string, string>} r a row from matrix.csv
 */
const printRow = (r) => {
    console.log(`\n# ${r.id}`);
    wrap("  you have     ", r.you_have);
    wrap("  CHOOSE       ", r.choose);
    // An em dash rather than a blank: a few rows genuinely have no entry point, and silence
    // would read as a missing value instead of a deliberate one.
    wrap("  entry point  ", r.entry_point || "—");
    wrap("  don't choose ", r.dont_choose || "—");
};

const [cmd, ...rest] = process.argv.slice(2);

// ---- no command: the 15 doors and how each one is decided ----------------

if (!cmd || cmd === "sections") {
    console.log("Enter by what you are holding, not by the component you already have in mind.\n");
    for (const s of read("sections")) {
        console.log(`${s.section.padEnd(13)} ${s.num.padStart(2)}. ${s.title}`);
        wrap("              ", s.deciding_test);
    }
    console.log("\nnode scripts/search.mjs shape \"<words>\" | section <slug> | row <id> | traps <slug>");
    process.exit(0);
}

// ---- shape: the normal way in ---------------------------------------------

if (cmd === "shape") {
    const q = rest.join(" ").toLowerCase().split(/\s+/).filter(Boolean);
    if (!q.length) { console.error("shape needs words: search.mjs shape \"expandable rows\""); process.exit(1); }

    const rows = read("matrix");

    /**
     * The words of a row, as whole words. `dont_choose` is left out on purpose — a row that
     * merely warns against a word is not a row about that word. Whole words rather than
     * substrings, or "of" matches inside "proof" and every short word matches everything.
     */
    const wordsOf = (r) => new Set(`${r.you_have} ${r.choose} ${r.entry_point}`.toLowerCase().match(/[a-z]+/g) ?? []);
    const bag = rows.map((r) => ({ r, words: wordsOf(r) }));

    // Two filters, both measured rather than listed, because a hand-written stopword list rots
    // as rows are added:
    //   - a token of one or two letters is grammar, not a data shape
    //   - a word a quarter of the rows contain cannot tell those rows apart
    // Measured on the shipped data: "a" 70%, "the" 37%, "one" 25% — all noise. "paragraph",
    // "ring" and "tabs" sit at 1-2 rows each and are exactly what a query should turn on.
    const COMMON = 0.25;
    const informative = q
        .filter((w) => w.length > 2)
        .filter((w) => bag.filter((b) => b.words.has(w)).length < rows.length * COMMON);

    if (!informative.length) {
        console.log("Every word in that query is either grammar or appears all over the table,");
        console.log("so none of them can pick a row. Describe the DATA: how many of the thing,");
        console.log("what each one carries, what stays hidden until asked for.");
        process.exit(1);
    }

    // Any informative word matching is enough. A stricter rule was tried and reverted: a query
    // phrased in full sentences lands only one or two of its words in cells this terse, so
    // demanding a proportion rejected "one paragraph of author prose" — a shape the table
    // answers plainly. Candidates are for a human to choose between; the cost of one extra
    // candidate is a glance, the cost of a missed row is a component invented for no reason.
    const scored = bag
        .map(({ r, words }) => ({ r, score: informative.filter((w) => words.has(w)).length }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

    // No match is a real outcome, not a search failure — and the response to it is the one
    // rule this table exists to protect: a shape with no row is not permission to invent.
    if (!scored.length) {
        console.log("No row matches that shape.");
        console.log("A shape with no row is not permission to invent a component — draw the");
        console.log("proposed entry as a widget and let the teacher rule on it.");
        process.exit(1);
    }

    for (const { r } of scored) printRow(r);
    console.log(`\n${scored.length} candidate row(s). Pick by the deciding test of the section,`);
    console.log(`not by which name reads best: node scripts/search.mjs section ${scored[0].r.section}`);
    process.exit(0);
}

// ---- section: every case in one family ------------------------------------

if (cmd === "section") {
    const slug = rest[0];
    const meta = read("sections").find((s) => s.section === slug);
    if (!meta) {
        console.error(`unknown section: ${slug}`);
        console.error(`known: ${read("sections").map((s) => s.section).join(" ")}`);
        process.exit(1);
    }

    // The deciding test comes first. Rows within a section differ on one named axis, and
    // reading the rows without the test is how two of them end up looking equally right.
    console.log(`# ${meta.num}. ${meta.title}`);
    if (meta.source) console.log(`  source  ${meta.source}`);
    wrap("  test    ", meta.deciding_test);

    for (const r of read("matrix").filter((r) => r.section === slug)) printRow(r);
    console.log(`\nTraps of this section: node scripts/search.mjs traps ${slug}`);
    process.exit(0);
}

// ---- row: one case, in full -----------------------------------------------

if (cmd === "row") {
    const hit = read("matrix").find((r) => r.id === rest[0]);
    if (!hit) { console.error(`unknown row: ${rest[0]}`); process.exit(1); }
    printRow(hit);
    console.log(`\nTraps of this section: node scripts/search.mjs traps ${hit.section}`);
    process.exit(0);
}

// ---- traps: one slice of the 36 KB reference ------------------------------

if (cmd === "traps") {
    const slug = rest[0];
    const file = join(ROOT, "canon", "fe", "explore", "component", "references", "traps.md");
    const text = readFileSync(file, "utf8");

    // The reference is one file with a `## <slug>` heading per section. Slicing it here is
    // what lets it stay a single readable document without ever being loaded whole.
    const blocks = text.split(/^## /m).slice(1);
    const hit = blocks.find((b) => b.split("\n")[0].trim() === slug);
    if (!hit) {
        console.error(`no trap block for: ${slug}`);
        console.error(`known: ${blocks.map((b) => b.split("\n")[0].trim()).join(" ")}`);
        process.exit(1);
    }

    // Put back the `## ` that split() consumed, and drop the trailing rule between blocks.
    console.log(`## ${hit.replace(/\n---\s*$/, "").trimEnd()}`);
    process.exit(0);
}

// ---- used-by: the backward read, allowed only for auditing ----------------

if (cmd === "used-by") {
    const name = rest[0];
    if (!name) { console.error("used-by needs a component name"); process.exit(1); }

    // The warning prints before the results, not after, so it is read while deciding rather
    // than after a decision has already been made.
    console.log("AUDIT ONLY. Reading backward from a component name is how the wrong shell gets");
    console.log("kept — while building, enter from the shape instead.\n");

    // Exact name, exact case, whole word. A loose match reported `Flex` as chosen by a row
    // whose text merely says "a bare flex row", which is the opposite of an answer.
    const exact = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    const rows = read("matrix").filter((r) => exact.test(`${r.choose} ${r.dont_choose}`));

    if (!rows.length) {
        // Some names exist in the codebase but are not doors — internals of one layer that
        // look choosable from the outside. Saying so is more useful than "not found".
        const doors = read("not-a-door").find((d) => d.name.toLowerCase().includes(name.toLowerCase()));
        if (doors) {
            console.log(`${doors.name} is NOT A DOOR — it belongs to ${doors.belongs_to}.`);
            console.log(`Only touch it when: ${doors.only_touch_when}`);
            process.exit(0);
        }
        console.log(`No row names ${name}. It is either misspelled or not in the set.`);
        process.exit(1);
    }

    for (const r of rows) printRow(r);
    process.exit(0);
}

console.error(`unknown command: ${cmd}`);
console.error("commands: sections | shape <words> | section <slug> | row <id> | traps <slug> | used-by <Name>");
process.exit(1);
