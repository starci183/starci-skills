/**
 * test-harness.mjs — the few pieces every skill's `test.mjs` needs.
 *
 * WHY A SHARED FILE
 * Each skill owns its own tests, next to the thing being tested, so a skill can be copied to
 * another repo and still carry its proof. What they must NOT each own is a private idea of
 * what passing means — three slightly different `expect`s would make three suites that cannot
 * be read against each other.
 *
 * WHAT A CASE LOOKS LIKE
 * A case is named as the CLAIM it makes, not as the function it calls:
 *
 *     t.expect(
 *         "an empty folder is refused — a checkout that never happened is not a source",
 *         t.run("scripts/register-workspace-source.mjs", ["--fe", empty]),
 *         { exit: 1, has: ["is empty"] },
 *     )
 *
 * Read the output of a run and it reads as a list of promises the skill keeps. A case called
 * "test setup 3" tells a later reader nothing about what broke.
 */

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";

/** Root of the skill set, from this file's own location. */
export const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Start a suite.
 * @param {string} title printed as the heading, and named in the summary
 * @returns {{run: Function, expect: Function, group: Function, finish: Function, repo: string}}
 */
export function harness(title) {
    const verbose = process.argv.includes("--verbose");
    let passed = 0;
    const failures = [];

    console.log(`\n# ${title}`);

    /**
     * Run a node script and capture what a caller would actually see.
     * stderr is folded into stdout: these scripts talk to a human on both streams, and a case
     * asserting "the message explains what to do" should not care which one carried it.
     *
     * @param {string} script path, absolute or relative to the skill set root
     * @param {string[]} [args]
     * @param {string} [cwd]
     * @returns {{code: number, out: string}}
     */
    const run = (script, args = [], cwd = REPO) => {
        const file = isAbsolute(script) ? script : join(REPO, script);
        try {
            return {
                code: 0,
                out: execFileSync(process.execPath, [file, ...args], {
                    encoding: "utf8", cwd, stdio: ["ignore", "pipe", "pipe"],
                }),
            };
        } catch (e) {
            // A non-zero exit is an expected outcome in a third of these cases, not an error.
            return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
        }
    };

    /**
     * Declare one case.
     * @param {string} name the claim, in words
     * @param {{code: number, out: string}} result what running it produced
     * @param {{exit?: number, has?: string[], lacks?: string[]}} spec
     */
    const expect = (name, result, { exit, has = [], lacks = [] }) => {
        const wrong = [];
        if (exit !== undefined && result.code !== exit) wrong.push(`exit ${result.code}, expected ${exit}`);
        for (const s of has) if (!result.out.includes(s)) wrong.push(`missing "${s}"`);
        for (const s of lacks) if (result.out.includes(s)) wrong.push(`should not say "${s}"`);

        if (wrong.length) {
            failures.push({ name, wrong });
            console.log(`FAIL  ${name}`);
            for (const w of wrong) console.log(`        ${w}`);
        } else {
            passed++;
            console.log(`ok    ${name}`);
        }
        if (verbose) console.log(result.out.split("\n").map((l) => `      | ${l}`).join("\n"));
    };

    /** A subheading, for suites long enough that the list needs shape. */
    const group = (label) => console.log(`\n  ${label}`);

    /** Print the tally and exit. Non-zero when anything failed, so a runner can tell. */
    const finish = () => {
        console.log(`\n${passed} passed, ${failures.length} failed  (${title})`);
        if (failures.length) {
            for (const f of failures) console.log(`  ${f.name}\n    ${f.wrong.join("\n    ")}`);
            process.exit(1);
        }
        process.exit(0);
    };

    return { run, expect, group, finish, repo: REPO };
}
