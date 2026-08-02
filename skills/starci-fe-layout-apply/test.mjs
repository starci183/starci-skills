#!/usr/bin/env node
/**
 * Tests for starci-fe-layout-apply.
 *
 * Each case is named as the CLAIM the skill makes, so a failing run reads as a promise broken
 * rather than as "test 3 failed".
 *
 * This skill ships no script. What it ships is a document that points outward — at canon, at the
 * gates, at the rendered-tree runner — and the whole value of pointing outward is lost the moment
 * a reference points at nothing. So the suite reads SKILL.md and checks three things about it:
 * that every path it cites still resolves, that it names no machine, and that the sentence the
 * whole build order rests on is still in it.
 *
 * What it cannot test: whether an agent holding this skill actually authors a missing component in
 * the design system before composing the page, instead of inlining it. That is the behaviour the
 * skill exists to produce and it needs an eval — see README.md.
 *
 *   node .claude/skills/starci-fe-layout-apply/test.mjs [--verbose]
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-fe-layout-apply");

const SKILL = join(REPO, "skills", "starci-fe-layout-apply", "SKILL.md");
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
const cited = [...text.matchAll(/(?:canon|patterns|design|skills)\/[A-Za-z0-9_.*\/-]+/g)]
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
    "the skill cites canon, the gates and the runner rather than restating them",
    check(`cited ${cited.length} paths`, cited.length >= 12),
    { exit: 0 },
);

// A rule that moves has to fail here. A document that keeps sending a builder to a gate that was
// renamed is worse than one that says nothing, because the builder trusts it first.
t.expect(
    "no reference points at a file that has moved or been deleted",
    check(missing.length ? `unresolved:\n  ${missing.join("\n  ")}` : "all resolve", !missing.length),
    { exit: 0, lacks: ["unresolved"] },
);

t.expect(
    "the three gates that guard storybook-first are each named, not summarised",
    check("gates", [
        "patterns/fe/gates/check-story-coverage.mjs",
        "patterns/fe/gates/check-doc-parity.mjs",
        "patterns/fe/gates/check-src-sb-import.mjs",
        "patterns/fe/runner/test-runner.ts",
    ].every((g) => text.includes(g))),
    { exit: 0 },
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

// The whole build order — back end, then components in the design system, then the surfaces —
// exists to keep this one sentence true under time pressure. Remove it and step 4b is just a
// preference about where files go.
const INVARIANT =
    "No component reaches the app that was never a component and a story in the design-system folder first.";

t.expect(
    "storybook-first is stated in canon's own words, so the two cannot drift apart",
    check(flat.includes(INVARIANT) ? "present" : `missing: ${INVARIANT}`, flat.includes(INVARIANT)),
    { exit: 0, lacks: ["missing:"] },
);

// The quote above is only worth anything while canon still says it. If canon rewords the rule,
// this fails and forces the skill to be re-read against it rather than quietly quoting history.
const canon = readFileSync(join(REPO, "canon", "fe", "enforce", "tiers", "architecture.md"), "utf8").replace(/\s+/g, " ");

t.expect(
    "canon still states the invariant this skill quotes it from",
    check(canon.includes(INVARIANT) ? "present" : "canon/fe/enforce/tiers/architecture.md no longer says it",
        canon.includes(INVARIANT)),
    { exit: 0, lacks: ["no longer"] },
);

t.expect(
    "the boundary holds: a design that turns out wrong goes back to the brainstorm phase",
    check("boundary", text.includes("starci-fe-layout-brainstorm") && /does not redesign/i.test(text)),
    { exit: 0 },
);

t.finish();
