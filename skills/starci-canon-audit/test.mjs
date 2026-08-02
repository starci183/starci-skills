#!/usr/bin/env node
/**
 * Tests for starci-canon-audit.
 *
 * Each case is named as the CLAIM the skill makes, so a failing run reads as a promise broken
 * rather than as "test 7 failed".
 *
 * This skill has no script of its own — it is a procedure and a set of pointers. So the suite
 * reads `SKILL.md` itself and checks the three things that rot without anyone touching this
 * folder: a cited file moves, a machine path creeps back in, an edit softens the invariant the
 * whole procedure rests on.
 *
 * Nothing here writes to disk and nothing consults the workspace registry, so it runs on a
 * machine that has never been set up.
 *
 * What it cannot test: whether an agent holding this skill runs the mechanical pass before
 * reading, and stops at a report instead of starting to fix. That needs an eval — see README.md.
 *
 *   node .claude/skills/starci-canon-audit/test.mjs [--verbose]
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-canon-audit");

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = readFileSync(join(HERE, "SKILL.md"), "utf8");

// ---- every citation still resolves ---------------------------------------

t.group("the pointers still point somewhere");

/**
 * Every path into the skill set that the document names.
 * `.claude/` is optional because a runnable command is written the way it is typed, while a
 * reference in prose is written relative to the skill-set root. Both mean the same file.
 */
const CITED = /(?<![\w.-])(?:\.claude\/)?(?:canon|patterns|design|skills|scripts)\/[\w./*-]+/g;

const cited = [...new Set(
    [...SKILL.matchAll(CITED)]
        .map((m) => m[0].replace(/^\.claude\//, "").replace(/[.,;:)]+$/, ""))
)];

/**
 * Does this citation resolve under the skill-set root?
 * A citation containing `*` names a family rather than a file — `scripts/gates/check-*.mjs`
 * is a true statement about a folder, so the folder is what gets checked.
 */
const resolves = (rel) => {
    const target = rel.includes("*") ? rel.slice(0, rel.indexOf("*")).replace(/\/$/, "") : rel;
    return existsSync(join(REPO, target));
};

const missing = cited.filter((p) => !resolves(p));

t.expect(
    "every canon, patterns, design and skills path the skill cites resolves — a reference that moved fails here",
    {
        // A regex that has stopped matching would pass this case vacuously, which is the one way
        // a citation check can lie. No citations at all is therefore a failure too.
        code: missing.length || !cited.length ? 1 : 0,
        out: cited.length
            ? `${cited.length} cited paths checked\n${missing.map((p) => `MISSING  ${p}`).join("\n")}`
            : "no citations matched at all — the extractor, not the document, is what broke",
    },
    { exit: 0, has: ["cited paths checked"] },
);

// ---- no machine paths -----------------------------------------------------

t.group("nothing that is true on only one machine");

// A path written into a document is right on the machine it was written on and silently wrong on
// the next: files open, greps return, and conclusions get drawn from the wrong tree. Every path
// in this skill goes through `read-workspace-context.mjs` instead.
const MACHINE_PATHS = [
    /[A-Za-z]:[\\/]+Repositories/,      // C:\Repositories\… or D:/Repositories/…
    /(?:^|[\s"'`(])\/[a-z]\/Repositories/i,  // /d/Repositories/… as a shell writes it
    /(?:^|[\s"'`(])\/(?:home|Users)\/[\w.-]+\//,   // /home/someone/… · /Users/someone/…
];

const hardcoded = MACHINE_PATHS
    .map((re) => re.exec(SKILL))
    .filter(Boolean)
    .map((m) => m[0].trim());

t.expect(
    "the skill writes down no machine path — the source is resolved through the workspace context",
    {
        code: hardcoded.length ? 1 : 0,
        out: hardcoded.length ? `hardcoded: ${hardcoded.join(" · ")}` : "no machine path in the document",
    },
    { exit: 0, has: ["no machine path"] },
);

t.expect(
    "and it says how the source is resolved instead",
    { code: 0, out: SKILL },
    { has: ["read-workspace-context.mjs", "fe.path", "be.path"] },
);

// ---- the invariant is still stated ---------------------------------------

t.group("the founding invariant, in words");

// If this sentence is ever edited away, the procedure below it still reads fine and the skill
// quietly becomes one that fixes things while it reads — which is the failure it exists to
// prevent. The words are the load-bearing part, so the words are what is asserted.
t.expect(
    "the report-only invariant is stated verbatim, not implied by the ordering of the steps",
    { code: 0, out: SKILL },
    { has: ["An audit that edits while it reads loses the only baseline it had."] },
);

// ---- the retired BE-only pass is folded in, not merely adjacent ----------

t.group("re-grounding canon/be/ reads as this skill's own job, not a separate one");

// This skill absorbed a back-end-only skill that used to audit `canon/be/` alone. If the
// description loses its BE-focused phrasing, or the body's claim that canon/be/ decays the same
// three ways gets edited away, a reader has no way to find out this job lives here now.
t.expect(
    "the description carries BE-focused trigger phrases, not only the FE ones",
    { code: 0, out: SKILL },
    { has: ["is canon/be still true", "check the be rules against the source", "canon be con dung khong"] },
);

t.expect(
    "the body states plainly that canon/be/ needs no separate audit, not just that be.path is read",
    { code: 0, out: SKILL },
    { has: ["Re-grounding `canon/be/` is inside this, not a separate job"] },
);

t.finish();
