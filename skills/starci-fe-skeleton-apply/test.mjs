#!/usr/bin/env node
/**
 * Tests for starci-fe-skeleton-apply.
 *
 * This skill ships no script, so there is nothing to execute and no sandbox to build. What it
 * ships is a document that POINTS somewhere, and the two ways such a document rots are both
 * checkable: a citation whose file has moved, and a machine path that crept back in.
 *
 * Each case is named as the CLAIM the skill makes, so a failing run reads as a promise broken
 * rather than as "test 2 failed".
 *
 * What it cannot test: whether the skeleton an agent holding this skill builds actually mirrors
 * anything. That needs an eval — see README.md.
 *
 *   node .claude/skills/starci-fe-skeleton-apply/test.mjs [--verbose]
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-fe-skeleton-apply");
const SKILL = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "SKILL.md"), "utf8");

/**
 * Every canon / patterns / design / skills path the document cites.
 * A glob is skipped: `check-*.mjs` names a family, not a file.
 */
const cited = [...new Set(
    (SKILL.match(/(?:canon|patterns|design|skills|scripts)\/[A-Za-z0-9._/-]+/g) ?? [])
        .map((p) => p.replace(/[.,;:)]+$/, ""))
        .filter((p) => !p.includes("*")),
)];

const broken = cited.filter((p) => !existsSync(join(REPO, p)));

t.expect(
    "every canon, pattern and sibling-skill path it cites still exists — a moved reference fails here",
    {
        code: broken.length ? 1 : 0,
        out: broken.length
            ? `broken references: ${broken.join(", ")}`
            : `${cited.length} cited paths resolve under the canon root`,
    },
    { exit: 0, has: ["cited paths resolve"] },
);

// A path is true on exactly one machine, and the failure looks like success: files open, greps
// return, conclusions get drawn from the wrong tree. The source skill this was ported from
// carried one, which is why this case exists at all.
const machinePaths = [
    /[A-Za-z]:[\\/][^\s`)]*[Rr]epositories/,
    /\/[a-z]\/[Rr]epositories/,
    /[A-Za-z]:\\/,
].filter((re) => re.test(SKILL)).map(String);

t.expect(
    "it names no machine path — the source is resolved through the workspace context instead",
    {
        code: machinePaths.length ? 1 : 0,
        out: machinePaths.length
            ? `hardcoded path matched: ${machinePaths.join(" ")}`
            : "no machine path appears in the document",
    },
    { exit: 0, has: ["no machine path"] },
);

t.expect(
    "the founding invariant is still stated in words, not left to the procedure to imply",
    { code: 0, out: SKILL },
    { has: ["the skeleton mirrors the loaded shape, so nothing\ncollapses and nothing jumps"] },
);

t.finish();
