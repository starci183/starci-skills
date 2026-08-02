#!/usr/bin/env node
/**
 * Tests for starci-fe-contract.
 *
 * This skill ships no script of its own — it drives the runner and the gates that already live in
 * `patterns/fe/`. So there is nothing to execute here and no sandbox to build. What it ships is a
 * document that POINTS somewhere, and the two ways such a document rots are both checkable: a
 * citation whose file has moved, and a machine path that crept back in.
 *
 * Each case is named as the CLAIM the skill makes, so a failing run reads as a promise broken
 * rather than as "test 2 failed".
 *
 * What it cannot test: whether an agent holding this skill reads a red run correctly rather than
 * editing tokens until it turns green. That needs an eval — see README.md.
 *
 *   node .claude/skills/starci-fe-contract/test.mjs [--verbose]
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-fe-contract");
const SKILL = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "SKILL.md"), "utf8");

/**
 * Every canon / patterns / design / skills path the document cites.
 * A glob is skipped: `check-*.mjs` names a family, not a file.
 */
const cited = [...new Set(
    (SKILL.match(/(?:canon|patterns|design|skills)\/[A-Za-z0-9._/-]+/g) ?? [])
        .map((p) => p.replace(/[.,;:)]+$/, ""))
        .filter((p) => !p.includes("*")),
)];

const broken = cited.filter((p) => !existsSync(join(REPO, p)));

t.expect(
    "every canon, runner, gate and sibling-skill path it cites still exists — a moved reference fails here",
    {
        code: broken.length ? 1 : 0,
        out: broken.length
            ? `broken references: ${broken.join(", ")}`
            : `${cited.length} cited paths resolve under the canon root`,
    },
    { exit: 0, has: ["cited paths resolve"] },
);

// The gates read `process.cwd()`, so this skill is the one place a wrong root produces a
// confident clean report. A path written into the document would be that wrong root on every
// machine but one.
const machinePaths = [
    /[A-Za-z]:[\\/][^\s`)]*[Rr]epositories/,
    /\/[a-z]\/[Rr]epositories/,
    /[A-Za-z]:\\/,
].filter((re) => re.test(SKILL)).map(String);

t.expect(
    "it names no machine path — the roots are resolved through the workspace context instead",
    {
        code: machinePaths.length ? 1 : 0,
        out: machinePaths.length
            ? `hardcoded path matched: ${machinePaths.join(" ")}`
            : "no machine path appears in the document",
    },
    { exit: 0, has: ["no machine path"] },
);

t.expect(
    "the founding invariant is still stated in words, so a red run is read as a disagreement",
    { code: 0, out: SKILL },
    { has: ["a red result is a seam that declares a principle and\ncomputes to the wrong pixel"] },
);

t.finish();
