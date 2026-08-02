#!/usr/bin/env node
/**
 * Tests for starci-fe-story-audit-composition.
 *
 * WHAT IS BEING TESTED
 * Not the judgement — no script can decide whether a volume of data really forces the
 * arrangement this lane would draw. What a script can decide is whether the document is still
 * usable: whether every file it sends a reader to is still there, whether it has quietly
 * acquired a path that only works on one machine, and whether the sentence the whole lane
 * hangs from is still in it.
 *
 * Each case is named as the CLAIM the skill makes, so a failing run reads as a promise broken
 * rather than as "test 7 failed".
 *
 *   node .claude/skills/starci-fe-story-audit-composition/test.mjs [--verbose]
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-fe-story-audit-composition");

const HERE = dirname(fileURLToPath(import.meta.url));
const skill = readFileSync(join(HERE, "SKILL.md"), "utf8");

/**
 * A result in the shape the harness reports on, for a claim decided by reading rather than
 * by running something.
 * @param {boolean} ok
 * @param {string} [detail] printed under --verbose, and the reason a failure is legible
 */
const decide = (ok, detail = "") => ({ code: ok ? 0 : 1, out: detail || (ok ? "ok" : "failed") });

// -------------------------------------------------------------------------
t.group("every reference still points at something");

/**
 * Paths this document sends a reader to, inside this skill set. Globs are skipped — a citation
 * like `check-*.mjs` names a family rather than a file, and resolving one is not the claim.
 */
const cited = [...new Set(
    (skill.match(/(?:canon|patterns|design|skills|scripts)\/[A-Za-z0-9._/-]+/g) ?? [])
        .filter((p) => !p.includes("*"))
        .map((p) => p.replace(/[./]+$/, "")),
)].sort();

// A document that cites nothing passes a per-path loop trivially, so the count is its own claim.
t.expect("the skill points outward rather than restating canon — it cites real files, by path",
    decide(cited.length >= 10, `${cited.length} paths cited`), { exit: 0 });

for (const p of cited) {
    t.expect(`a reference that moved must fail this suite: ${p}`,
        decide(existsSync(join(REPO, p)), `${p} does not resolve under ${REPO}`), { exit: 0 });
}

// -------------------------------------------------------------------------
t.group("nothing here is true on only one machine");

/**
 * A path written into a document is true on exactly one machine, and the failure looks like
 * success: files open, greps return, and the conclusions come from the wrong tree.
 */
const MACHINE_PATHS = [
    { name: "a drive-letter path", re: /(?<![A-Za-z])[A-Za-z]:[\\/](?!\/)/ },
    { name: "a mounted-drive path", re: /\/[a-z]\/Repositories/i },
    { name: "a checkout root by name", re: /Repositories[\\/]/i },
    { name: "a home directory", re: /\/(?:home|Users)\//i },
];

const offenders = MACHINE_PATHS.filter(({ re }) => re.test(skill)).map(({ name }) => name);

t.expect("no machine path is written into the skill",
    decide(offenders.length === 0, `found: ${offenders.join(", ")}`), { exit: 0 });

t.expect("the source is resolved through the workspace context instead",
    decide(skill.includes("read-workspace-context.mjs")), { exit: 0 });

// -------------------------------------------------------------------------
t.group("the founding invariant");

// Every step below it borrows its reason from this sentence. Softened, the rest of the lane
// still reads fine and no longer decides anything — which nothing else here would catch.
const INVARIANT = "Volume decides the arrangement";

t.expect(`the lane still states its one rule in these exact words: "${INVARIANT}"`,
    decide(skill.includes(INVARIANT)), { exit: 0 });

t.finish();
