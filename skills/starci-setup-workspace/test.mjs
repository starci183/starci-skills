#!/usr/bin/env node
/**
 * Tests for starci-setup-workspace.
 *
 * Each case is named as the CLAIM the skill makes, so a failing run reads as a promise broken
 * rather than as "test 7 failed".
 *
 * The suite builds repos in `.testtmp/` and deletes them again, including a local bare repo
 * standing in for a remote — so nothing needs the network, and this machine's own
 * `context/workspace.json` is never touched.
 *
 * What it cannot test: whether an agent holding this skill actually asks for `fe.path` instead
 * of remembering one. That needs an eval — see README.md.
 *
 *   node .claude/skills/starci-setup-workspace/test.mjs [--verbose]
 */

import { execFileSync } from "node:child_process";
import { cpSync, rmSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-setup-workspace");
const SANDBOX = join(REPO, ".testtmp", "fe");

/** Write a fake repo. */
function makeRepo(dir, shape = {}) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({
        name: dir.split(/[\\/]/).pop(),
        dependencies: shape.deps ?? {},
        devDependencies: shape.devDeps ?? {},
        scripts: shape.scripts ?? {},
    }, null, 2));
    if (shape.storybook) mkdirSync(join(dir, ".storybook"), { recursive: true });
    if (shape.artifacts) mkdirSync(join(dir, ".artifacts"), { recursive: true });
    return dir;
}

/** Make it a git repo with one commit, so branch and head are real values. */
function commitAll(dir, origin) {
    const g = (...a) => execFileSync("git", ["-C", dir, ...a], { stdio: "ignore" });
    g("init", "-q");
    g("config", "user.email", "test@example.invalid");
    g("config", "user.name", "test");
    g("add", "-A");
    g("commit", "-qm", "fixture");
    if (origin) g("remote", "add", "origin", origin);
    return dir;
}

/** A sandbox with its own copy of the scripts, so it writes its own context. */
function sandboxRunner(root) {
    const skillset = join(root, "skillset");
    mkdirSync(join(skillset, "scripts", "workspace"), { recursive: true });
    for (const f of ["register-workspace-source.mjs", "read-workspace-context.mjs"]) {
        cpSync(join(REPO, "scripts", "workspace", f), join(skillset, "scripts", "workspace", f));
    }
    return (script, args = []) => t.run(join(skillset, script), args, root);
}

rmSync(SANDBOX, { recursive: true, force: true });
try {
    // ---------------------------------------------------------------------
    t.group("nothing registered yet");
    {
        const ws = sandboxRunner(join(SANDBOX, "fresh"));
        t.expect("asking before setup exits 1 with the command that fixes it",
            ws("scripts/workspace/read-workspace-context.mjs", ["fe.path"]), { exit: 1, has: ["register-workspace-source.mjs"] });
        t.expect("setup with no arguments asks for the source instead of looking for one",
            ws("scripts/workspace/register-workspace-source.mjs", []), { exit: 1, has: ["does not look for them"] });
    }

    // ---------------------------------------------------------------------
    t.group("a front end, stated");
    {
        const root = join(SANDBOX, "stated");
        const ws = sandboxRunner(root);
        const fe = commitAll(makeRepo(join(root, "shop-web"), {
            deps: { next: "15" },
            scripts: { dev: "next dev", storybook: "storybook dev -p 7007" },
            storybook: true,
            artifacts: true,
        }));

        const r = ws("scripts/workspace/register-workspace-source.mjs", ["--project", "shop", "--fe", fe]);

        t.expect("a repo named nothing like ours is accepted, and annotated by its dependency", r,
            { exit: 0, has: ["shop-web", "depends on next"] });
        t.expect("the storybook port comes from the repo's own script, not from habit", r,
            { exit: 0, has: ["http://localhost:7007"] });
        t.expect("a dev script with no port falls back to the framework default, and says which", r,
            { exit: 0, has: ["http://localhost:3000", "default"] });
        t.expect("the last commit is recorded, so a stale checkout is visible at a glance", r,
            { exit: 0, has: ["fixture"] });
        t.expect("the design-system folder is recorded when the project has one",
            ws("scripts/workspace/read-workspace-context.mjs", ["fe.design_system"]), { exit: 0, has: [".storybook"] });
        t.expect("the artifacts folder is recorded when the project has one",
            ws("scripts/workspace/read-workspace-context.mjs", ["fe.artifacts"]), { exit: 0, has: [".artifacts"] });
        t.expect("one value prints bare, with no label to strip",
            ws("scripts/workspace/read-workspace-context.mjs", ["fe.path"]), { exit: 0, lacks: ["path  ", "project "] });
        t.expect("--check passes while the tree is there",
            ws("scripts/workspace/register-workspace-source.mjs", ["--check"]), { exit: 0, has: ["ok"] });
    }

    // ---------------------------------------------------------------------
    t.group("a front end without a design system");
    {
        const root = join(SANDBOX, "plainfe");
        const ws = sandboxRunner(root);
        const fe = makeRepo(join(root, "tiny-web"), { deps: { vite: "5" }, scripts: {} });
        ws("scripts/workspace/register-workspace-source.mjs", ["--project", "tiny", "--fe", fe]);

        // A project with no `.storybook/` is not broken — it has no design-system lane, and
        // null says that honestly rather than pretending a folder exists.
        t.expect("a missing design system answers null rather than a made-up path",
            ws("scripts/workspace/read-workspace-context.mjs", ["fe.design_system"]), { exit: 1, has: ["no value at"] });
        t.expect("the dev port still resolves from the framework default",
            ws("scripts/workspace/read-workspace-context.mjs", ["fe.url"]), { exit: 0, has: ["5173"] });
    }

    // ---------------------------------------------------------------------
    t.group("a source stated wrong");
    {
        const root = join(SANDBOX, "wrong");
        const ws = sandboxRunner(root);

        // The reason has to survive to the surface. An earlier ordering ran the naming step
        // first, so a missing folder came back as "could not name this project" — the symptom
        // printed in place of the cause.
        t.expect("a path that does not exist is refused, and says which path",
            ws("scripts/workspace/register-workspace-source.mjs", ["--dry", "--fe", join(root, "nope")]),
            { exit: 1, has: ["does not exist", "nope"] });

        const empty = join(root, "empty");
        mkdirSync(empty, { recursive: true });
        t.expect("an empty folder is refused — a checkout that never happened is not a source",
            ws("scripts/workspace/register-workspace-source.mjs", ["--dry", "--fe", empty]), { exit: 1, has: ["is empty"] });

        const plain = makeRepo(join(root, "plain"), { deps: { lodash: "4" } });
        t.expect("a stack the list has never met is accepted, and flagged as unconfirmed",
            ws("scripts/workspace/register-workspace-source.mjs", ["--dry", "--fe", plain]),
            { has: ["no known dependency of this role"] });
    }

    // ---------------------------------------------------------------------
    t.group("a git URL");
    {
        const root = join(SANDBOX, "cloning");
        const ws = sandboxRunner(root);
        const seed = commitAll(makeRepo(join(root, "seed"), { deps: { next: "15" } }));
        const origin = join(root, "origin", "widget-web.git");
        mkdirSync(join(root, "origin"), { recursive: true });
        execFileSync("git", ["clone", "--bare", "-q", seed, origin], { stdio: "ignore" });

        const into = join(root, "checkouts");
        t.expect("a git URL is cloned, and the clone is what gets recorded",
            ws("scripts/workspace/register-workspace-source.mjs", ["--project", "widget", "--fe", origin, "--into", into]),
            { exit: 0, has: ["cloned from", join(into, "widget-web")] });
        t.expect("running it again reuses the clone instead of cloning twice",
            ws("scripts/workspace/register-workspace-source.mjs", ["--project", "widget", "--fe", origin, "--into", into]),
            { exit: 0, has: ["already cloned"] });

        const elsewhere = join(root, "elsewhere");
        commitAll(makeRepo(join(elsewhere, "widget-web"), { deps: { next: "15" } }), "https://example.invalid/other.git");
        t.expect("a folder of the same name but another origin is refused, not adopted",
            ws("scripts/workspace/register-workspace-source.mjs", ["--dry", "--fe", origin, "--into", elsewhere]),
            { exit: 1, has: ["its origin is"] });
    }

    // ---------------------------------------------------------------------
    t.group("several projects on one machine");
    {
        const root = join(SANDBOX, "registry");
        const ws = sandboxRunner(root);
        const a = makeRepo(join(root, "a-web"), { deps: { next: "15" } });
        const b = makeRepo(join(root, "b-web"), { deps: { nuxt: "3" } });
        ws("scripts/workspace/register-workspace-source.mjs", ["--project", "alpha", "--fe", a]);
        ws("scripts/workspace/register-workspace-source.mjs", ["--project", "beta", "--fe", b]);

        t.expect("the last project registered becomes current",
            ws("scripts/workspace/read-workspace-context.mjs", ["fe.path"]), { exit: 0, has: ["b-web"] });
        t.expect("--use switches which project answers",
            (ws("scripts/workspace/register-workspace-source.mjs", ["--use", "alpha"]), ws("scripts/workspace/read-workspace-context.mjs", ["fe.path"])),
            { exit: 0, has: ["a-web"] });
        t.expect("--list marks the current project",
            ws("scripts/workspace/register-workspace-source.mjs", ["--list"]), { exit: 0, has: ["alpha", "beta", "* = current"] });
        t.expect("a key that does not exist fails loudly and lists the real ones",
            ws("scripts/workspace/read-workspace-context.mjs", ["fe.nonexistent"]), { exit: 1, has: ["known keys:", "fe.path"] });

        rmSync(a, { recursive: true, force: true });
        t.expect("--check fails once the recorded tree is gone",
            ws("scripts/workspace/register-workspace-source.mjs", ["--check"]), { exit: 1, has: ["does not exist"] });
    }
} finally {
    rmSync(SANDBOX, { recursive: true, force: true });
}

t.finish();
