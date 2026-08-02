#!/usr/bin/env node
/**
 * check-presentational-purity.mjs — a `component.tsx` (`_Name`) is presentational.
 *
 * `canon/fe/enforce/tiers/split.md`: a data-owning tier is two files. The connected
 * `index.tsx` (`Name`) owns the request and i18n; the presentational `component.tsx` (`_Name`) takes
 * already-resolved props and renders. A `_Name` that fetches, reads a store, or resolves i18n has
 * pulled a source of truth down past its props — and can no longer be rendered from a story.
 *
 * This gate reads every `component.tsx` in both trees and fails if it CALLS a data source or i18n.
 * Importing or rendering a connected child that calls them is fine — only calls in the file's own
 * code count, so comments and imports are stripped before scanning.
 *
 * It also fails if a `component.tsx` carries the blueprint's anatomy overlay — `showAnatomy`,
 * `anatPart`, or `data-anat-part`. Those are dev tooling that belongs to the retiring blueprint tree;
 * real `src` code stays clean of them — identity is `data-tier` + `data-component` (split.md).
 *
 *   node scripts/check-presentational-purity.mjs <repo>
 *
 * Allowed in a `component.tsx`: useState, useMemo, useCallback, useEffect, useRef, useRouter — view
 * state and navigation, not app data. Forbidden: the data/store/i18n calls + overlay tokens below.
 */
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const repo = process.argv[2];
if (!repo) { console.error("usage: node scripts/check-presentational-purity.mjs <repo>"); process.exit(1); }

const ROOTS = [
    join(repo, ".storybook", "components"),
    join(repo, "src", "components"),
];

// A forbidden CALL: the hook/function name immediately followed by `(`.
// `\buse\(` matches only the bare React `use(` context read — never `useState(` (no `(` after `use`).
const FORBIDDEN = [
    { re: /\buseSWR\s*\(/, why: "useSWR" },
    { re: /\buseSWRMutation\s*\(/, why: "useSWRMutation" },
    { re: /\buse\w+Swr\s*\(/, why: "use…Swr (data query/mutation)" },
    { re: /\buseAppSelector\s*\(/, why: "useAppSelector (redux)" },
    { re: /\buseAppDispatch\s*\(/, why: "useAppDispatch (redux)" },
    { re: /\buseContext\s*\(/, why: "useContext" },
    { re: /\buse\s*\(/, why: "use() (react context read)" },
    { re: /\buseTranslations\s*\(/, why: "useTranslations (i18n)" },
    { re: /\buseLocale\s*\(/, why: "useLocale (i18n)" },
    { re: /\bfetch\s*\(/, why: "fetch()" },
    { re: /\bshowAnatomy\b/, why: "showAnatomy (retired overlay — identity is data-tier/data-component)" },
    { re: /\banatPart\b/, why: "anatPart (retired overlay — identity is data-tier/data-component)" },
    { re: /\bdata-anat-part\b/, why: "data-anat-part (retired overlay — identity is data-tier/data-component)" },
];

const rel = (f) => relative(repo, f).replace(/\\/g, "/");

function walk(dir, out = []) {
    if (!existsSync(dir)) return out;
    for (const name of readdirSync(dir)) {
        if (name === "_legacy") continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/(^|[\\/])component\.tsx?$/.test(p)) out.push(p);
    }
    return out;
}

/** Blank out imports, line comments and block comments so only real code is scanned. */
function stripNonCode(src) {
    return src
        .replace(/^\s*import[\s\S]*?from\s*["'][^"']+["'];?\s*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
}

const violations = [];
for (const root of ROOTS) {
    for (const f of walk(root)) {
        const code = stripNonCode(readFileSync(f, "utf8"));
        const hits = [];
        for (const { re, why } of FORBIDDEN) {
            if (re.test(code)) hits.push(why);
        }
        if (hits.length) violations.push({ f: rel(f), hits });
    }
}

console.log(`${repo}\n`);
if (violations.length) {
    console.log(`PRESENTATIONAL-PURITY  ${violations.length} file(s) — a component.tsx must not fetch, read a store, or resolve i18n (split.md):`);
    for (const v of violations) console.log(`        ${v.f}\n            calls: ${v.hits.join(" · ")}`);
    console.log(`\n${violations.length} violation(s)`);
    process.exit(1);
} else {
    console.log("every component.tsx is presentational (no data/store/i18n calls)");
    process.exit(0);
}
