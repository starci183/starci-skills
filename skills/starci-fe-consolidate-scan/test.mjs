#!/usr/bin/env node
/**
 * Tests for starci-fe-consolidate-scan.
 *
 * Each case is named as the CLAIM the skill makes, so a failing run reads as a promise broken
 * rather than as "test 7 failed".
 *
 * This skill owns no script — it is a procedure — so there is nothing to run in a sandbox. What
 * can still go wrong on its own, without anybody editing this folder, is the skill's own
 * references: canon files move, gates get renamed, and a skill pointing at a file that is gone
 * teaches its reader that none of its references can be trusted.
 *
 * What it cannot test: whether an agent holding this skill reaches for it BEFORE writing a
 * component that already exists. That needs an eval — see README.md.
 *
 *   node .claude/skills/starci-fe-consolidate-scan/test.mjs [--verbose]
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-fe-consolidate-scan");
const HERE = dirname(fileURLToPath(import.meta.url));
const skill = readFileSync(join(HERE, "SKILL.md"), "utf8");

/** A plain result, for a claim decided by reading rather than by running. */
const said = (ok, out) => ({ code: ok ? 0 : 1, out });

// ---------------------------------------------------------------------
t.group("it points outward, and every pointer still lands");

// Any reference into the canon, the gates, the design material or a sibling skill — written
// bare or with the `.claude/` prefix, in prose or inside a table cell.
const CITATION = /(?:\.claude\/)?((?:canon|patterns|design|skills|scripts)\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\.(?:md|mjs|ts|tsx|csv|json))/g;
const cited = [...new Set([...skill.matchAll(CITATION)].map((m) => m[1]))].sort();

t.expect("the skill cites the canon instead of restating it",
    said(cited.length >= 5, `${cited.length} reference(s): ${cited.join(", ")}`), { exit: 0 });

for (const path of cited) {
    // A moved file must fail here. That is the entire point of the case: the reference reads
    // as authoritative long after the thing it names has gone.
    t.expect(`a reader following ${path} finds a file`,
        said(existsSync(join(REPO, path)), join(REPO, path)), { exit: 0 });
}

// ---------------------------------------------------------------------
t.group("it names no machine");

// A path written into a document is true on exactly one machine, and the failure looks like
// success: files open, greps return, conclusions get drawn from the wrong tree.
const DRIVE_LETTER = /(?:^|[^A-Za-z])[A-Za-z]:[\\/]/;
const POSIX_MOUNT = /\/[a-z]\/Repositories\b/;

t.expect("no drive-letter path is baked into the skill",
    said(!DRIVE_LETTER.test(skill), skill.match(DRIVE_LETTER)?.[0] ?? "none"), { exit: 0 });
t.expect("no mounted-drive path is baked into the skill either",
    said(!POSIX_MOUNT.test(skill), skill.match(POSIX_MOUNT)?.[0] ?? "none"), { exit: 0 });
t.expect("the two trees are resolved through the workspace context",
    said(skill.includes("read-workspace-context.mjs fe.path")
        && skill.includes("read-workspace-context.mjs fe.design_system"), "both roots asked for"), { exit: 0 });

// ---------------------------------------------------------------------
t.group("the founding invariant is stated, not implied");

// The whole reason this half exists separately from the apply. Editing while scanning destroys
// the evidence the proposal rests on, so the promise is made in words a reader can quote back.
const INVARIANT = "The scan writes a proposal and changes no code.";

t.expect("the skill says in words that it changes no code",
    said(skill.includes(INVARIANT), INVARIANT), { exit: 0 });

// ---------------------------------------------------------------------
t.group("the house voice holds");

const GLYPHS = /[✅❌✔✖✗✘\u{1F300}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}]/u;
t.expect("no tick, cross or emoji stands in for a judgement written out",
    said(!GLYPHS.test(skill), skill.match(GLYPHS)?.[0] ?? "none"), { exit: 0 });
t.expect("the frontmatter carries exactly the two keys a skill declares",
    said(/^---\nname: starci-fe-consolidate-scan\ndescription: [^\n]+\n---\n/.test(skill), skill.slice(0, 60)), { exit: 0 });

t.finish();
