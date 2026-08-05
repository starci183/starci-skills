#!/usr/bin/env node
/**
 * Tests for starci-arch-sync-apply.
 *
 * Each case is named as the CLAIM the skill makes, so a failing run reads as a promise broken
 * rather than as "test 4 failed".
 *
 * This skill owns no script - it is a procedure over another repository - so there is nothing to
 * run in a sandbox. What can rot on its own is its references, and what a rewrite would quietly
 * drop are the four disciplines that make a migration reconstructable afterwards: one rule per
 * commit, no rule at error while debt exists, report only numbers actually seen, and know that a
 * build cannot see a container that will not start.
 *
 * What it cannot test: whether an agent holding this skill stops when the ground has moved
 * instead of improvising a new sequence. That needs an eval - see README.md.
 *
 *   node .claude/skills/starci-arch-sync-apply/test.mjs [--verbose]
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-arch-sync-apply");
const HERE = dirname(fileURLToPath(import.meta.url));
const skill = readFileSync(join(HERE, "SKILL.md"), "utf8");

/** A plain result, for a claim decided by reading rather than by running. */
const said = (ok, out) => ({ code: ok ? 0 : 1, out });

/**
 * The skill with every run of whitespace collapsed to one space.
 *
 * Prose claims are asserted against THIS, never against the raw file. A sentence that reads as one
 * thought is wrapped across two lines in the source, so a regex over the raw text passes or fails
 * on where the author happened to break the line - which makes the test report a rewrap as a
 * broken promise, and lets a genuinely deleted sentence slip through whenever the wrap moves.
 */
const prose = skill.replace(/\s+/g, " ");

// ---------------------------------------------------------------------
t.group("it points outward, and every pointer still lands");

const CITATION = /(?:\.claude\/)?((?:canon|patterns|design|skills|scripts)\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\.(?:md|mjs|ts|tsx|csv|json))/g;
const cited = [...new Set([...skill.matchAll(CITATION)].map((m) => m[1]))].sort();

t.expect("the skill cites the canon it reads and its sibling instead of restating them",
    said(cited.length >= 4, `${cited.length} reference(s): ${cited.join(", ")}`), { exit: 0 });

for (const path of cited) {
    t.expect(`a reader following ${path} finds a file`,
        said(existsSync(join(REPO, path)), join(REPO, path)), { exit: 0 });
}

t.expect("it hands a finding back to the planning half by name",
    said(prose.includes("starci-arch-sync-plan"), "names starci-arch-sync-plan"), { exit: 0 });

// ---------------------------------------------------------------------
t.group("it names no machine, and no single target");

const DRIVE_LETTER = /(?:^|[^A-Za-z])[A-Za-z]:[\\/]/;
const POSIX_MOUNT = /\/[a-z]\/Repositories\b/;

t.expect("no drive-letter path is baked into the skill",
    said(!DRIVE_LETTER.test(skill), skill.match(DRIVE_LETTER)?.[0] ?? "none"), { exit: 0 });
t.expect("no mounted-drive path is baked into the skill either",
    said(!POSIX_MOUNT.test(skill), skill.match(POSIX_MOUNT)?.[0] ?? "none"), { exit: 0 });

const body = skill.slice(skill.indexOf("\n---\n", 4) + 5);
t.expect("no target repository is hard-coded in the body",
    said(!/\bnivo\b/i.test(body), body.match(/\bnivo\b/i)?.[0] ?? "none"), { exit: 0 });

// The branch a target lands on is the target's business. A skill that assumes the branch of the
// repository it happens to live in will push work onto the wrong one.
t.expect("it refuses to assume the target's branch",
    said(/never assumed from the repository this skill lives in/i.test(prose),
        "branch-not-assumed stated"), { exit: 0 });

// ---------------------------------------------------------------------
t.group("the founding invariant is stated, not implied");

const INVARIANT = "**One rule per commit.**";

t.expect("the skill says in words that each rule lands in its own commit",
    said(skill.includes(INVARIANT), INVARIANT), { exit: 0 });

t.expect("it says a rule reaches error only at zero debt",
    said(/flip the rule to `error`/i.test(prose) && /At zero/i.test(prose),
        "error-only-at-zero stated"), { exit: 0 });

t.expect("it explains why a rule at error with debt is worse than useless",
    said(/blocks every commit/i.test(prose), "blocking explained"), { exit: 0 });

// ---------------------------------------------------------------------
t.group("the disciplines that make the migration reconstructable survive");

// The single most common way a migration produces a green report and a broken repository.
t.expect("it warns that a build cannot see a provider that stopped resolving",
    said(/cannot see a provider that stopped resolving/i.test(prose),
        "runtime-resolution warning present"), { exit: 0 });

t.expect("it forbids copying a predicted number into a report",
    said(/fabricated measurement/i.test(prose), "fabricated-measurement stated"), { exit: 0 });

t.expect("it forbids weakening the rule to satisfy the code",
    said(/do not weaken the rule to satisfy the code/i.test(prose),
        "no-weakening stated"), { exit: 0 });

t.expect("it requires the comments describing removed wiring to be fixed in the same commit",
    said(/Comments are part of the change/.test(prose), "comment upkeep stated"), { exit: 0 });

t.expect("it names the conditions under which it stops rather than improvises",
    said(/When to stop and hand back/.test(prose), "stop conditions named"), { exit: 0 });

// ---------------------------------------------------------------------
t.group("the house voice holds");

const GLYPHS = /[✅❌✔✖✗✘\u{1F300}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}]/u;
t.expect("no tick, cross, arrow or emoji stands in for a judgement written out",
    said(!GLYPHS.test(skill), skill.match(GLYPHS)?.[0] ?? "none"), { exit: 0 });
t.expect("the frontmatter carries exactly the two keys a skill declares, name first",
    said(/^---\nname: starci-arch-sync-apply\ndescription: [^\n]+\n---\n/.test(skill), skill.slice(0, 60)), { exit: 0 });

t.finish();
