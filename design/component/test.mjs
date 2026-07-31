#!/usr/bin/env node
/**
 * Tests for the component-matrix skill.
 *
 * WHAT IS BEING TESTED
 * That every command answers, that the refusals actually fire, and that the data gate goes
 * red when the data is broken. The last one is the point: a gate nobody has seen fail is not
 * known to gate anything.
 *
 * WHAT IT DOES NOT TEST
 * Whether the rows are right. No script can check that a shape really does demand the
 * component the table names — that is the teacher's judgement, recorded as an anchor.
 *
 *   node design/component/test.mjs [--verbose]
 */

import { execFileSync } from "node:child_process";
import { cpSync, rmSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("component-matrix");
const SEARCH = "design/component/scripts/search-component-matrix.mjs";
const VALIDATE = "design/component/scripts/validate-component-matrix.mjs";

// -------------------------------------------------------------------------
t.group("looking a shape up");

t.expect("no arguments lists the 15 doors and their deciding tests",
    t.run(SEARCH), { exit: 0, has: ["surface-card", "identity", "Enter by what you are holding"] });

t.expect("a shape query reaches the accordion row, not the list row",
    t.run(SEARCH, ["shape", "expandable rows hidden body"]), { exit: 0, has: ["SurfaceCardAccordion"] });

t.expect("a full sentence still lands, even when only two of its words are in the table",
    t.run(SEARCH, ["shape", "one paragraph of author prose"]), { exit: 0, has: ["SurfaceCard"] });

// The first version of this case asked for "zzzqqq nonexistent shape" and failed — correctly.
// "shape" is a real word in three rows, so returning them was the right answer and the CASE
// was the thing that was wrong. A no-match case has to use words the table has never seen.
t.expect("a shape nothing covers refuses instead of inventing a component",
    t.run(SEARCH, ["shape", "zzzqqq wibble frobnicate"]), { exit: 1, has: ["not permission to invent"] });

t.expect("a query of pure grammar says so rather than returning the whole table",
    t.run(SEARCH, ["shape", "a the of one"]), { exit: 1, has: ["grammar"] });

t.expect("one row prints whole and points at its traps",
    t.run(SEARCH, ["row", "surface-card-01"]), { exit: 0, has: ["SurfaceCard", "children / body", "traps surface-card"] });

t.expect("a section prints its deciding test before its rows",
    t.run(SEARCH, ["section", "disclosure"]), { exit: 0, has: ["Count the collapsible regions"] });

t.expect("an unknown section names the ones that exist",
    t.run(SEARCH, ["section", "not-a-section"]), { exit: 1, has: ["known:", "surface-card"] });

t.expect("traps slices one block instead of the whole 36 KB file",
    t.run(SEARCH, ["traps", "disclosure"]), { exit: 0, has: ["## disclosure"], lacks: ["## identity"] });

t.expect("reading backward warns before it answers",
    t.run(SEARCH, ["used-by", "SurfaceCardList"]), { exit: 0, has: ["AUDIT ONLY"] });

t.expect("a whole-word match keeps 'a bare flex row' out of the Flex answer",
    t.run(SEARCH, ["used-by", "Flex"]), { exit: 0, has: ["frame-09"], lacks: ["nav-03"] });

t.expect("a name that is not a door says so rather than 'not found'",
    t.run(SEARCH, ["used-by", "ProgressMeterTargetMark"]), { exit: 0, has: ["NOT A DOOR"] });

t.expect("an unknown command lists the real ones",
    t.run(SEARCH, ["bogus"]), { exit: 1, has: ["commands:"] });

// -------------------------------------------------------------------------
t.group("the data gate must go red");

t.expect("the shipped data passes",
    t.run(VALIDATE), { exit: 0, has: ["ok — 136 rows, 15 sections"] });

/**
 * Copy the skill to a scratch folder, corrupt it, and require the gate to catch it.
 * A copy rather than the real thing: a suite that edits shipped data is one interrupted run
 * away from leaving the repo broken.
 *
 * @param {string} name the claim
 * @param {(csvPath: string, trapsPath: string) => void} corrupt what to break
 * @param {string} mustSay the message the gate has to produce
 */
function negativeControl(name, corrupt, mustSay) {
    const dir = mkdtempSync(join(tmpdir(), "component-gate-"));
    try {
        cpSync(join(REPO, "design/component"), dir, { recursive: true });
        corrupt(join(dir, "data", "matrix.csv"), join(dir, "references", "traps.md"));

        let result;
        try {
            result = {
                code: 0,
                out: execFileSync(process.execPath, [join(dir, "scripts", "validate-component-matrix.mjs")], {
                    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
                }),
            };
        } catch (e) {
            result = { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
        }
        t.expect(name, result, { exit: 1, has: [mustSay] });
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

const patch = (file, from, to) => writeFileSync(file, readFileSync(file, "utf8").replace(from, to));

negativeControl("an id that drifted from its position is caught",
    (csv) => patch(csv, "surface-card-04,", "surface-card-99,"), "position says");

negativeControl("markdown left in a cell a script reads is caught",
    (csv) => patch(csv, ",SurfaceCardAccordion,", ",**`SurfaceCardAccordion`**,"), "still carries");

negativeControl("an empty answer column is caught",
    (csv) => patch(csv, ",SurfaceCardAccordion,items[]", ",,items[]"), "cannot answer without it");

negativeControl("a section that exists in no sections.csv row is caught",
    (csv) => patch(csv, "surface-card-04,surface-card,", "surface-card-04,made-up,"), "is not in sections.csv");

negativeControl("a trap block missing for a real section is caught",
    (_csv, traps) => patch(traps, "\n## disclosure\n", "\n## disclosurex\n"), 'no block for section "disclosure"');

t.finish();
