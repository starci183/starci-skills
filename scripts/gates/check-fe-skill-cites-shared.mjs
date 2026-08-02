#!/usr/bin/env node
/**
 * GATE — every FE skill cites the shared canon it must obey.
 *
 * A shared rule (skills/prompt.md, canon/fe/business-parity.md) is only obeyed if the skill that must
 * obey it names it. There is no include mechanism between skill files, so "read this too" is a
 * citation, and the only way to keep it from silently dropping out is to fail the build when it does.
 *
 * Two requirements:
 *   - Every FE skill (starci-fe-*) cites `skills/prompt.md` — the house manner.
 *   - Every FE build/review skill also cites `canon/fe/business-parity.md` — the back end owns the rule.
 *
 *   node scripts/gates/check-fe-skill-cites-shared.mjs
 *
 * EXIT 0 all cite what they must · EXIT 1 one dropped a citation, named.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", ".."); // .claude
const SKILLS = join(ROOT, "skills");

// The build + review skills shape business behaviour, so they must honour the parity rule too.
const MUST_CITE_BUSINESS = new Set([
    "starci-fe-layout-brainstorm",
    "starci-fe-layout-apply",
    "starci-fe-review-scan",
    "starci-fe-review-apply",
]);

const feSkills = existsSync(SKILLS)
    ? readdirSync(SKILLS).filter((n) => n.startsWith("starci-fe-") && existsSync(join(SKILLS, n, "SKILL.md")))
    : [];

const failures = [];
for (const s of feSkills) {
    const text = readFileSync(join(SKILLS, s, "SKILL.md"), "utf8");
    if (!text.includes("skills/prompt.md")) {
        failures.push(`${s} — does not cite skills/prompt.md (the house manner every FE skill follows)`);
    }
    if (MUST_CITE_BUSINESS.has(s) && !text.includes("canon/fe/business-parity.md")) {
        failures.push(`${s} — a build/review skill that does not cite canon/fe/business-parity.md`);
    }
}

if (!feSkills.length) {
    console.log("check-fe-skill-cites-shared: no FE skills found — nothing to check");
    process.exit(0);
}
if (failures.length) {
    console.log("check-fe-skill-cites-shared: FAIL");
    for (const f of failures) console.log(`  ${f}`);
    console.log("\nA shared rule is only obeyed if the skill names it. Add the citation.");
    process.exit(1);
}
console.log(`check-fe-skill-cites-shared: ${feSkills.length} FE skills, all cite the shared canon they obey`);
process.exit(0);
