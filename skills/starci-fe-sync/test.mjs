#!/usr/bin/env node
/**
 * Tests for starci-fe-sync.
 *
 * This skill owns no script — it is a procedure over two trees whose paths differ on every
 * machine — so what there is to test is the document itself. Each case is named as the CLAIM
 * the skill makes, so a failing run reads as a promise broken rather than as "test 3 failed".
 *
 * Three claims:
 *   1. every canon / patterns / design / skills path it cites still resolves, so a file that
 *      moves fails here instead of sending a reader to nothing;
 *   2. no machine path was written into it, because a path in a document is true on exactly
 *      one machine and wrong in silence everywhere else;
 *   3. the founding invariant is still stated in words, not implied by a heading.
 *
 * What it cannot test: whether an agent reaches for this skill at the right moment. That is a
 * property of the frontmatter description and needs an eval — see README.md.
 *
 *   node .claude/skills/starci-fe-sync/test.mjs [--verbose]
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-fe-sync");

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = readFileSync(join(HERE, "SKILL.md"), "utf8");

// ---- 1. every cited path resolves ------------------------------------------

t.group("what it points at is still there");

// Paths are cited relative to the skill-set root, with or without a `.claude/` prefix in the
// prose around them. Trailing sentence punctuation is stripped so `…/architecture.md.` at the
// end of a sentence is not read as a filename nobody has.
const cited = [...new Set(
    (SKILL.match(/\b(?:canon|patterns|design|skills|scripts)\/[A-Za-z0-9._/-]+/g) ?? [])
        .map((p) => p.replace(/[.,;:)\]]+$/, "")),
)].sort();

const missing = cited.filter((p) => !existsSync(join(REPO, p)));

t.expect(
    "every canon, pattern, design and skill path cited in SKILL.md resolves under the skill set",
    { code: missing.length ? 1 : 0, out: missing.length ? `missing:\n  ${missing.join("\n  ")}` : "all resolve" },
    { exit: 0, has: ["all resolve"] },
);

t.expect(
    "it cites outward rather than restating — the architecture, the split, and the import gate by path",
    { code: 0, out: cited.join("\n") },
    {
        has: [
            "canon/fe/enforce/tiers/architecture.md",
            "canon/fe/enforce/tiers/split.md",
            "scripts/gates/check-src-sb-import.mjs",
        ],
    },
);

// ---- 2. no machine path ----------------------------------------------------

t.group("nothing in it is true on only one machine");

// A drive-letter checkout (`D:\Repositories\…`, `C:/Repositories/…`) or its posix-shell spelling
// (`/d/Repositories/…`). Either one is a path that silently reads the wrong tree elsewhere.
const hardcoded = SKILL.split("\n")
    .map((line, i) => ({ line: i + 1, text: line }))
    .filter(({ text }) => /[A-Za-z]:[\\/](?:Repositories|Users)/i.test(text) || /\/[a-z]\/Repositories\//i.test(text));

t.expect(
    "no drive-letter or posix machine path is written into SKILL.md — both roots are resolved by command",
    {
        code: hardcoded.length ? 1 : 0,
        out: hardcoded.length
            ? hardcoded.map(({ line, text }) => `${line}: ${text.trim()}`).join("\n")
            : "no machine path",
    },
    { exit: 0, has: ["no machine path"] },
);

t.expect(
    "the roots are asked for, by the one command that answers per machine",
    { code: 0, out: SKILL },
    { has: ["read-workspace-context.mjs fe.path", "read-workspace-context.mjs fe.design_system"] },
);

// ---- 3. the founding invariant is stated in words --------------------------

t.group("the invariant it exists to hold");

t.expect(
    "storybook-first is stated outright, not left to be inferred from a heading",
    { code: 0, out: SKILL },
    { has: ["No component reaches the app that was never a component and a story in the design-system folder\nfirst."] },
);

t.expect(
    "the import boundary is stated as a sentence a reader can quote back",
    { code: 0, out: SKILL },
    { has: ["App code imports `@/components/*`. It never imports `@sb-components/*`."] },
);

t.expect(
    "the judgements are written in words — no tick, cross, or checkbox glyphs",
    { code: 0, out: SKILL },
    { lacks: ["✅", "❌", "⚠️", "- [ ]", "- [x]"] },
);

t.finish();
