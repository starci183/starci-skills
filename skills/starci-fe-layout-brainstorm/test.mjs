#!/usr/bin/env node
/**
 * Tests for starci-fe-layout-brainstorm.
 *
 * Each case is named as the CLAIM the skill makes, so a failing run reads as a promise broken
 * rather than as "test 3 failed".
 *
 * This skill ships no script. What it ships is a document that points outward — at canon, at the
 * gates, at the design material — and the whole value of pointing outward is lost the moment a
 * reference points at nothing. So the suite reads SKILL.md and checks three things about it:
 * that every path it cites still resolves, that it names no machine, and that the sentence the
 * rest of the document leans on is still in it.
 *
 * What it cannot test: whether an agent holding this skill actually enumerates a flow's surfaces
 * before designing one of them. That is a property of the frontmatter description and needs an
 * eval — see README.md.
 *
 *   node .claude/skills/starci-fe-layout-brainstorm/test.mjs [--verbose]
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-fe-layout-brainstorm");

const SKILL = join(REPO, "skills", "starci-fe-layout-brainstorm", "SKILL.md");
const text = readFileSync(SKILL, "utf8");

/** Markdown wraps prose at will, so a quoted sentence is compared with its whitespace flattened. */
const flat = text.replace(/\s+/g, " ");

/** A result the harness can grade, built from a check that runs in this process. */
const check = (out, ok) => ({ code: ok ? 0 : 1, out });

// ---- every reference resolves --------------------------------------------

t.group("every path it cites still resolves");

/**
 * Citations to the four trees this skill set owns. Paths into the front-end app are deliberately
 * not matched: they live on a machine this suite knows nothing about, which is why they are
 * written as `<fe.path>/...` rather than as a path at all.
 */
const cited = [...text.matchAll(/(?:canon|patterns|design|skills|scripts)\/[A-Za-z0-9_.*\/-]+/g)]
    .map((m) => m[0].replace(/[.,;:)]+$/, ""))
    .filter((p, i, all) => all.indexOf(p) === i);

/** A cited glob resolves when its folder holds at least one file matching it. */
const resolves = (p) => {
    if (!p.includes("*")) return existsSync(join(REPO, p));
    const dir = join(REPO, dirname(p));
    if (!existsSync(dir)) return false;
    const rx = new RegExp(`^${basename(p).replace(/[.]/g, "\\.").replace(/\*/g, ".*")}$`);
    return readdirSync(dir).some((f) => rx.test(f));
};

const missing = cited.filter((p) => !resolves(p));

t.expect(
    "the skill cites canon, patterns and design rather than restating them",
    check(`cited ${cited.length} paths`, cited.length >= 8),
    { exit: 0 },
);

// A rule that moves has to fail here. A document that keeps sending a reader to a file that was
// renamed is worse than one that says nothing, because the reader trusts it first.
t.expect(
    "no reference points at a file that has moved or been deleted",
    check(missing.length ? `unresolved:\n  ${missing.join("\n  ")}` : "all resolve", !missing.length),
    { exit: 0, lacks: ["unresolved"] },
);

// ---- no machine is named -------------------------------------------------

t.group("it names no machine");

// The source skill this was ported from hardcoded one checkout, and the failure looked like
// success: files opened, greps returned, and the conclusions came from the wrong tree.
const hardcoded = [
    [/\b[A-Za-z]:\\/, "a Windows drive path"],
    [/\b[A-Za-z]:\/(?!\/)/, "a drive-letter path with forward slashes"],
    [/\/[A-Za-z]\/Repositories\//, "an msys-style drive path"],
    [/Repositories[\\/]starci/i, "a checkout folder by name"],
].filter(([rx]) => rx.test(text));

t.expect(
    "no machine path is written into the skill — every root is resolved through the workspace context",
    check(hardcoded.length ? `found ${hardcoded.map(([, w]) => w).join(", ")}` : "clean", !hardcoded.length),
    { exit: 0, lacks: ["found "] },
);

t.expect(
    "the front end, its design system and the back end are all asked for by key",
    check("keys", ["fe.path", "fe.design_system", "be.path"].every((k) => text.includes(k))),
    { exit: 0 },
);

// ---- the founding invariant is still stated ------------------------------

t.group("the founding invariant is still stated");

// Everything downstream rests on this sentence: the job sentence in step 2a, the shell choice,
// the self-check, and the proposal's "job -> shell" column. Delete it and the procedure becomes
// a list of steps with no reason under them.
const INVARIANT = "A surface's shell follows the job it exists to do, not the data it happens to carry.";

t.expect(
    "the shell follows the job, not the data — stated in the words the rest of the skill leans on",
    check(flat.includes(INVARIANT) ? "present" : `missing: ${INVARIANT}`, flat.includes(INVARIANT)),
    { exit: 0, lacks: ["missing:"] },
);

t.expect(
    "the boundary holds: this skill designs and stops, and names the skill that builds",
    check("boundary", text.includes("starci-fe-layout-apply") && /does not build/i.test(text)),
    { exit: 0 },
);

// ---- the composition audit's method is folded in, not a separate pass ---

t.group("the volume-to-arrangement fold is stated");

// This is what step 3 absorbed: a region count is derived from a real record count, never chosen
// by eye, and the candidates are drawn rather than argued about in prose.
const VOLUME_INVARIANT = "That count decides how many regions there are and which of them shrinks";

t.expect(
    "a region count is derived from the data layer, not chosen by eye — stated in these words",
    check(flat.includes(VOLUME_INVARIANT) ? "present" : `missing: ${VOLUME_INVARIANT}`, flat.includes(VOLUME_INVARIANT)),
    { exit: 0, lacks: ["missing:"] },
);

t.expect(
    "three or four candidate arrangements are drawn as widgets before one is picked",
    check("widgets", /three or four workable arrangements/i.test(text) && /as widgets/.test(text)),
    { exit: 0 },
);

// ---- the block-matrix lookup is folded in here, not deferred to a separate lane ----

t.group("which component a shape becomes is a lookup here, not a separate skill");

t.expect(
    "the component matrix and its search script are both named",
    check("lookup", text.includes("matrix.csv") && text.includes("search-component-matrix.mjs")),
    { exit: 0 },
);

// The two audit skills this document absorbed are meant to be deleted once the fold lands. A
// reference surviving here would dangle the moment they are gone, which is exactly the silent
// failure this whole set is built to catch.
const danglingRefs = ["story-audit-composition", "story-audit-block"].filter((name) => text.includes(name));

t.expect(
    "no reference remains to the two audit skills this document absorbed",
    check(danglingRefs.length ? `found: ${danglingRefs.join(", ")}` : "clean", danglingRefs.length === 0),
    { exit: 0, lacks: ["found:"] },
);

t.finish();
