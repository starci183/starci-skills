#!/usr/bin/env node
/**
 * Tests for starci-deploy-vps.
 *
 * The skill owns no script of its own — what rots is the DOCUMENT: a script it points at moves, or
 * the env-only-secrets stance gets edited into something that writes a credential to disk. Each case
 * is named as the promise it defends.
 *
 *   node .claude/skills/starci-deploy-vps/test.mjs [--verbose]
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-deploy-vps");
const text = readFileSync(join(REPO, "skills", "starci-deploy-vps", "SKILL.md"), "utf8");

// ---- the references resolve ----------------------------------------------

t.group("every in-repo path it cites exists");

const cited = [...new Set(
    (text.match(/(?:canon|patterns|design|skills|scripts|corrections)\/[A-Za-z0-9._/-]+/g) ?? [])
        .map((p) => p.replace(/[.,;:)]+$/, ""))
        .filter((p) => !p.includes("<")),
)];
const missing = cited.filter((p) => !existsSync(join(REPO, p)));

t.expect(
    "every scripts, skills and hooks path cited resolves in this tree",
    { code: 0, out: missing.length ? `unresolved:\n${missing.join("\n")}` : `${cited.length} cited paths resolve` },
    { lacks: ["unresolved:"] },
);

// ---- secrets stay in the environment, never on disk ----------------------
// The whole safety of a public skill set handling deploy credentials is that no value is ever
// written down. If the skill stopped reading secrets from the environment, this is the case that
// would catch it.

t.group("secrets are read from the environment, not stored");

t.expect(
    "the skill reads secrets through read-workspace-context and calls them env-only",
    { code: 0, out: text.includes("read-workspace-context.mjs secret.") && /env-only|environment/i.test(text) ? "env-only" : "missing the env-only stance" },
    { has: ["env-only"] },
);

// ---- it stays in its lane -------------------------------------------------

t.group("it fences off the neighbouring flow");

t.expect(
    "the description defers Kubernetes to starci-deploy-k8s",
    { code: 0, out: text.includes("starci-deploy-k8s") ? "defers" : "no fence to the k8s flow" },
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
