#!/usr/bin/env node
/**
 * check-story-anatomy.mjs — every component story is a `BlockAnatomy` storymap.
 *
 * A bare `<X … />` in a wrapper shows one frozen look and teaches nothing about the prop that
 * produced it. `canon/fe/enforce/tiers/story.md` requires the storymap format for every
 * tiered component; this gate catches the ones that skipped it.
 *
 * SCOPE (story.md): atom · frame · composite · block · overlay · layout MUST use `BlockAnatomy`.
 * page (a full-state render, no prop table), behavior and util are exempt.
 *
 *   node scripts/check-story-anatomy.mjs <repo>
 */
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const repo = process.argv[2];
if (!repo) { console.error("usage: node scripts/check-story-anatomy.mjs <repo>"); process.exit(1); }

const DIR = join(repo, ".storybook", "stories");
if (!existsSync(DIR)) { console.error(`no stories at ${DIR}`); process.exit(1); }

const EXEMPT = ["/pages/", "/behaviors/", "/utils/"]; // full-state renders + non-component helpers
const rel = (f) => relative(repo, f).replace(/\\/g, "/");

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        if (name === "_legacy") continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.stories\.tsx?$/.test(p)) out.push(p);
    }
    return out;
}

const violations = [];
for (const f of walk(DIR)) {
    const r = rel(f);
    if (EXEMPT.some((e) => r.includes(e))) continue;
    const text = readFileSync(f, "utf8");
    if (!/\bBlockAnatomy\b/.test(text)) {
        violations.push(r);
    }
}

console.log(`${repo}\n`);
if (violations.length) {
    console.log(`STORY-ANATOMY  ${violations.length} violation(s)`);
    console.log(`        a component story must be a BlockAnatomy storymap (story.md) — these are bare:`);
    for (const v of violations) console.log(`        ${v}`);
    console.log(`\n${violations.length} violation(s)`);
    process.exit(1);
} else {
    console.log("every component story is a BlockAnatomy storymap (pages/behaviors/utils exempt)");
    process.exit(0);
}
