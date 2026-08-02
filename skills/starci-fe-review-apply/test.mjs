#!/usr/bin/env node
/**
 * Tests for starci-fe-review-apply.
 *
 * This skill owns no script, so there is no behaviour to run — what can rot is the DOCUMENT: a
 * canon file it points at gets moved, a machine path creeps back in, or the sentence that keeps
 * the adjustment lane bounded gets edited away in a tidy-up. Each case below is named as the
 * claim it defends, so a failing run reads as a promise broken rather than as "test 2 failed".
 *
 * What it cannot test: whether an agent holding this skill refuses a finding that is not in the
 * proposal, or drops a tier instead of putting a class on a block. Those are behaviour questions
 * and need an eval — see README.md.
 *
 *   node .claude/skills/starci-fe-review-apply/test.mjs [--verbose]
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-fe-review-apply");
const text = readFileSync(join(REPO, "skills", "starci-fe-review-apply", "SKILL.md"), "utf8");

/** Every in-repo reference the document makes, trailing sentence punctuation removed. */
const cited = [...new Set(
    (text.match(/(?:canon|patterns|design|skills|scripts)\/[A-Za-z0-9._/-]+/g) ?? [])
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
    "the scan half it reads from is named as a real sibling, not as folklore",
    { code: 0, out: existsSync(join(REPO, "skills", "starci-fe-review-scan")) ? "sibling present" : "sibling absent" },
    { has: ["sibling present"] },
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
// The adjustment lane only stays safe while every change through it is named, reasoned and
// verified. Lose that sentence and this becomes a general-purpose editor.

t.group("the sentence the skill is built on");

t.expect(
    "one named piece, one stated reason, verified where it was built — stated in the body",
    { code: 0, out: text },
    { has: ["the unit of work is one named piece, with one stated reason, verified where it was built"] },
);

t.expect(
    "and the Storybook-first law is still the thing that bounds what may be fixed here",
    { code: 0, out: text },
    { has: ["No component reaches the app that was never a component and a story in the design-system folder first"] },
);

// ---- the conversion axis is folded in, not bolted on ---------------------
// This skill absorbed starci-fe-cta-and-link-apply's territory: the three routes a finding can
// take, and the conversion-specific fixes (outcome copy, a demoted primary, a wired-up reference
// link, a deleted fallback number). If those quietly disappear, this half silently drops back to
// three axes without anyone deciding that.

t.group("the conversion axis is really in here, not just in the name");

t.expect(
    "the three routes a finding can take are all still named",
    { code: 0, out: text },
    { has: ["Routed to the layout lane", "Built in the design system first"] },
);

t.expect(
    "a conversion fix is spelled out on its own terms, same as the other three axes",
    { code: 0, out: text },
    { has: ["*Conversion*"] },
);

t.expect(
    "and it resolves the back end too, since a routed-or-dropped conversion finding is checked against the schema",
    { code: 0, out: text },
    { has: ["read-workspace-context.mjs be.path"] },
);

t.finish();
