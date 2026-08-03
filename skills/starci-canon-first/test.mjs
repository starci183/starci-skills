#!/usr/bin/env node
/**
 * Tests for starci-canon-first.
 *
 * This skill owns no script — what can rot is the DOCUMENT: a canon file it points at moves, or the
 * "last resort, defer to the specific skill" stance gets edited away, at which point a grounded
 * catch-all quietly becomes a competitor that steals triggers from the real lanes. Each case is
 * named as the promise it defends.
 *
 *   node .claude/skills/starci-canon-first/test.mjs [--verbose]
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-canon-first");
const text = readFileSync(join(REPO, "skills", "starci-canon-first", "SKILL.md"), "utf8");

// ---- the references resolve ----------------------------------------------

t.group("every path it cites exists");

const cited = [...new Set(
    (text.match(/(?:canon|patterns|design|skills|scripts)\/[A-Za-z0-9._/-]+/g) ?? [])
        .map((p) => p.replace(/[.,;:)]+$/, "")),
)];
const missing = cited.filter((p) => !existsSync(join(REPO, p)));

t.expect(
    "every canon, scripts and skills path cited resolves in this tree",
    { code: 0, out: missing.length ? `unresolved:\n${missing.join("\n")}` : `${cited.length} cited paths resolve` },
    { lacks: ["unresolved:"] },
);

// ---- it stays a last resort ----------------------------------------------
// The one thing that makes a catch-all safe is that it defers. If the deferral prose is gone, the
// description will start out-competing the narrow skills and this is the case that catches it.

t.group("it declares itself the last resort, not the first");

t.expect(
    "the document names itself a last resort and defers to the specific skills",
    { code: 0, out: /last resort/i.test(text) && text.includes("starci-fe-review-plan") ? "defers" : "missing the deferral stance" },
    { has: ["defers"] },
);

// ---- frontmatter ---------------------------------------------------------

t.group("the frontmatter is well formed");

const fm = text.split("---")[1] ?? "";
const keys = [...fm.matchAll(/^([a-z]+):/gm)].map((m) => m[1]);

t.expect(
    "the frontmatter carries exactly name and description",
    { code: 0, out: keys.join(",") },
    { has: ["name,description"], lacks: ["\n"] },
);

t.finish();
