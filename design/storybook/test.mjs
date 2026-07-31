#!/usr/bin/env node
/**
 * Tests for the storybook-architecture skill.
 *
 * WHAT IS BEING TESTED
 * That the tier rules can be asked, that a forbidden import direction is reported as forbidden
 * rather than as silence, and that every invariant `scan-storybook-architecture.mjs` claims to gate actually fires.
 *
 * WHAT IT DOES NOT TEST
 * Any particular repo's counts. The tier RULES are universal; the NUMBERS are not, so the trees
 * built here are the smallest that can break exactly one rule.
 *
 *   node design/storybook/test.mjs [--verbose]
 */

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("storybook-architecture");
const SEARCH = "design/storybook/scripts/search-tier-rules.mjs";

t.expect("the tier list names every tier",
    t.run(SEARCH, ["tiers"]), { exit: 0, has: ["atom", "frame", "composite", "block", "page"] });

t.expect("an atom is reported as importing nothing",
    t.run(SEARCH, ["tier", "atom"]), { exit: 0, has: ["may import", "nothing"] });

t.expect("a frame reaching upward is forbidden",
    t.run(SEARCH, ["import", "frame", "composite"]), { exit: 0, has: ["FORBIDDEN"] });

// The verdict line is the caller's answer, so it is asserted verbatim, case and all — the
// first version of this case looked for lowercase and failed against a correct script.
t.expect("a frame importing an atom is allowed only for its own chrome, and says so",
    t.run(SEARCH, ["import", "frame", "atom"]), { exit: 0, has: ["ONLY FOR ITS OWN CHROME"] });

// A direction nobody wrote a rule for is not a permission. Silence here would read as yes.
t.expect("a direction with no rule refuses rather than staying quiet",
    t.run(SEARCH, ["import", "overlay", "block"]), { exit: 1, has: ["not a permission"] });

t.expect("an unknown tier names the ones that exist",
    t.run(SEARCH, ["tier", "not-a-tier"]), { exit: 1, has: ["unknown tier"] });

// -------------------------------------------------------------------------
// scan.mjs — the invariants have to actually fire
// -------------------------------------------------------------------------
//
// An invariant nobody has watched fail is not known to gate anything. Each case below builds a
// tiny tree that breaks exactly one rule, and requires the scan to name it and exit 1.

t.group("the gates must go red");

const SANDBOX = join(REPO, ".testtmp", "scan");
const SCAN = "scripts/scan-storybook-architecture.mjs";

/**
 * Build a minimal storybook tree and scan it.
 * @param {string} name sandbox folder
 * @param {Record<string,string>} files path under `.storybook/components/` -> contents
 */
function scanTree(name, files) {
    const root = join(SANDBOX, name);
    for (const [rel, body] of Object.entries(files)) {
        const full = join(root, ".storybook", "components", rel);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, body);
    }
    return t.run(SCAN, [root]);
}

const CLEAN = {
    "atoms/Button.tsx": "export const Button = 1\n",
    "myapp/blocks/Card.tsx": 'import { Button } from "../../components/atoms/Button"\n',
    "myapp/pages/Home.tsx": 'import { Card } from "../blocks/Card"\n',
};

rmSync(SANDBOX, { recursive: true, force: true });
try {
    t.expect("a tree that breaks nothing passes and exits 0",
        scanTree("clean", CLEAN), { exit: 0, has: ["ok      every invariant holds"] });

    t.expect("an import against the direction fails",
        scanTree("upward", { ...CLEAN, "atoms/Bad.tsx": 'import { C } from "../../components/composites/C"\n' }),
        { exit: 1, has: ["against the direction"] });

    // An atom that arranges children is a composite wearing the wrong name.
    t.expect("an atom importing any other tier fails, and says what it has become",
        scanTree("atomimport", { ...CLEAN, "atoms/Bad.tsx": 'import { F } from "../../components/frames/F"\n' }),
        { exit: 1, has: ["composite with the wrong name"] });

    // The one that nothing else in the tree would announce.
    t.expect("a shared tier copied under an app namespace fails, and names it",
        scanTree("stolen", { ...CLEAN, "myapp/atoms/Copy.tsx": "export const X = 1\n" }),
        { exit: 1, has: ["shared tier is copied under an app namespace", "myapp/atoms"] });

    t.expect("a page importing a vendor component fails — it means a block is missing",
        scanTree("pagevendor", { ...CLEAN, "myapp/pages/Bad.tsx": 'import { Button } from "@heroui/react"\n' }),
        { exit: 1, has: ["a block is missing"] });

    // A helper has no shape, so no atom could wrap it. Failing on it would train people to
    // ignore the gate, and the real missing atoms would go with it.
    t.expect("a vendor UTILITY above composite is reported but does not fail",
        scanTree("util", { ...CLEAN, "myapp/blocks/Util.tsx": 'import { cn } from "@heroui/react"\n' }),
        { exit: 0, has: ["utility", "re-export"] });

    t.expect("a vendor COMPONENT above composite is reported as a missing atom",
        scanTree("comp", { ...CLEAN, "myapp/blocks/Comp.tsx": 'import { Popover } from "@heroui/react"\n' }),
        { exit: 0, has: ["missing atom"] });

    // ---------------------------------------------------------------------
    // audit-atoms.mjs — the three atom rules a machine can decide
    // ---------------------------------------------------------------------

    t.group("the atom audit must go red");

    const AUDIT = "scripts/audit-atoms.mjs";

    /** An atom that keeps every checkable rule: no tier imports, isSkeleton, a constrained prop. */
    const GOOD_ATOM = `export type AllowedClassName = "flex-1" | "self-start"
interface Props { isSkeleton?: boolean; classNames?: Array<AllowedClassName> }
export const Text = (p: Props) => { return <span /> }
`;

    const auditTree = (name, files) => {
        const root = join(SANDBOX, "audit", name);
        for (const [rel, body] of Object.entries(files)) {
            const full = join(root, ".storybook", "components", rel);
            mkdirSync(dirname(full), { recursive: true });
            writeFileSync(full, body);
        }
        return t.run(AUDIT, [root]);
    };

    t.expect("an atom keeping every checkable rule passes and exits 0",
        auditTree("clean", { "atoms/Text.tsx": GOOD_ATOM }),
        { exit: 0, has: ["no violation of a checkable rule"] });

    t.expect("an atom importing another tier is caught (ATOM-3)",
        auditTree("imports", {
            "atoms/Text.tsx": `import { Stack } from "../../components/frames/Stack"\n${GOOD_ATOM}`,
        }),
        { exit: 1, has: ["ATOM-3", "imports frames"] });

    // Only the atom knows the space its value will occupy, so only it can shimmer that space.
    t.expect("an atom with no isSkeleton is caught (ATOM-4)",
        auditTree("noskel", {
            "atoms/Text.tsx": "interface Props { classNames?: Array<string> }\nexport const Text = (p: Props) => { return <span /> }\n",
        }),
        { exit: 1, has: ["ATOM-4", "no isSkeleton"] });

    // A free string cannot be constrained, so the rule can only be enforced by a reviewer noticing.
    t.expect("an atom still declaring `className?: string` is caught (ATOM-5-type)",
        auditTree("stringprop", {
            "atoms/Text.tsx": "interface Props { isSkeleton?: boolean; className?: string }\nexport const Text = (p: Props) => { return <span /> }\n",
        }),
        { exit: 1, has: ["ATOM-5-type", "classNames?: Array<AllowedClassName>"] });

    t.expect("appearance passed to an atom at a call site is caught (ATOM-5)",
        auditTree("appearance", {
            "atoms/Text.tsx": GOOD_ATOM,
            "myapp/blocks/Card.tsx": `import { Text } from "../../components/atoms/Text"
<Text className="text-red-500 flex-1" />
`,
        }),
        { exit: 1, has: ["ATOM-5", "text-red-500"] });

    // Position is a fact about the PARENT, which the atom cannot know — so it has to be passable.
    t.expect("position passed to an atom is allowed and reported as no violation",
        auditTree("position", {
            "atoms/Text.tsx": GOOD_ATOM,
            "myapp/blocks/Card.tsx": `import { Text } from "../../components/atoms/Text"
<Text className="flex-1 self-start w-full" />
`,
        }),
        { exit: 0, has: ["no violation of a checkable rule"] });

    // Otherwise every violation could hide behind a breakpoint.
    t.expect("a responsive prefix does not launder an appearance class",
        auditTree("responsive", {
            "atoms/Text.tsx": GOOD_ATOM,
            "myapp/blocks/Card.tsx": `import { Text } from "../../components/atoms/Text"
<Text className="md:text-sm" />
`,
        }),
        { exit: 1, has: ["md:text-sm"] });
} finally {
    rmSync(SANDBOX, { recursive: true, force: true });
}

t.finish();
