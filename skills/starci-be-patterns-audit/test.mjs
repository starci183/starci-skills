#!/usr/bin/env node
/**
 * Tests for starci-be-patterns-audit.
 *
 * This skill has no script of its own — it is a procedure a reader follows — so what is checkable
 * is the document. Each case is named as the CLAIM the skill makes, so a failing run reads as a
 * promise broken rather than as "test 3 failed".
 *
 * The first case matters more here than in most skills. This skill exists to catch a document that
 * points at a file which has moved; a version of it whose own references have rotted would be
 * reporting a failure it is itself committing.
 *
 * What it cannot test: whether an agent holding this skill actually runs `scripts/verify.mjs`
 * first, keeps the state file, and stops at reporting instead of editing. Those need an eval —
 * see README.md.
 *
 *   node .claude/skills/starci-be-patterns-audit/test.mjs [--verbose]
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-be-patterns-audit");
const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = readFileSync(join(HERE, "SKILL.md"), "utf8");

/**
 * Every path into this skill set that the document names.
 * A leading `.claude/` is optional because the body writes commands one way and prose the other,
 * and both are the same reference. A token carrying a glob or an elision is a shape rather than a
 * file — `canon/be/**` describes a folder's worth of prose and points at nothing in particular.
 * @param {string} text
 * @returns {string[]}
 */
function citations(text) {
    const out = new Set();
    for (const m of text.matchAll(/(?<![\w/.-])(?:\.claude\/)?((?:canon|patterns|design|skills|scripts)\/[\w.@/-]+)/g)) {
        const p = m[1].replace(/[:#].*$/, "").replace(/[.,;)]+$/, "");
        if (/[*<>{}]/.test(p)) continue;
        if (/\.{3}|…/.test(p)) continue;
        out.add(p);
    }
    return [...out].sort();
}

// ---- the references it makes -------------------------------------------------

t.group("the canon it points at is still where it says");

const cited = citations(SKILL);
const missing = cited.filter((p) => !existsSync(join(REPO, p)));

t.expect(
    "every canon, patterns and skill path this skill cites resolves — a moved reference fails here",
    {
        code: missing.length ? 1 : 0,
        out: missing.length
            ? `these are named in SKILL.md and do not exist:\n  ${missing.join("\n  ")}`
            : `all ${cited.length} references resolve`,
    },
    { exit: 0, has: ["references resolve"] },
);

t.expect(
    "the skill points outward rather than restating — it names the canon files it audits",
    { code: 0, out: `${cited.length} cited: ${cited.join(" ")}` },
    { has: ["canon/be/INDEX.md", "canon/HOW-TO-WRITE.md", "scripts/verify.mjs"] },
);

// ---- what it must never contain ----------------------------------------------

t.group("nothing in it is true on only one machine");

// The habit this whole skill set exists to end: a path written into a document answers correctly
// on the machine it was written on and silently wrongly on the next.
const hardcoded = [
    ...SKILL.matchAll(/[A-Za-z]:[\\/](?:Repositories|Users|home)[\\/][\w.\\/-]*/g),
    ...SKILL.matchAll(/(?<![\w.-])\/(?:[a-z]|home|Users)\/Repositories\/[\w./-]*/g),
].map((m) => m[0]);

t.expect(
    "the skill names no machine path — the backend is resolved through the workspace context",
    {
        code: hardcoded.length ? 1 : 0,
        out: hardcoded.length
            ? `hardcoded in SKILL.md:\n  ${hardcoded.join("\n  ")}`
            : "no machine path is written down",
    },
    { exit: 0, has: ["no machine path"] },
);

// ---- the invariant it rests on -----------------------------------------------

t.group("the founding invariant is written down, not implied");

// Every finding this skill produces is classified by this one sentence. Lose it and the skill
// reads as a licence to edit ten modules until they agree with one stale paragraph.
//
// Line wrapping is collapsed before matching. The sentence is the invariant; where the 100th
// column happens to fall in it is not, and a case that goes red on a re-wrap teaches an editor to
// stop re-wrapping rather than to keep the promise.
const prose = SKILL.replace(/\s+/g, " ");

t.expect(
    "the direction of authority is stated in words: the source wins and the rule is re-grounded",
    { code: 0, out: prose },
    { has: ["When a rule and the source disagree, the source wins and the rule is what gets re-grounded."] },
);

t.finish();
