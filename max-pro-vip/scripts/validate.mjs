#!/usr/bin/env node
// Validate this skill set. Run before shipping any canon edit.
//
//   node scripts/validate.mjs          all checks
//   node scripts/validate.mjs --fix    auto-fix trailing whitespace only
//
// Checks, in order of how badly each one has bitten:
//   1. no Vietnamese diacritics anywhere (this set is English-only)
//   2. no emoji
//   3. table integrity  - every `|` row closes, column counts match the separator
//   4. line budgets     - SKILL.md under 500 lines, per the Anthropic standard
//   5. table of contents - any markdown over 300 lines needs one
//   6. description      - 60-120 words, and must state an anti-trigger
//   7. dead links       - every relative markdown link resolves on disk
//   8. registry.json    - parses, and every entry has the required shape

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIX = process.argv.includes("--fix");

// The Anthropic standard: SKILL.md under 500 lines, references over 300 lines need a ToC,
// metadata (name + description) around 100 words.
const SKILL_MAX_LINES = 500;
const TOC_THRESHOLD = 300;
const DESC_MIN = 60;
const DESC_MAX = 120;

const SKIP_TABLE = /matrix\.md$/;
// docs/ is working paper, not part of the loaded skill set
const SKIP_META = /^docs[\\/]/;

const DIACRITICS = /[À-ÃÈ-ÊÌÍÒ-ÕÙÚÝà-ãè-êìíò-õùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ]/g;
const EMOJI = /[☀-➿⬀-⯿\u{1F000}-\u{1FAFF}]/gu;

const problems = [];
const note = (file, line, msg) => problems.push({ file, line, msg });

function walk(dir, out = []) {
    for (const n of readdirSync(dir)) {
        if (n === "node_modules" || n === ".git") continue;
        const p = join(dir, n);
        if (statSync(p).isDirectory()) walk(p, out);
        else out.push(p);
    }
    return out;
}

const files = walk(ROOT);
const mdFiles = files.filter((f) => f.endsWith(".md"));
const rel = (f) => relative(ROOT, f).replace(/\\/g, "/");

for (const f of mdFiles) {
    const r = rel(f);
    let text = readFileSync(f, "utf8");

    if (FIX) {
        const fixed = text.replace(/[ \t]+$/gm, "");
        if (fixed !== text) { writeFileSync(f, fixed, "utf8"); text = fixed; }
    }

    const lines = text.split("\n");

    // 1 + 2 -- character-level checks
    lines.forEach((l, i) => {
        // a code span is allowed to hold a literal example of the thing we forbid
        const stripped = l.replace(/`[^`]*`/g, "");
        const d = stripped.match(DIACRITICS);
        if (d) note(r, i + 1, `Vietnamese diacritic: ${[...new Set(d)].join(" ")}`);
        const e = l.match(EMOJI);
        if (e) note(r, i + 1, `emoji: ${[...new Set(e)].join(" ")}`);
    });

    // 3 -- tables
    // A pipe inside a code span is data, not a column boundary: `"a" | "b"` is one cell.
    if (!SKIP_TABLE.test(r)) {
        let cols = 0;
        lines.forEach((l, i) => {
            const t = l.trim();
            if (!t.startsWith("|")) { cols = 0; return; }
            if (!t.endsWith("|")) { note(r, i + 1, "table row does not close with |"); return; }
            const bare = t.replace(/`[^`]*`/g, "X").replace(/\\\|/g, "X");
            const n = bare.split("|").length - 2;
            if (/^[|\s:-]+$/.test(bare)) { cols = n; return; }
            if (cols && n !== cols) note(r, i + 1, `table row has ${n} cells, separator says ${cols}`);
        });
    }

    // 4 -- line budget for SKILL.md
    if (r.endsWith("SKILL.md") && lines.length > SKILL_MAX_LINES) {
        note(r, 0, `${lines.length} lines, ceiling ${SKILL_MAX_LINES} - split into references/`);
    }

    // 5 -- table of contents for long references
    if (!SKIP_META.test(r) && lines.length > TOC_THRESHOLD) {
        const hasToc = /^\s*[-*|].*\]\(#/m.test(text) || /^##+ (Contents|Table of contents)/mi.test(text);
        if (!hasToc) note(r, 0, `${lines.length} lines with no table of contents (threshold ${TOC_THRESHOLD})`);
    }

    // 6 -- description quality
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    if (fm && r.endsWith("SKILL.md")) {
        const d = fm[1].match(/^description:\s*([\s\S]*?)(?=\n\w+:|$)/m)?.[1]?.trim();
        if (!d) note(r, 0, "no description in frontmatter");
        else {
            const w = d.split(/\s+/).filter(Boolean).length;
            if (w < DESC_MIN || w > DESC_MAX) note(r, 0, `description is ${w} words, want ${DESC_MIN}-${DESC_MAX}`);
            if (!/\bnot for\b|\bdoes not\b|\bnever use\b/i.test(d)) note(r, 0, "description states no anti-trigger");
        }
    }

    // 5 -- relative links. A link inside a code span is an example of syntax, not a link.
    const linkText = text.replace(/`[^`]*`/g, "");
    for (const m of linkText.matchAll(/\[[^\]]*\]\(([^)#]+?)(?:#[^)]*)?\)/g)) {
        const target = m[1].trim();
        if (/^(https?:|mailto:)/.test(target)) continue;
        const abs = resolve(dirname(f), target);
        try { statSync(abs); } catch { note(r, 0, `dead link: ${target}`); }
    }
}

// 6 -- registry
try {
    const reg = JSON.parse(readFileSync(join(ROOT, "library", "registry.json"), "utf8"));
    const entries = (reg.entries ?? []).filter((e) => !e._comment);
    const TIERS = new Set(["foundations", "atom", "frame", "composite"]);
    for (const e of entries) {
        const where = `registry:${e.name ?? "<unnamed>"}`;
        if (!e.name) note(where, 0, "entry has no name");
        if (!TIERS.has(e.tier)) note(where, 0, `unknown tier: ${e.tier}`);
        if (!e.file) note(where, 0, "no file path");
        if (!e.role) note(where, 0, "no role - one sentence saying what it exists to do");

        // A foundations entry is a scale, not a component: no API, no states, no skeleton.
        if (e.tier === "foundations") {
            if (!Array.isArray(e.scale) || !e.scale.length) note(where, 0, "foundations entry has no scale");
            for (const s of e.scale ?? []) {
                if (!s.step) note(where, 0, "a scale row has no step name");
                if (!s.derived) note(where, 0, `scale step ${s.step} does not say how it is derived`);
            }
            if (!e.readBy?.length) note(where, 0, "no axis reads this foundation - it is dead or undocumented");
            continue;
        }

        if (!e.skeleton?.shape) note(where, 0, "no skeleton shape");
        for (const [k, v] of Object.entries(e.states ?? {})) {
            if (v === null && !e.statesOmittedWhy?.[k]) note(where, 0, `state ${k} omitted without a reason`);
        }
    }
} catch (err) {
    note("library/registry.json", 0, `does not parse: ${err.message}`);
}

if (!problems.length) {
    console.log(`clean - ${mdFiles.length} markdown files, ${files.length} files total`);
    process.exit(0);
}

const byFile = {};
for (const p of problems) (byFile[p.file] ??= []).push(p);
for (const [f, list] of Object.entries(byFile)) {
    console.log(`\n${f}`);
    for (const p of list) console.log(`  ${p.line ? `L${p.line}` : "  "}  ${p.msg}`);
}
console.log(`\n${problems.length} problem(s) in ${Object.keys(byFile).length} file(s)`);
process.exit(1);
