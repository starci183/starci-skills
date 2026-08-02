#!/usr/bin/env node
/**
 * audit-principles.mjs — hold `canon/fe/enforce/spacing/*.md` and the code that
 * implements it to the same numbers.
 *
 * WHY THIS EXISTS
 * The moment a scale is written in a document AND in a lookup table AND in a second tree's copy of
 * that lookup table, it exists three times and nothing keeps the three agreeing. That is ATOM-11's
 * disease one layer up: the failure is silent, and it is worse here than in a component, because a
 * document is what the next person quotes. A gate reading a stale table will fail correct code and
 * pass wrong code, and both directions read as authority.
 *
 * The rule this enforces is the one written at the top of `principles/README.md`: a value is
 * written out HERE and nowhere else. `elements/` links to it; code implements it.
 *
 * WHAT IT COMPARES
 *   the step table in `principles/gap.md`        ↔  GAP_CLASS in frames/_spacing.ts, both trees
 *   the step table in `principles/padding.md`    ↔  PADDING_CLASS, both trees
 *   the union in `principles/position.md`        ↔  AllowedClassName in atoms/_allowed-class-name.ts
 *   the breakpoints in `principles/responsive.md` ↔  the keys of `Responsive<T>`
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * It does not decide which side is right. A mismatch is reported as a mismatch, with both values,
 * because the answer is sometimes "the doc is stale" and sometimes "someone widened the scale
 * without writing down why" — and a script that picks a winner would quietly launder the second
 * case into the first.
 *
 * USAGE
 *   node scripts/audit-principles.mjs <path-to-repo>
 *   node scripts/audit-principles.mjs <path-to-repo> --quiet
 *
 * EXIT CODES
 *   0  every table agrees across doc and both trees
 *   1  at least one disagreement, or a file this gate needs is missing
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = process.argv[2];
if (!repo) {
    console.error("usage: node scripts/audit-principles.mjs <path-to-repo> [--quiet]");
    process.exit(1);
}
const quiet = process.argv.includes("--quiet");

/** The canon lives beside this script, not in the audited repo. */
const PRINCIPLES = join(dirname(fileURLToPath(import.meta.url)), "..", "design", "storybook", "architecture", "principles");

const findings = [];
const note = (where, detail) => findings.push({ where, detail });

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);

/**
 * The step → class pairs a principles table declares.
 *
 * Read out of the markdown table rather than out of prose: a row is `| 3 | `gap-2` | 8 | … |`, and
 * the first two cells are the contract. Prose around it may say anything; the table is the part a
 * reader copies from.
 *
 * @param {string} md the document
 * @returns {Map<string,string>} step -> class
 */
function stepsFromDoc(md) {
    const out = new Map();
    for (const line of md.split(/\r?\n/)) {
        const m = line.match(/^\|\s*`?(\d+)`?\s*\|\s*`([\w-]+)`\s*\|/);
        if (m) out.set(m[1], m[2]);
    }
    return out;
}

/**
 * The step → class pairs a `Record<Allowed…, string>` declares.
 *
 * @param {string} src the module source
 * @param {string} name the const to read
 * @returns {Map<string,string>|null} null when the const is absent
 */
function stepsFromCode(src, name) {
    const start = src.indexOf(`${name}`);
    if (start === -1) return null;
    const open = src.indexOf("{", start);
    if (open === -1) return null;
    let depth = 0;
    let end = open;
    for (; end < src.length; end++) {
        if (src[end] === "{") depth++;
        else if (src[end] === "}" && --depth === 0) break;
    }
    const out = new Map();
    for (const m of src.slice(open, end).matchAll(/(\d+)\s*:\s*"([^"]+)"/g)) out.set(m[1], m[2]);
    return out;
}

/** Compare two step tables and report every disagreement, in both directions. */
function compare(label, doc, code, codeWhere) {
    if (!code) {
        note(codeWhere, `${label}: the table is missing entirely — the doc declares ${doc.size} step(s) that nothing implements`);
        return;
    }
    for (const [step, cls] of doc) {
        if (!code.has(step)) note(codeWhere, `${label} step \`${step}\`: the doc has it (\`${cls}\`), the code does not`);
        else if (code.get(step) !== cls) note(codeWhere, `${label} step \`${step}\`: doc says \`${cls}\`, code says \`${code.get(step)}\``);
    }
    for (const step of code.keys()) {
        if (!doc.has(step)) note(codeWhere, `${label} step \`${step}\`: the code has it (\`${code.get(step)}\`), the doc does not — a rung nobody wrote a sentence for`);
    }
}

// ---- gap and padding, against both trees ----------------------------------

const TREES = [
    [".storybook/components", join(repo, ".storybook", "components")],
    ["src/components", join(repo, "src", "components")],
];

for (const [name, table, doc] of [
    ["GAP_CLASS", "GAP_CLASS", "gap.md"],
    ["PADDING_CLASS", "PADDING_CLASS", "padding.md"],
]) {
    const md = read(join(PRINCIPLES, doc));
    if (!md) {
        note(`principles/${doc}`, "missing — every table it governs is unchecked");
        continue;
    }
    const declared = stepsFromDoc(md);
    if (declared.size === 0) {
        note(`principles/${doc}`, "no step table found — the gate reads the markdown table, so a doc written as prose alone cannot be enforced");
        continue;
    }
    for (const [treeName, root] of TREES) {
        const src = read(join(root, "frames", "_spacing.ts"));
        if (!src) {
            note(`${treeName}/frames/_spacing.ts`, "missing");
            continue;
        }
        compare(name, declared, stepsFromCode(src, table), `${treeName}/frames/_spacing.ts`);
    }
}

// ---- the position union ----------------------------------------------------
//
// Compared as a SET, not as text: the union is written across several lines with comments between
// the groups, and a whitespace diff is not a finding.

/** Every `"literal"` member of a union declaration. Template members are reported separately. */
function unionMembers(src, name) {
    // Comments first. The union's own JSDoc quotes members in backticks to explain them, and
    // counting those as declarations reported four template members that do not exist — the gate
    // reading prose as code, which is the exact failure this whole layer was built to stop.
    const bare = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const m = bare.match(new RegExp(`type\\s+${name}\\s*=([\\s\\S]*?)(?:\\n\\n|\\nexport|$)`));
    if (!m) return null;
    return {
        literals: new Set([...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])),
        templates: [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]),
    };
}

const positionDoc = read(join(PRINCIPLES, "position.md"));
if (positionDoc) {
    const declared = unionMembers(positionDoc, "AllowedClassName");
    for (const [treeName, root] of TREES) {
        const src = read(join(root, "atoms", "_allowed-class-name.ts"));
        if (!src) {
            note(`${treeName}/atoms/_allowed-class-name.ts`, "missing");
            continue;
        }
        const actual = unionMembers(src, "AllowedClassName");
        if (!declared || !actual) {
            note(`${treeName}/atoms/_allowed-class-name.ts`, "AllowedClassName could not be read on one side");
            continue;
        }
        for (const member of declared.literals) {
            if (!actual.literals.has(member)) note(`${treeName}/atoms/_allowed-class-name.ts`, `\`${member}\` is in position.md and not in the code`);
        }
        for (const member of actual.literals) {
            if (!declared.literals.has(member)) note(`${treeName}/atoms/_allowed-class-name.ts`, `\`${member}\` is in the code and not in position.md`);
        }
        if (declared.templates.length !== actual.templates.length) {
            note(`${treeName}/atoms/_allowed-class-name.ts`, `template members differ: ${declared.templates.length} in the doc, ${actual.templates.length} in the code`);
        }
    }
}

// ---- the breakpoint set ----------------------------------------------------

const responsiveDoc = read(join(PRINCIPLES, "responsive.md"));
if (responsiveDoc) {
    const declared = [...responsiveDoc.matchAll(/^\|\s*`(sm|md|lg|xl|2xl)`\s*\|/gm)].map((m) => m[1]);
    for (const [treeName, root] of TREES) {
        const src = read(join(root, "frames", "_spacing.ts"));
        if (!src) continue;
        const m = src.match(/type\s+Responsive<[^>]*>\s*=([\s\S]*?)(?:\n\n|\nexport|$)/);
        if (!m) {
            note(`${treeName}/frames/_spacing.ts`, "no `Responsive<T>` — responsive.md governs a type that does not exist");
            continue;
        }
        for (const bp of declared) {
            if (!new RegExp(`\\b${bp}\\s*\\??\\s*:`).test(m[1])) {
                note(`${treeName}/frames/_spacing.ts`, `breakpoint \`${bp}\` is in responsive.md and not in \`Responsive<T>\``);
            }
        }
    }
}

// ---- report ---------------------------------------------------------------

console.log(`${repo}`);
console.log(`canon: ${PRINCIPLES.replace(/\\/g, "/")}\n`);

if (findings.length === 0) {
    console.log("principles and code agree — every step, every member, both trees");
    process.exit(0);
}

const byFile = new Map();
for (const f of findings) {
    if (!byFile.has(f.where)) byFile.set(f.where, []);
    byFile.get(f.where).push(f.detail);
}
for (const [where, list] of byFile) {
    console.log(`${where}  ${list.length} disagreement(s)`);
    if (!quiet) for (const d of list) console.log(`        ${d}`);
    console.log("");
}
console.log(`${findings.length} disagreement(s) between the canon and the code`);
console.log("Neither side is assumed right. A stale doc and a silently widened scale look identical here.");
process.exit(1);
