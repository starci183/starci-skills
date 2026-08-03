#!/usr/bin/env node
/**
 * Tests for starci-be-cannon-plan.
 *
 * This skill ships no script — its whole substance is the document. So the suite tests the
 * document, and each case is named as the CLAIM the document makes, so a failing run reads as a
 * promise broken rather than as "test 3 failed".
 *
 * Three things are worth checking, because these are the three that actually rot:
 *   1. a cited canon or skill path outlives the file it points at — the shelf moved, the skill
 *      kept pointing at the old one, and a reader is sent somewhere that no longer exists
 *   2. a machine-specific path creeps back in — true on one machine, silently wrong on the next
 *   3. the founding invariant gets softened in a rewrite, and the skill that must not edit the
 *      tree it grades starts merely preferring not to
 *
 * Whitespace is collapsed before the invariant is matched: the sentence is wrapped across lines
 * in the source, and a suite that fails on a line break would be testing the formatter.
 *
 *   node .claude/skills/starci-be-cannon-plan/test.mjs [--verbose]
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-be-cannon-plan");

const SKILL = join(dirname(fileURLToPath(import.meta.url)), "SKILL.md");
const text = readFileSync(SKILL, "utf8");
const flat = text.replace(/\s+/g, " ");

/** The one sentence the rest of the set relies on this skill still saying. */
const INVARIANT = "An audit reads and grades; it never edits the tree it is grading.";

/** Every canon/patterns/design/skills path the document points a reader at. */
function citedPaths(source) {
    const found = new Set();
    for (const raw of source.match(/\b(?:canon|patterns|design|skills|scripts)\/[A-Za-z0-9._/-]+/g) ?? []) {
        let p = raw;
        // Trailing punctuation belongs to the sentence, not to the path — but only strip it while
        // what is left does not already end in a real file extension.
        while (!/\.(md|mjs|ts|json)$/.test(p) && /[.,;:)/]$/.test(p)) p = p.slice(0, -1);
        if (p) found.add(p);
    }
    return [...found].sort();
}

// ---- every path it sends a reader to still exists ------------------------

t.group("the paths it cites still resolve");

const paths = citedPaths(text);

t.expect(
    "the document cites the canon by path at all — a skill that points nowhere restates instead",
    { code: paths.length > 0 ? 0 : 1, out: `${paths.length} cited path(s)` },
    { exit: 0 },
);

for (const p of paths) {
    const exists = existsSync(join(REPO, p));
    t.expect(
        `a reader following "${p}" arrives somewhere`,
        { code: exists ? 0 : 1, out: exists ? `resolves: ${p}` : `missing under REPO: ${p}` },
        { exit: 0, has: ["resolves"] },
    );
}

// ---- nothing in it is true on only one machine ---------------------------

t.group("nothing in it is true on only one machine");

const machinePaths = [
    ...(text.match(/[A-Za-z]:[\\/]{1,2}Repositories[^\s`")]*/g) ?? []),
    ...(text.match(/\/[a-z]\/Repositories[^\s`")]*/gi) ?? []),
];

t.expect(
    "no drive-letter or mounted-drive path is written down — the source is resolved, never remembered",
    { code: machinePaths.length ? 1 : 0, out: machinePaths.length ? machinePaths.join(", ") : "none" },
    { exit: 0, has: ["none"] },
);

// ---- the invariant is still stated, not implied --------------------------

t.group("the invariant survives a rewrite");

t.expect(
    "it still says, in words, that an audit never edits the tree it grades",
    { code: 0, out: flat },
    { has: [INVARIANT] },
);

t.finish();
