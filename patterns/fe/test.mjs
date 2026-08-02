#!/usr/bin/env node
/**
 * Tests for the patterns/ glue.
 *
 * WHAT IS BEING TESTED
 * That `check-canon-sync.mjs` actually goes red. A gate nobody has watched fail is not known to
 * gate anything — it is a script that has only ever printed OK, which is also what a broken one
 * does. Each case below builds the smallest registry+canon pair that disagrees in exactly one
 * way, and requires the gate to name the token and exit 1.
 *
 * WHAT IT DOES NOT TEST
 * The real registry's numbers, or the real canon's wording. Those change with the design system;
 * the RULE that the two must quote the same pixel does not. The fixtures here are made up on
 * purpose so this suite stays green through a redesign.
 *
 *   node patterns/fe/test.mjs [--verbose]
 */

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("patterns-canon-sync");

const GATE = "patterns/fe/gates/check-canon-sync.mjs";
const SANDBOX = join(REPO, ".testtmp", "canon-sync");

/** A registry with one gap, one symmetric padding, one asymmetric padding, one pixel-less token. */
const REGISTRY = `export const PATTERNS = {
    "block-boundary": { prop: "gap", step: 6, px: 24, what: "two blocks in a page" },
    "card-padding": { prop: "padding", step: 5, px: 16, what: "a surface that holds groups" },
    "control-pad": { prop: "padding-xy", x: 12, y: 8, what: "a control holding short text" },
    "sticky-top": { prop: "position", value: "sticky", what: "a header pinned to its scroll region" },
}
export const PROP_READS = { gap: ["rowGap"], padding: ["paddingTop"], "padding-xy": { x: ["paddingLeft"], y: ["paddingTop"] }, position: "position" }
`;

/** A canon that quotes every pixel the registry commits to. */
const AGREE = `# Principles

Two blocks in a page are separated by \`block-boundary\` — 24px. It is the seam that says a new
thing has started, and it is the most common seam in the app.

A surface holding groups insets itself with \`card-padding\` — 16px on all four sides. Cards,
modals and drawers are all the same surface wearing different chrome.

A control holding short text uses \`control-pad\` — 12px across and 8px down. The asymmetry is
what makes a pill read as a pill.

\`sticky-top\` pins a header to the top of its scroll region. It commits to no pixel of its own.
`;

/**
 * Write a registry+canon pair into a sandbox root and run the gate against it.
 * @param {string} name sandbox folder
 * @param {{registry?: string, canon?: string|null}} pair `canon: null` writes no canon at all
 */
function pair(name, { registry = REGISTRY, canon = AGREE }) {
    const root = join(SANDBOX, name);
    if (registry !== null) {
        mkdirSync(join(root, "patterns", "fe"), { recursive: true });
        writeFileSync(join(root, "patterns", "fe", "patterns.mjs"), registry);
    }
    if (canon !== null) {
        mkdirSync(join(root, "canon", "fe"), { recursive: true });
        writeFileSync(join(root, "canon", "fe", "principles.md"), canon);
    }
    return t.run(GATE, [root]);
}

rmSync(SANDBOX, { recursive: true, force: true });
try {
    t.group("the gate must go red");

    // The one the whole gate exists for: a number changed on one side only.
    t.expect("a canon quoting a different pixel fails, and names the token and both numbers",
        pair("divergent", { canon: AGREE.replace("— 24px", "— 32px") }),
        { exit: 1, has: ["block-boundary", "24", "32"] });

    // Silence is the failure mode that hides longest: nobody notices a rule that was never written.
    t.expect("a pixel the canon never wrote down fails, rather than passing quietly",
        pair("unwritten", { canon: AGREE.replace(/A surface holding[\s\S]*?chrome\.\n/, "") }),
        { exit: 1, has: ["card-padding", "named nowhere in canon"] });

    // A step number must never be able to stand in for a value.
    t.expect("a canon naming only the step, not the pixel, fails",
        pair("steponly", { canon: AGREE.replace("— 24px", "— step 6") }),
        { exit: 1, has: ["block-boundary", "quotes"] });

    // Both halves of an asymmetric pad have to be present; one is not agreement.
    t.expect("an asymmetric pad quoting only its x fails on the missing y",
        pair("halfpad", { canon: AGREE.replace("12px across and 8px down", "12px across") }),
        { exit: 1, has: ["control-pad", "12px, 8px"] });

    // A fenced example citing a token that cannot render will be copied out of the canon as-is.
    t.expect("a fenced example citing a token the registry does not have fails, and names it",
        pair("ghost", { canon: `${AGREE}\n\`\`\`tsx\n<Stack data-principles="block-boundary made-up-token" />\n\`\`\`\n` }),
        { exit: 1, has: ["made-up-token", "no such pattern"] });

    // The canon writes `data-principles="p-4"` mid-sentence to say that writing it would be
    // wrong. A gate that reads a warning as a demonstration gets switched off.
    t.expect("a token named inline in prose as a counter-example is not read as a citation",
        pair("counterexample", { canon: `${AGREE}\nWriting \`data-principles="p-4"\` would restate the class beside the class.\n` }),
        { exit: 0, has: ["OK"] });

    // A markdown table is one paragraph. Without row scoping, a drifted row would be satisfied by
    // the correct number sitting two rows below it, and the table would be unguarded.
    t.expect("a drifted row in a table is not rescued by its neighbour's number",
        pair("table", {
            canon: `# Principles

| Concept | px | What it is |
|---|---|---|
| \`block-boundary\` | 16 | two blocks in a page |
| \`card-padding\` | 16 | a surface that holds groups |
| \`control-pad\` | 12 | 8 | a control holding short text |
`,
        }),
        { exit: 1, has: ["block-boundary", "registry says 24px"] });

    t.group("a missing half is reported, not thrown");

    // The gate has to resolve the path and say which file is absent. A caller who sees a stack
    // trace from an import learns nothing about what to write.
    t.expect("no canon at all exits 1 naming the path it looked for",
        pair("nocanon", { canon: null }),
        { exit: 1, has: ["canon/fe/principles.md", "does not exist", "prose that explains them lives in canon/"] });

    t.expect("no registry at all exits 1 naming the path it looked for",
        pair("noregistry", { registry: null }),
        { exit: 1, has: ["patterns/fe/patterns.mjs", "does not exist"] });

    t.expect("a registry that cannot be loaded exits 1 rather than crashing the gate",
        pair("brokenregistry", { registry: "export const PATTERNS = { unclosed:\n" }),
        { exit: 1, has: ["could not be loaded"] });

    t.group("and green when they agree");

    t.expect("a registry and canon quoting the same pixels pass and exit 0",
        pair("agree", {}),
        { exit: 0, has: ["OK", "canon quotes every one"] });

    // Otherwise the suite above would pass against a gate that fails everything.
    t.expect("a pixel-less token is not demanded of the canon",
        pair("pixelless", { canon: AGREE.replace(/\n`sticky-top`[\s\S]*$/, "\n") }),
        { exit: 0, has: ["OK"] });
} finally {
    rmSync(SANDBOX, { recursive: true, force: true });
}

t.finish();
