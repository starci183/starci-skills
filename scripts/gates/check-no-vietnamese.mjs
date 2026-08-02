#!/usr/bin/env node
/**
 * check-no-vietnamese.mjs — the storybook and its components are English.
 *
 * `canon/fe/enforce/tiers/story.md` requires all story + component text in English (labels,
 * titles, JSDoc, comments). This gate scans the rendered-tree source and flags any real Vietnamese.
 *
 * NOT IN SCOPE: localized CONTENT sources — a file whose Vietnamese IS the product's `vi` locale,
 * sitting beside an `en` sibling in the same object (`PlaygroundSessionProvider/content/*`, the lab
 * install guides). Translating those does not make the app English (the `en` half already is) — it
 * deletes the Vietnamese half. The gate skips them by path.
 *
 * TWO sanctioned exceptions:
 *   1. a language-picker endonym — a line carrying `Tiếng Việt` (the Vietnamese language's own name
 *      in a selector);
 *   2. FUNCTIONAL Vietnamese — a literal the code matches or emits at runtime (a regex over
 *      Vietnamese lesson prose, `đ`→`d` slug transliteration, the `đ` currency suffix). Translating
 *      one of those breaks behaviour, so the line carries an explicit `vn-ok: <reason>` comment.
 * Any other Vietnamese is a violation.
 *
 *   node scripts/check-no-vietnamese.mjs <repo>
 *
 * Precise Vietnamese letters only — never matches ·, §, —, emoji, or ñ/ç/ü.
 */
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const repo = process.argv[2];
if (!repo) { console.error("usage: node scripts/check-no-vietnamese.mjs <repo>"); process.exit(1); }

const VN = /[À-ÃÈ-ÊÌÍÒ-ÕÙÚÝà-ãè-êìíò-õùúýĂăĐđĨĩŨũƠơƯưẠ-ỿ]/;
const ENDONYM = /Tiếng Việt/; // sanctioned language-picker label
const PRAGMA = /\bvn-ok:/; // sanctioned functional literal, reason stated on the line
const LOCALE_CONTENT = /PlaygroundSessionProvider\/content\//; // bilingual guide sources (vi + en side by side)

const ROOTS = [
    join(repo, ".storybook", "stories"),
    join(repo, ".storybook", "components"),
    join(repo, "src", "components"),
];
const rel = (f) => relative(repo, f).replace(/\\/g, "/");

function walk(dir, out = []) {
    if (!existsSync(dir)) return out;
    for (const name of readdirSync(dir)) {
        if (name === "_legacy") continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.tsx?$/.test(p)) out.push(p);
    }
    return out;
}

const hits = [];
for (const root of ROOTS) {
    for (const f of walk(root)) {
        if (LOCALE_CONTENT.test(rel(f))) continue;
        const bad = readFileSync(f, "utf8").split("\n").filter((l) => VN.test(l) && !ENDONYM.test(l) && !PRAGMA.test(l));
        if (bad.length) hits.push({ f: rel(f), n: bad.length, sample: bad[0].trim().slice(0, 70) });
    }
}

console.log(`${repo}\n`);
if (hits.length) {
    console.log(`NO-VIETNAMESE  ${hits.length} file(s) with Vietnamese`);
    for (const h of hits.slice(0, 60)) console.log(`        [${h.n}] ${h.f}\n            ${h.sample}`);
    if (hits.length > 60) console.log(`        … and ${hits.length - 60} more`);
    console.log(`\n${hits.length} violation(s)`);
    process.exit(1);
} else {
    console.log("no Vietnamese in stories or components (the sanctioned endonym aside)");
    process.exit(0);
}
