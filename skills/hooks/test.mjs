#!/usr/bin/env node
/**
 * Tests for skills/hooks/.
 *
 * The hooks own no behaviour of their own — they are the wrapper every skill runs before and after its
 * work. What can rot is the same thing that rots in a skill: a path a hook points at gets moved, and the
 * prose stays true while it stops being findable. Each case below is named as the promise it defends.
 *
 *   node .claude/skills/hooks/test.mjs [--verbose]
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("hooks");

const HOOKS = join(REPO, "skills", "hooks");

/** Every hook document under pre/ and post/, at any depth, as a path relative to the skill set root. */
function walk(rel) {
    const out = [];
    for (const e of readdirSync(join(REPO, rel), { withFileTypes: true })) {
        const child = `${rel}/${e.name}`;
        if (e.isDirectory()) out.push(...walk(child));
        else if (e.name.endsWith(".md")) out.push(child);
    }
    return out;
}

const hookFiles = [...walk("skills/hooks/pre"), ...walk("skills/hooks/post")];
const docs = [join("skills", "hooks", "README.md"), ...hookFiles];
const text = docs.map((d) => readFileSync(join(REPO, d), "utf8")).join("\n");

// ---- the references ------------------------------------------------------
// A moved file is the normal, silent failure in a rule set: the prose stays true and stops being
// findable. This is the case that makes the move loud.

t.group("every path a hook cites resolves in this tree");

/** Every in-repo reference the hooks make, trailing sentence punctuation removed. */
const cited = [...new Set(
    (text.match(/(?:canon|patterns|design|skills|scripts|corrections|debt)\/[A-Za-z0-9._/-]+/g) ?? [])
        .map((p) => p.replace(/[.,;:)]+$/, ""))
        // the entry-file pattern <date>-<skill>-<slug>.md is a template, not a real path
        .filter((p) => !p.includes("<")),
)];

const missing = cited.filter((p) => !existsSync(join(REPO, p)));

t.expect(
    "every path the hooks cite resolves",
    { code: 0, out: missing.length ? `unresolved:\n${missing.join("\n")}` : `${cited.length} cited paths resolve` },
    { lacks: ["unresolved:"] },
);

// ---- the registry --------------------------------------------------------
// The README's table is the registry a skill reads to know which hooks name it. If a hook file exists
// with no row, or a row points at no file, the registry has drifted from the folders beside it.

t.group("the README registry matches the folders");

const readme = readFileSync(join(HOOKS, "README.md"), "utf8");
const unlisted = hookFiles.map((h) => h.replace("skills/hooks/", "")).filter((h) => !readme.includes(h));

t.expect(
    "every hook file under pre/ and post/ has a row in the README table",
    { code: 0, out: unlisted.length ? `not in README:\n${unlisted.join("\n")}` : `${hookFiles.length} hooks listed` },
    { lacks: ["not in README:"] },
);

t.finish();
