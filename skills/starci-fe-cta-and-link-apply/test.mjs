#!/usr/bin/env node
/**
 * Tests for starci-fe-cta-and-link-apply.
 *
 * This skill has no script of its own — it is prose that an agent follows — so what can be
 * tested is whether the prose still tells the truth about the repo around it. Each case is
 * named as the CLAIM the file makes, so a failing run reads as a promise broken.
 *
 * What it cannot test: whether an agent holding this skill stays inside the proposal instead
 * of improving things on the way past. That needs an eval — see README.md.
 *
 *   node .claude/skills/starci-fe-cta-and-link-apply/test.mjs [--verbose]
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-fe-cta-and-link-apply");
const HERE = dirname(fileURLToPath(import.meta.url));
const skill = readFileSync(join(HERE, "SKILL.md"), "utf8");

/** The file as one line, so a claim wrapped across a line break still reads as one sentence. */
const flat = skill.replace(/\s+/g, " ");

/** A result the harness can grade, built from a check that runs in this process. */
const verdict = (ok, out) => ({ code: ok ? 0 : 1, out });

// ---------------------------------------------------------------------------
t.group("the citations still point at something");

// This half routes work to other lanes and defers to canon for how a line is spelled. Every
// one of those pointers is a promise, and a moved file breaks it without saying so.
const CITATION = /\b(?:canon|patterns|design|skills)\/[A-Za-z0-9._*-]+(?:\/[A-Za-z0-9._*-]+)*\.(?:md|mjs|ts|csv)/g;
const cited = [...new Set([...skill.matchAll(CITATION)].map((m) => m[0]))];

/** A citation may name one file, or a family of them (`check-*.mjs`); both have to resolve. */
const resolves = (p) => {
    if (!p.includes("*")) return existsSync(join(REPO, p));
    const dir = join(REPO, dirname(p));
    if (!existsSync(dir)) return false;
    const name = p.split("/").pop().replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const rx = new RegExp(`^${name}$`);
    return readdirSync(dir).some((f) => rx.test(f));
};

const missing = cited.filter((p) => !resolves(p));

t.expect("every canon, patterns, design and sibling-skill path it cites resolves in this repo",
    verdict(missing.length === 0, missing.length
        ? `these citations point at nothing: ${missing.join(", ")}`
        : `all ${cited.length} citations resolve`),
    { exit: 0, has: ["citations resolve"] });

t.expect("it points outward rather than restating canon in place",
    verdict(cited.length >= 3, `${cited.length} outward citations`),
    { exit: 0 });

t.expect("the storybook-first law is cited where the fix needs a component that does not exist",
    verdict(cited.includes("patterns/fe/gates/check-story-coverage.mjs"),
        cited.includes("patterns/fe/gates/check-story-coverage.mjs")
            ? "story coverage is named as the gate that holds the line"
            : "the storybook-first gate is not cited"),
    { exit: 0, has: ["holds the line"] });

// ---------------------------------------------------------------------------
t.group("nothing here is true on only one machine");

// A drive letter or a `/x/Repositories/` root is the failure that looks like success: files
// open, greps return, and the edits land in the wrong tree.
const machine = [
    ...[...skill.matchAll(/(?<![A-Za-z0-9])[A-Za-z]:[\\/][A-Za-z0-9._-]+/g)].map((m) => m[0]),
    ...[...skill.matchAll(/\/[a-z]\/Repositories\/[A-Za-z0-9._-]+/gi)].map((m) => m[0]),
];

t.expect("no machine path is written into the skill — the source is resolved, never remembered",
    verdict(machine.length === 0, machine.length
        ? `hardcoded paths: ${machine.join(", ")}`
        : "no hardcoded path"),
    { exit: 0, has: ["no hardcoded path"] });

t.expect("it names the command that resolves the front end instead",
    verdict(skill.includes("read-workspace-context.mjs fe.path"), skill.includes("read-workspace-context.mjs fe.path")
        ? "resolves fe.path through the workspace context"
        : "no workspace-context lookup"),
    { exit: 0, has: ["resolves fe.path"] });

// ---------------------------------------------------------------------------
t.group("the founding invariant survives editing");

// The routing, the re-read of every call site, the three closing groups — all of it exists to
// keep one promise. Soften this sentence into a preference and the pair stops working across
// sessions, because an unapproved change becomes indistinguishable from an approved one.
const INVARIANT = "the proposal is the spec, and a finding that is not in it is not fixed here";

t.expect("the proposal is still the spec, in those words",
    verdict(flat.includes(INVARIANT), flat.includes(INVARIANT)
        ? "the invariant is stated verbatim"
        : `the invariant is missing: "${INVARIANT}"`),
    { exit: 0, has: ["stated verbatim"] });

// ---------------------------------------------------------------------------
t.group("house voice");

// canon/HOW-TO-WRITE.md: a judgement that needs a glyph beside it to be understood has not
// been written yet, and stripping the glyph from a counter-example inverts its meaning.
const glyphs = [...skill.matchAll(/[✅❌⚠⭐\u{1F300}-\u{1FAFF}]|^\s*- \[[ x]\]/gmu)].map((m) => m[0]);

t.expect("every judgement is written in words — no tick, cross or checkbox",
    verdict(glyphs.length === 0, glyphs.length ? `glyphs found: ${glyphs.join(" ")}` : "judgements are in words"),
    { exit: 0, has: ["judgements are in words"] });

t.finish();
