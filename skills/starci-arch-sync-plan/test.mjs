#!/usr/bin/env node
/**
 * Tests for starci-arch-sync-plan.
 *
 * Each case is named as the CLAIM the skill makes, so a failing run reads as a promise broken
 * rather than as "test 4 failed".
 *
 * This skill owns no script - it is a procedure over another repository - so there is nothing to
 * run in a sandbox. What can still rot without anybody touching this folder is its references:
 * the canon shelves and its sibling apply get renamed, and a skill pointing at a file that is gone
 * teaches its reader that none of its references can be trusted.
 *
 * The rest of the cases guard the two lessons this skill exists to carry. They are the ones a
 * rewrite would quietly drop, because both read as throat-clearing until the day they are needed:
 * that a grep is not a measurement, and that a green build is not evidence a provider still
 * resolves.
 *
 * What it cannot test: whether an agent holding this skill reaches for it before starting to edit
 * a target repository. That needs an eval - see README.md.
 *
 *   node .claude/skills/starci-arch-sync-plan/test.mjs [--verbose]
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-arch-sync-plan");
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
    // A moved file must fail here. That is the entire point of the case: the reference reads as
    // authoritative long after the thing it names has gone.
    t.expect(`a reader following ${path} finds a file`,
        said(existsSync(join(REPO, path)), join(REPO, path)), { exit: 0 });
}

t.expect("both canon entry points are named, so the skill works for a back end and a front end",
    said(prose.includes("canon/be/INDEX.md") && prose.includes("canon/fe/README.md"),
        "canon/be/INDEX.md + canon/fe/README.md"), { exit: 0 });

// ---------------------------------------------------------------------
t.group("it names no machine, and no single target");

// A path written into a document is true on exactly one machine, and the failure looks like
// success: files open, greps return, conclusions get drawn from the wrong tree.
const DRIVE_LETTER = /(?:^|[^A-Za-z])[A-Za-z]:[\\/]/;
const POSIX_MOUNT = /\/[a-z]\/Repositories\b/;

t.expect("no drive-letter path is baked into the skill",
    said(!DRIVE_LETTER.test(skill), skill.match(DRIVE_LETTER)?.[0] ?? "none"), { exit: 0 });
t.expect("no mounted-drive path is baked into the skill either",
    said(!POSIX_MOUNT.test(skill), skill.match(POSIX_MOUNT)?.[0] ?? "none"), { exit: 0 });

// The skill was asked for as a general lane, not a one-off. A target named in the body - rather
// than in the description's trigger phrases, where an example belongs - is how a general skill
// silently becomes a specific one.
const body = skill.slice(skill.indexOf("\n---\n", 4) + 5);
t.expect("no target repository is hard-coded in the body",
    said(!/\bnivo\b/i.test(body), body.match(/\bnivo\b/i)?.[0] ?? "none"), { exit: 0 });

// ---------------------------------------------------------------------
t.group("the founding invariant is stated, not implied");

// The whole reason this half exists separately from the apply: it measures and sequences, and
// leaves the edit alone, so the promise is made in words a reader can quote back.
const INVARIANT = "The plan writes a proposal and changes no source file in the target.";

t.expect("the skill says in words that it changes no source file in the target",
    said(skill.includes(INVARIANT), INVARIANT), { exit: 0 });

t.expect("it hands the execution to the apply half by name",
    said(prose.includes("starci-arch-sync-apply"), "names starci-arch-sync-apply"), { exit: 0 });

// ---------------------------------------------------------------------
t.group("the two lessons that cost a session to learn are still written down");

// Measured, not estimated. Dropping this sentence turns the skill back into "grep and plan",
// which is what produced a debt figure twenty-five times too high.
t.expect("it says the rule does the counting, not a grep",
    said(/write the rule first/i.test(prose) && /let the rule count/i.test(prose),
        "rule-first measurement stated"), { exit: 0 });

t.expect("it keeps the concrete number that proves the estimate cannot be trusted",
    said(prose.includes("426") && prose.includes("17"), "426 vs 17 retained"), { exit: 0 });

// A build proving names resolve is not a build proving the container starts. This is the class of
// failure that no compiler sees, and the sentence is the only thing standing between a reader and
// a green build they will believe.
t.expect("it warns that a build cannot see a provider that stopped resolving",
    said(/cannot see a provider that stopped resolving/i.test(prose),
        "runtime-resolution warning present"), { exit: 0 });

t.expect("it separates the pile that is blocked on a decision from the pile that is mechanical",
    said(/Blocked on a decision/.test(prose) && /Mechanical burn-down/.test(prose),
        "three piles named"), { exit: 0 });

t.expect("it says a rule punishing correct code is the rule's defect",
    said(/the rule is the defect/i.test(prose), "rule-is-the-defect stated"), { exit: 0 });

// ---------------------------------------------------------------------
t.group("the house voice holds");

const GLYPHS = /[✅❌✔✖✗✘\u{1F300}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}]/u;
t.expect("no tick, cross, arrow or emoji stands in for a judgement written out",
    said(!GLYPHS.test(skill), skill.match(GLYPHS)?.[0] ?? "none"), { exit: 0 });
t.expect("the frontmatter carries exactly the two keys a skill declares, name first",
    said(/^---\nname: starci-arch-sync-plan\ndescription: [^\n]+\n---\n/.test(skill), skill.slice(0, 60)), { exit: 0 });

t.finish();
