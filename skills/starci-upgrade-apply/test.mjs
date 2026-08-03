#!/usr/bin/env node
/**
 * Tests for starci-upgrade-apply.
 *
 * This skill owns no script — it is a procedure over the pending corrections and the skills — so what
 * there is to test is the document. The claims: every path it cites resolves (a moved folder fails here,
 * not in front of a user); no machine path is written into it; the founding invariant — that it edits
 * the skill, not the output — is stated in words; and it names both ends of the trail it carries, the
 * pending folder it reads from and the applied folder it moves each correction into.
 *
 *   node .claude/skills/starci-upgrade-apply/test.mjs [--verbose]
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-upgrade-apply");
const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = readFileSync(join(HERE, "SKILL.md"), "utf8");

const cited = [...new Set(
    (SKILL.match(/\b(?:skills|scripts|canon)\/[A-Za-z0-9._/-]+/g) ?? []).map((p) => p.replace(/[.,;:)\]]+$/, "")),
)].sort();
const missing = cited.filter((p) => !existsSync(join(REPO, p)));

t.expect(
    "every skills/scripts/canon path the skill cites resolves — a moved folder fails here, not at a user",
    { code: missing.length ? 1 : 0, out: missing.length ? `missing: ${missing.join(", ")}` : `checked ${cited.length}` },
    { exit: 0 },
);

const hardcoded = [...SKILL.matchAll(/([A-Za-z]:[\\/][^\s`)]*Repositories|\/[a-z]\/Repositories)/g)].map((m) => m[0]);
t.expect(
    "no machine path is written into the skill",
    { code: hardcoded.length ? 1 : 0, out: hardcoded.length ? hardcoded.join(", ") : "none" },
    { exit: 0 },
);

t.expect(
    "the founding invariant — it edits the skill, not the output — is stated",
    { code: /fold(s|ed)?[^.]*into the skill|edits the skill/i.test(SKILL) ? 0 : 1, out: "" },
    { exit: 0 },
);

t.expect(
    "it names the pending folder it reads and the applied folder it moves each correction into",
    { code: SKILL.includes("corrections/pending") && SKILL.includes("corrections/applied") ? 0 : 1, out: "" },
    { exit: 0 },
);

t.expect(
    "it names its plan half, the source of the folds it lands",
    { code: SKILL.includes("starci-upgrade-plan") ? 0 : 1, out: "" },
    { exit: 0 },
);

t.finish();
