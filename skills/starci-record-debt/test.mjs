#!/usr/bin/env node
/**
 * Tests for starci-record-debt.
 *
 * Each case is named as the CLAIM the skill makes, so a failing run reads as a promise broken
 * rather than as "test 7 failed".
 *
 * Entries are written into `.testtmp/debt/` via `CLAUDE_DEBT_DIR`, never into the real `debt/`
 * folder. A suite that has to be pointed away from production data by hand is one mistake away
 * from eating it.
 *
 * The `claude` role resolves to this skill set's own root without consulting the workspace
 * registry, which is what lets `--check` be tested with real files on any machine — including one
 * that has never run setup.
 *
 * What it cannot test: whether an agent holding this skill actually reaches for it when a fix is
 * deferred, rather than moving on silently. That is a property of the frontmatter description and
 * needs an eval — see README.md.
 *
 *   node .claude/skills/starci-record-debt/test.mjs [--verbose]
 */

import { rmSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-record-debt");
const SANDBOX = join(REPO, ".testtmp", "debt");
const SCRIPT = "scripts/record-technical-debt.mjs";

/** Every child process inherits this, so no case can reach the real notes. */
process.env.CLAUDE_DEBT_DIR = SANDBOX;

const reset = () => {
    rmSync(SANDBOX, { recursive: true, force: true });
    mkdirSync(SANDBOX, { recursive: true });
};

/** The shortest command that is accepted, so a case can vary one thing at a time. */
const ADD = ["add", "--title", "Atoms still accept className", "--why", "The composites forward an opaque string"];

// ---- what it refuses ------------------------------------------------------

t.group("what it refuses to record");

reset();

t.expect(
    "a deferral with no reason is refused — the reason is the only part the code cannot show later",
    t.run(SCRIPT, ["add", "--title", "Something is wrong"]),
    { exit: 1, has: ["--why", "cannot recover from the code", "it is a task"] },
);

t.expect(
    "a deferral with no title is refused",
    t.run(SCRIPT, ["add", "--why", "no time"]),
    { exit: 1, has: ["--title"] },
);

t.expect(
    "an absolute path is refused — it is true on exactly one machine",
    t.run(SCRIPT, [...ADD, "--path", "C:\\Repositories\\thing\\src"]),
    { exit: 1, has: ["not absolute", "per-machine"] },
);

t.expect(
    "a posix absolute path is refused too",
    t.run(SCRIPT, [...ADD, "--path", "/home/me/thing/src"]),
    { exit: 1, has: ["not absolute"] },
);

t.expect(
    "an unknown role is refused, and the message lists the real ones",
    t.run(SCRIPT, [...ADD, "--role", "frontend"]),
    { exit: 1, has: ["--role", "fe", "be", "design_system", "claude"] },
);

t.expect(
    "an unknown cost is refused",
    t.run(SCRIPT, [...ADD, "--cost", "huge"]),
    { exit: 1, has: ["--cost", "small", "medium", "large"] },
);

t.expect(
    "a flag with no value is refused rather than swallowing the next argument",
    t.run(SCRIPT, ["add", "--title"]),
    { exit: 1, has: ["--title needs a value"] },
);

// ---- what it records ------------------------------------------------------

t.group("what it records");

reset();

t.expect(
    "a complete deferral is recorded, and the command says where",
    t.run(SCRIPT, [...ADD, "--role", "fe", "--rule", "ATOM-5", "--cost", "medium",
        "--path", ".storybook/components/atoms", "--id", "atoms-take-classname"]),
    { exit: 0, has: ["recorded", "atoms-take-classname"] },
);

const entry = existsSync(join(SANDBOX, "atoms-take-classname.md"))
    ? readFileSync(join(SANDBOX, "atoms-take-classname.md"), "utf8")
    : "";

t.expect(
    "the entry keeps the reason under its own heading, where a reader will find it",
    { code: 0, out: entry },
    { has: ["## Why it was left", "The composites forward an opaque string"] },
);

t.expect(
    "the entry keeps role, rule and state as fields a filter can read",
    { code: 0, out: entry },
    { has: ["role: fe", "rule: ATOM-5", "state: open", "paths: [.storybook/components/atoms]"] },
);

t.expect(
    "recording the same thing twice is refused — one deferral is one debt, whatever day it is",
    t.run(SCRIPT, [...ADD, "--id", "atoms-take-classname"]),
    { exit: 1, has: ["already exists"] },
);

t.expect(
    "a long title becomes a handle cut at a word boundary, never mid-word",
    t.run(SCRIPT, ["add", "--why", "later", "--title",
        "Chip has no width guard so a long label is capped with max-w-40 at the call site"]),
    { exit: 0, lacks: ["with-max-w\n", "max-w."] },
);

// ---- reading it back ------------------------------------------------------

t.group("reading it back");

t.expect(
    "list shows what is open, with the rule it breaks",
    t.run(SCRIPT, ["list"]),
    { exit: 0, has: ["atoms-take-classname", "ATOM-5", "open"] },
);

t.expect(
    "list filters by role",
    t.run(SCRIPT, ["list", "--role", "be"]),
    { exit: 0, has: ["Nothing matches"], lacks: ["atoms-take-classname"] },
);

t.expect(
    "show prints the whole entry",
    t.run(SCRIPT, ["show", "atoms-take-classname"]),
    { exit: 0, has: ["## Why it was left"] },
);

t.expect(
    "show on an id that does not exist says how to find the ones that do",
    t.run(SCRIPT, ["show", "no-such-debt"]),
    { exit: 1, has: ["no debt with id", "list --all"] },
);

// ---- closing --------------------------------------------------------------

t.group("closing");

t.expect(
    "closing without saying what settled it is refused",
    t.run(SCRIPT, ["close", "atoms-take-classname"]),
    { exit: 1, has: ["--how"] },
);

t.expect(
    "closing records how it was settled",
    t.run(SCRIPT, ["close", "atoms-take-classname", "--how", "Narrowed the composite props too"]),
    { exit: 0, has: ["closed"] },
);

t.expect(
    "a closed entry is kept, not deleted — it is the evidence the shape was considered",
    { code: 0, out: readFileSync(join(SANDBOX, "atoms-take-classname.md"), "utf8") },
    { has: ["state: closed", "## Paid", "Narrowed the composite props too", "## Why it was left"] },
);

t.expect(
    "a closed entry drops out of the default list",
    t.run(SCRIPT, ["list"]),
    { exit: 0, lacks: ["atoms-take-classname"] },
);

t.expect(
    "and is still findable with --closed",
    t.run(SCRIPT, ["list", "--closed"]),
    { exit: 0, has: ["atoms-take-classname"] },
);

t.expect(
    "closing twice is refused",
    t.run(SCRIPT, ["close", "atoms-take-classname", "--how", "again"]),
    { exit: 1, has: ["already closed"] },
);

// ---- --check --------------------------------------------------------------

t.group("--check, against real files");

reset();

t.run(SCRIPT, ["add", "--id", "still-there", "--title", "A path that exists", "--why", "later",
    "--role", "claude", "--path", "scripts/record-technical-debt.mjs"]);

t.expect(
    "a debt whose files are all still there passes quietly",
    t.run(SCRIPT, ["--check"]),
    { exit: 0, has: ["1 open", "0 with vanished paths"] },
);

t.run(SCRIPT, ["add", "--id", "moved-away", "--title", "A path that is gone", "--why", "later",
    "--role", "claude", "--path", "scripts/this-was-deleted.mjs"]);

t.expect(
    "a vanished path is reported, and both things it could mean are spelled out",
    t.run(SCRIPT, ["--check"]),
    { exit: 2, has: ["moved-away", "gone:", "paid and the entry was never closed", "code moved"] },
);

t.expect(
    "--check takes no value, so it does not swallow the word after it",
    t.run(SCRIPT, ["--check", "list"]),
    { exit: 2, has: ["moved-away"], lacks: ["unknown command"] },
);

reset();

t.run(SCRIPT, ["add", "--id", "elsewhere", "--title", "In a tree this machine may not have",
    "--why", "later", "--role", "be", "--path", "src/app.module.ts"]);

const beCheck = t.run(SCRIPT, ["--check"]);
t.expect(
    "an unregistered role is reported apart from a missing file — they mean different things",
    beCheck,
    beCheck.out.includes("not registered")
        ? { has: ["not registered", "unresolvable role"] }
        // A machine that HAS a backend registered answers the other way, and that is also correct:
        // the case is that the two outcomes are never conflated, not that one of them happens.
        : { has: ["0 unresolvable role"] },
);

rmSync(join(REPO, ".testtmp"), { recursive: true, force: true });
t.finish();
