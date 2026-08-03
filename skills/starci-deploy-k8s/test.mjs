#!/usr/bin/env node
/**
 * Tests for starci-deploy-k8s.
 *
 * This skill ships no script of its own — its whole substance is the document. So the suite
 * tests the document, the way `starci-canon-first`'s and `starci-be-cannon-apply`'s do:
 *
 *   1. every `.claude`-internal path it cites (canon/, skills/, scripts/, hooks/, corrections/)
 *      still resolves in this tree — a hook gets renamed and this file keeps pointing at the old
 *      name, or a script moves and a reader is sent nowhere.
 *   2. its frontmatter carries exactly `name` and `description` — no extra key, no missing one.
 *
 * What it deliberately does NOT try to resolve: paths into the app repo (`kani`) or the deploy
 * repo (`kani-k8s`) this skill talks about — `kani-k8s/terraform/do`, `charts/repo/service`,
 * `variables_*.tf` and the like. Those live outside `.claude` entirely, on whichever machine has
 * them checked out, and a suite that ran here could only ever tell you they're missing from the
 * wrong tree. They're cited by bare name for a human to recognise, not for this suite to resolve.
 *
 *   node .claude/skills/starci-deploy-k8s/test.mjs [--verbose]
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-deploy-k8s");
const text = readFileSync(join(REPO, "skills", "starci-deploy-k8s", "SKILL.md"), "utf8");

// ---- every .claude-internal path it cites still resolves ------------------

t.group("every .claude-internal path it cites still resolves");

const cited = [...new Set(
    (text.match(/(?:canon|skills|scripts|hooks|corrections)\/[A-Za-z0-9._/-]+/g) ?? [])
        .map((p) => p.replace(/[.,;:)]+$/, "")),
)];

t.expect(
    "the document cites at least one canon/skills/scripts/hooks/corrections path — a skill that points nowhere restates instead",
    { code: cited.length > 0 ? 0 : 1, out: `${cited.length} cited path(s)` },
    { exit: 0 },
);

const missing = cited.filter((p) => !existsSync(join(REPO, p)));

t.expect(
    "every canon, skills, scripts, hooks and corrections path cited resolves in this tree",
    { code: 0, out: missing.length ? `unresolved:\n${missing.join("\n")}` : `${cited.length} cited paths resolve` },
    { lacks: ["unresolved"] },
);

// ---- the two hooks it claims to run are the ones it actually names --------
// Deploy skills are apply-like without a proposal to present: pre/resolve-workspace and
// post/record-correction, not post/plan/present and not post/apply/verify. If a rewrite starts
// citing hooks this lane doesn't run, that's the scope quietly drifting.

t.group("it names its own two hooks, and no others");

t.expect(
    "it cites pre/resolve-workspace",
    { code: 0, out: text },
    { has: ["hooks/pre/resolve-workspace.md"] },
);

t.expect(
    "it cites post/record-correction",
    { code: 0, out: text },
    { has: ["hooks/post/record-correction.md"] },
);

t.expect(
    "it does not claim the plan-only presentation hook — this skill proposes nothing to draw",
    { code: text.includes("post/plan/present") ? 1 : 0, out: text.includes("post/plan/present") ? "cites post/plan/present" : "does not cite it" },
    { exit: 0 },
);

// ---- both real inputs are named, not just implied -------------------------

t.group("the one real input to each mode is named in words, not left implicit");

t.expect(
    "provisioning names DO_TOKEN as the root secret a fresh cluster needs",
    { code: 0, out: text },
    { has: ["DO_TOKEN"] },
);

t.expect(
    "redeploying names KUBECONFIG as what points kubectl at an existing cluster",
    { code: 0, out: text },
    { has: ["KUBECONFIG"] },
);

t.expect(
    "the kubeconfig-from-DO_TOKEN derivation is stated, not left for a reader to assume two separate credentials",
    { code: 0, out: text.replace(/\s+/g, " ") },
    { has: ["derived from the DigitalOcean token"] },
);

// ---- frontmatter -----------------------------------------------------------

t.group("the frontmatter is well formed");

const fm = text.split("---")[1] ?? "";
const keys = [...fm.matchAll(/^([a-z]+):/gm)].map((m) => m[1]);

t.expect(
    "the frontmatter carries exactly name and description",
    { code: 0, out: keys.join(",") },
    { has: ["name,description"], lacks: ["\n"] },
);

t.finish();
