#!/usr/bin/env node
/**
 * check-single-source-of-truth.mjs — one book, one .claude, for the whole ledger.
 *
 * The design system is ONE storybook — starci-academy's `.storybook/` — and the skill set is ONE
 * `.claude/`, the repo these scripts live in. This gate fails when a registered source has grown a
 * copy of either, because a second book or a second canon is a second truth that drifts silently:
 * the day one app's tokens, or one app's rules, stop matching another's, nothing announces it.
 *
 * It reads only the ledger (context/workspace.json) and never sweeps the disk — the same rule
 * choose-design-system.mjs keeps: a candidate is something REGISTERED, not something found lying
 * around. A stray .storybook in a repo nobody registered is not this gate's business.
 *
 *   node scripts/workspace/check-single-source-of-truth.mjs
 *
 * This is the LINT half of "audit once, lint forever": the audit found the sprawl once; this keeps
 * it from coming back. Wire it into a pre-commit hook, or read it in run-all-tests' suite.
 *
 * EXIT CODES
 *   0  the ledger holds one book and no stray .claude (or the machine has no ledger yet)
 *   1  a registered source carries its own .storybook/ or .claude/, or the book is misrecorded
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONTEXT_FILE = join(REPO, "context", "workspace.json");

/**
 * The one FE repo that ships the ecosystem book. Matched by path SEGMENT, not substring, so
 * `starci-academy-backend` — a different segment — is never mistaken for it.
 */
const CANON = "starci-academy";

const segments = (p) => String(p).split(/[\\/]+/).filter(Boolean);
const shipsCanon = (p) => segments(p).includes(CANON);

// A machine that was never set up has nothing to police — that is not a violation.
if (!existsSync(CONTEXT_FILE)) {
    console.log("no workspace context on this machine — nothing to check");
    process.exit(0);
}

let registry;
try {
    registry = JSON.parse(readFileSync(CONTEXT_FILE, "utf8"));
} catch {
    console.error(`FAIL  ${CONTEXT_FILE} is not readable JSON`);
    process.exit(1);
}

const problems = [];
const projects = registry.projects ?? {};

for (const [name, proj] of Object.entries(projects)) {
    for (const role of ["fe", "be"]) {
        const path = proj?.[role]?.path;
        if (!path) continue;

        // (a) the book is shared — only starci-academy may carry a `.storybook/`.
        if (role === "fe" && !shipsCanon(path) && existsSync(join(path, ".storybook"))) {
            problems.push(
                `${name}.${role} carries its own .storybook/  (${path})\n` +
                "        the book is shared — fold its stories into a namespace inside " +
                "starci-academy/.storybook and delete this copy",
            );
        }
        // (b) the skill set is one `.claude/` — no registered source keeps a copy.
        if (existsSync(join(path, ".claude"))) {
            problems.push(
                `${name}.${role} carries a .claude/  (${path})\n` +
                "        there is one .claude, in the skill-set repo — delete this copy",
            );
        }
    }
}

// (c) the recorded book must be starci-academy's `.storybook`, not another repo's.
const book = registry.design_system?.path ?? null;
if (!book) {
    problems.push(
        "design_system is not recorded\n" +
        "        point it at the one book:  choose-design-system.mjs choose <starci-academy>",
    );
} else if (!(shipsCanon(book) && segments(book).includes(".storybook"))) {
    problems.push(
        `design_system points at ${book}\n` +
        "        it must be starci-academy's .storybook — the one book every source reads",
    );
}

if (problems.length) {
    console.error("FAIL  the ledger has more than one source of truth:\n");
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
        `\n${problems.length} violation(s). ` +
        "One book (starci-academy/.storybook), one .claude (the skill-set repo).",
    );
    process.exit(1);
}

console.log("ok — one book (starci-academy/.storybook), one .claude; no registered source carries its own");
process.exit(0);
