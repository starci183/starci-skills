#!/usr/bin/env node
/**
 * Tests for check-single-source-of-truth.mjs.
 *
 * Each case is named as the CLAIM the gate makes, so a failing run reads as a promise broken. The
 * gate reads a ledger and looks at the disk for `.storybook`/`.claude` markers, so every case
 * builds its own throwaway ledger under `.testtmp/` plus a few marker folders, runs the gate
 * against a COPY of itself (whose `context/workspace.json` is the fabricated one), and asserts the
 * verdict. This machine's own `context/workspace.json` is never read.
 *
 *   node .claude/scripts/workspace/check-single-source-of-truth.test.mjs [--verbose]
 */

import { cpSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { harness, REPO } from "../test-harness.mjs";

const t = harness("check-single-source-of-truth");
const SANDBOX = join(REPO, ".testtmp", "single-sot");
const GATE = join(REPO, "scripts", "workspace", "check-single-source-of-truth.mjs");

let seq = 0;

/** Create a fake source folder with the given marker subfolders, return its absolute path. */
const src = (name, markers = []) => {
    const p = join(SANDBOX, "src", name);
    mkdirSync(p, { recursive: true });
    for (const m of markers) mkdirSync(join(p, m), { recursive: true });
    return p;
};

/**
 * Stand up a skillset holding a copy of the gate and a fabricated ledger, then run it.
 * @param {Record<string, object>} projects  the ledger's `projects`
 * @param {string|null} book  the recorded `design_system.path`, or null to leave it unrecorded
 * @param {{noContext?: boolean}} [opts]  noContext: write no ledger at all
 */
function runGate(projects, book, opts = {}) {
    const skillset = join(SANDBOX, `run${seq++}`, "skillset");
    mkdirSync(join(skillset, "scripts", "workspace"), { recursive: true });
    cpSync(GATE, join(skillset, "scripts", "workspace", "check-single-source-of-truth.mjs"));

    if (!opts.noContext) {
        mkdirSync(join(skillset, "context"), { recursive: true });
        const ledger = { current: Object.keys(projects)[0] ?? null, projects };
        if (book) ledger.design_system = { path: book };
        writeFileSync(join(skillset, "context", "workspace.json"), JSON.stringify(ledger, null, 2));
    }
    return t.run(join(skillset, "scripts", "workspace", "check-single-source-of-truth.mjs"), []);
}

rmSync(SANDBOX, { recursive: true, force: true });
try {
    // rebuild the canonical book after the wipe above
    const book = join(src("starci-academy", [".storybook"]), ".storybook");

    // ---------------------------------------------------------------------
    t.group("a clean ledger");
    {
        const fe = src("nivo-web");
        const be = src("nivo-api");
        t.expect("one book and no stray copies passes",
            runGate({ nivo: { fe: { path: fe }, be: { path: be } } }, book),
            { exit: 0, has: ["ok"] });
    }

    // ---------------------------------------------------------------------
    t.group("a second book");
    {
        const fe = src("mia-mia", [".storybook"]);
        t.expect("a non-canonical FE carrying its own .storybook fails, and is named",
            runGate({ mia: { fe: { path: fe } } }, book),
            { exit: 1, has: ["carries its own .storybook", "mia-mia"] });

        // The canonical repo is the ONE allowed to carry it — that is the whole point.
        const canonFe = src("starci-academy", [".storybook"]);
        t.expect("starci-academy itself may carry the book — it is the one book",
            runGate({ academy: { fe: { path: canonFe } } }, book),
            { exit: 0, has: ["ok"] });
    }

    // ---------------------------------------------------------------------
    t.group("a second .claude");
    {
        const be = src("mia-mia-backend", [".claude"]);
        t.expect("a registered source carrying a .claude fails",
            runGate({ mia: { be: { path: be } } }, book),
            { exit: 1, has: ["carries a .claude"] });
    }

    // ---------------------------------------------------------------------
    t.group("the recorded book");
    {
        const fe = src("nivo-web");
        const elsewhere = join(src("mia-mia", [".storybook"]), ".storybook");
        t.expect("a design_system that is not starci-academy's book fails",
            runGate({ nivo: { fe: { path: fe } } }, elsewhere),
            { exit: 1, has: ["must be starci-academy"] });

        t.expect("a ledger with no book recorded at all fails",
            runGate({ nivo: { fe: { path: fe } } }, null),
            { exit: 1, has: ["not recorded"] });
    }

    // ---------------------------------------------------------------------
    t.group("nothing to police");
    {
        t.expect("with no workspace context the gate passes rather than inventing a violation",
            runGate({}, null, { noContext: true }),
            { exit: 0, has: ["nothing to check"] });
    }
} finally {
    rmSync(SANDBOX, { recursive: true, force: true });
}

t.finish();
