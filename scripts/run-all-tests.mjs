#!/usr/bin/env node
/**
 * test.mjs — run every skill's own suite.
 *
 * WHY THIS IS ONLY A RUNNER
 * Each skill keeps its tests next to itself, so a skill folder can be copied into another
 * repo and still carry its own proof. This file holds no cases: it finds the suites, runs
 * each in its own process, and reports.
 *
 * A suite is any `test.mjs` beside a `SKILL.md`. That rule means a new skill is picked up by
 * existing here, and a skill that quietly loses its tests is visible as a gap in the list.
 *
 *   node scripts/run-all-tests.mjs            run all suites
 *   node scripts/run-all-tests.mjs --verbose  pass --verbose through to each
 *   node scripts/run-all-tests.mjs component  run only suites whose path matches
 *
 * EXIT CODES
 *   0  every suite passed
 *   1  at least one suite failed, or a skill has no suite at all
 */

import { spawnSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const verbose = argv.includes("--verbose");
const filter = argv.find((a) => !a.startsWith("--"));

/** Folders that never hold a skill. */
const SKIP = new Set(["node_modules", ".git", "context", ".testtmp", "scripts"]);

/**
 * Every folder holding a SKILL.md, at any depth.
 * @param {string} root
 * @returns {string[]} absolute folder paths
 */
function findSkills(root) {
    const out = [];
    const walk = (dir) => {
        let entries;
        try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
        if (entries.some((e) => e.isFile() && e.name === "SKILL.md")) out.push(dir);
        for (const e of entries) {
            if (!e.isDirectory() || SKIP.has(e.name) || e.name.startsWith(".")) continue;
            walk(join(dir, e.name));
        }
    };
    walk(root);
    return out;
}

const skills = findSkills(REPO);
const untested = [];
const failed = [];
let ran = 0;

for (const dir of skills) {
    const rel = relative(REPO, dir).replace(/\\/g, "/");
    const suite = join(dir, "test.mjs");

    if (!existsSync(suite)) {
        // Not fatal on its own, but named at the end: a skill with no suite is a claim with
        // nothing behind it, and silence here would hide that.
        untested.push(rel);
        continue;
    }
    if (filter && !rel.includes(filter)) continue;

    ran++;
    const r = spawnSync(process.execPath, [suite, ...(verbose ? ["--verbose"] : [])], {
        stdio: "inherit", cwd: REPO,
    });
    if (r.status !== 0) failed.push(rel);
}

console.log(`\n${"=".repeat(60)}`);
console.log(`${ran} suite(s) run, ${failed.length} failed`);
for (const f of failed) console.log(`  FAILED  ${f}`);

// Listed, not failed. A skill with no suite is a gap worth seeing every run, but failing the
// whole set because an unrelated skill has no tests would train people to ignore the exit code
// — and then a real failure goes unnoticed too.
for (const u of untested) console.log(`  no suite  ${u}`);
if (untested.length) console.log(`\n${untested.length} skill(s) claim something no test checks.`);

process.exit(failed.length ? 1 : 0);
