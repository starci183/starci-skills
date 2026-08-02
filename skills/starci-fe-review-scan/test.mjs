#!/usr/bin/env node
/**
 * Tests for starci-fe-review-scan.
 *
 * This skill owns no script, so there is no behaviour to run — what can rot is the DOCUMENT: a
 * canon file it points at gets moved, a machine path creeps back in, or the sentence the whole
 * skill is built on gets edited away in a tidy-up. Each case below is named as the claim it
 * defends, so a failing run reads as a promise broken rather than as "test 2 failed".
 *
 * What it cannot test: whether an agent holding this skill actually reads a surface once and
 * grades all three axes, instead of reporting the first thing it noticed. That is a behaviour
 * question and needs an eval — see README.md.
 *
 *   node .claude/skills/starci-fe-review-scan/test.mjs [--verbose]
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-fe-review-scan");
const text = readFileSync(join(REPO, "skills", "starci-fe-review-scan", "SKILL.md"), "utf8");

/** Every in-repo reference the document makes, trailing sentence punctuation removed. */
const cited = [...new Set(
    (text.match(/(?:canon|patterns|design|skills)\/[A-Za-z0-9._/-]+/g) ?? [])
        .map((p) => p.replace(/[.,;:)]+$/, "")),
)];

// ---- the references ------------------------------------------------------
// A moved file is the normal failure in a rule set and it is silent: the prose stays true and
// stops being findable. This is the case that makes the move loud.

t.group("the references point at things that exist");

const missing = cited.filter((p) => !existsSync(join(REPO, p)));

t.expect(
    "every canon, patterns, design and skills path cited resolves in this tree",
    { code: 0, out: missing.length ? `unresolved:\n${missing.join("\n")}` : `${cited.length} cited paths resolve` },
    { lacks: ["unresolved:"] },
);

t.expect(
    "the skill points outward rather than restating canon in its own words",
    { code: 0, out: cited.length >= 8 ? `points outward, ${cited.length} references` : `too few: ${cited.length}` },
    { has: ["points outward"] },
);

// ---- no machine paths ----------------------------------------------------
// A path written into a document is true on exactly one machine. Every source is resolved through
// read-workspace-context.mjs, and this case is what keeps that true after an edit.

t.group("nothing here is true on only one machine");

const driveLetter = text.match(/\b[A-Za-z]:[\\/][A-Za-z0-9._\\/-]+/g) ?? [];
const posixRepos = text.match(/\/[a-z]\/[A-Za-z0-9._-]+/g) ?? [];
const named = text.match(/Repositories/g) ?? [];

t.expect(
    "no drive-letter path is written into the skill",
    { code: 0, out: driveLetter.length ? `hardcoded:\n${driveLetter.join("\n")}` : "none" },
    { lacks: ["hardcoded:"] },
);

t.expect(
    "no posix machine path is written into the skill either",
    { code: 0, out: [...posixRepos, ...named].length ? `hardcoded:\n${[...posixRepos, ...named].join("\n")}` : "none" },
    { lacks: ["hardcoded:"] },
);

t.expect(
    "the source is resolved through the workspace context instead",
    { code: 0, out: text },
    { has: ["read-workspace-context.mjs fe.path"] },
);

// ---- the founding invariant ----------------------------------------------
// Three axes in one pass is not a convenience, it is the reason this skill exists rather than
// three. Lose the sentence and the next editor splits it back into three skills.

t.group("the sentence the skill is built on");

t.expect(
    "one surface, one reading, all three axes — stated in the body, not implied",
    { code: 0, out: text },
    { has: ["one surface is read once and graded on all three axes in that pass"] },
);

t.expect(
    "and the scan half still refuses to change code",
    { code: 0, out: text },
    { has: ["Nothing here changes code"] },
);

t.finish();
