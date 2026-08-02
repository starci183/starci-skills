#!/usr/bin/env node
/**
 * Tests for starci-setup-storybook-generate.
 *
 * Each case is named as the CLAIM the skill makes, so a failing run reads as a promise broken
 * rather than as "test 7 failed".
 *
 * A local bare repo stands in for StarCi's remote — pointed at through `DESIGN_SYSTEM_REPO`,
 * the same override a team with an internal mirror would use. So the clone path is exercised
 * for real, with real `git clone`, and still needs no network.
 *
 *   node .claude/skills/starci-setup-storybook-generate/test.mjs [--verbose]
 */

import { execFileSync } from "node:child_process";
import { cpSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-setup-storybook-generate");
const SANDBOX = join(REPO, ".testtmp", "sb-generate");

/**
 * Build a repo, optionally carrying a usable storybook.
 * @param {string} dir
 * @param {{book?: boolean, config?: boolean, origin?: string}} shape
 */
function makeRepo(dir, shape = {}) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({
        name: dir.split(/[\\/]/).pop(),
        scripts: shape.book ? { storybook: "storybook dev -p 6006" } : {},
    }, null, 2));
    if (shape.book) {
        mkdirSync(join(dir, ".storybook"), { recursive: true });
        if (shape.config !== false) writeFileSync(join(dir, ".storybook", "main.ts"), "export default {}\n");
        // Something other than the config, always. Git does not track empty directories, so a
        // `.storybook/` holding nothing simply vanishes on clone — and then the case meant to
        // test "config missing" ends up testing "folder missing" instead.
        else writeFileSync(join(dir, ".storybook", "preview.tsx"), "export const parameters = {}\n");
    }
    const g = (...a) => execFileSync("git", ["-C", dir, ...a], { stdio: "ignore" });
    g("init", "-q");
    g("config", "user.email", "test@example.invalid");
    g("config", "user.name", "test");
    g("add", "-A");
    g("commit", "-qm", "fixture");
    if (shape.origin) g("remote", "add", "origin", shape.origin);
    return dir;
}

/** Turn a repo into a bare one that can be cloned, standing in for a remote. */
function publish(seed, bareDir) {
    mkdirSync(join(bareDir, ".."), { recursive: true });
    execFileSync("git", ["clone", "--bare", "-q", seed, bareDir], { stdio: "ignore" });
    return bareDir;
}

/** A sandbox with its own scripts and its own ledger. */
function sandbox(root, projects = {}) {
    const skillset = join(root, "skillset");
    mkdirSync(join(skillset, "scripts", "workspace"), { recursive: true });
    cpSync(join(REPO, "scripts", "choose-design-system.mjs"), join(skillset, "scripts", "choose-design-system.mjs"));
    for (const f of ["read-workspace-context.mjs", "register-workspace-source.mjs"]) {
        cpSync(join(REPO, "scripts", "workspace", f), join(skillset, "scripts", "workspace", f));
    }
    mkdirSync(join(skillset, "context"), { recursive: true });
    writeFileSync(join(skillset, "context", "workspace.json"), JSON.stringify({
        current: Object.keys(projects)[0] ?? null,
        written_at: "2026-07-31T00:00:00.000Z",
        projects,
    }, null, 2));

    const run = (script, args = [], env = {}) => {
        const saved = process.env.DESIGN_SYSTEM_REPO;
        if (env.repo) process.env.DESIGN_SYSTEM_REPO = env.repo;
        try {
            return t.run(join(skillset, script), args, root);
        } finally {
            if (env.repo) {
                if (saved === undefined) delete process.env.DESIGN_SYSTEM_REPO;
                else process.env.DESIGN_SYSTEM_REPO = saved;
            }
        }
    };
    run.ledger = () => JSON.parse(readFileSync(join(skillset, "context", "workspace.json"), "utf8"));
    return run;
}

const asProject = (fe) => ({ fe: fe ? { path: fe } : null, be: null });

rmSync(SANDBOX, { recursive: true, force: true });
try {
    // ---------------------------------------------------------------------
    t.group("reuse before fetch");
    {
        const root = join(SANDBOX, "reuse");
        const bare = publish(makeRepo(join(root, "seed"), { book: true }), join(root, "remote", "starci-academy.git"));
        const already = makeRepo(join(root, "already-here"), { book: true, origin: bare });
        const ws = sandbox(root, { app: asProject(already) });

        const r = ws("scripts/choose-design-system.mjs", ["generate", "--into", join(root, "checkouts")], { repo: bare });

        // Cloning a second copy of a design system already on the machine creates two
        // blueprints that diverge, and nothing announces it when they do.
        t.expect("a registered checkout is reused rather than cloned again", r,
            { exit: 0, has: ["already registered", "already-here"] });
        t.expect("nothing was written to the clone target",
            { code: existsSync(join(root, "checkouts")) ? 1 : 0, out: "" }, { exit: 0 });
        t.expect("the reused checkout becomes the ledger's design system",
            ws("scripts/workspace/read-workspace-context.mjs", ["design_system.path"]), { exit: 0, has: ["already-here"] });
    }

    // ---------------------------------------------------------------------
    t.group("fetching when there is nothing here");
    {
        const root = join(SANDBOX, "fetch");
        const bare = publish(makeRepo(join(root, "seed"), { book: true }), join(root, "remote", "starci-academy.git"));
        const app = makeRepo(join(root, "my-app"), {});
        const ws = sandbox(root, { mine: asProject(app) });

        const into = join(root, "checkouts");
        const r = ws("scripts/choose-design-system.mjs", ["generate", "--into", into], { repo: bare });

        t.expect("it clones, and says where before writing", r, { exit: 0, has: ["cloning", into] });
        t.expect("the clone becomes the ledger's design system",
            ws("scripts/workspace/read-workspace-context.mjs", ["design_system.path"]), { exit: 0, has: ["starci-academy"] });
        t.expect("the clone is registered as a source, so nobody later wonders what the folder is",
            { code: ws.ledger().projects["starci-academy"] ? 0 : 1, out: JSON.stringify(ws.ledger().projects ?? {}) },
            { exit: 0, has: ["starci-academy"] });
        t.expect("a second run reuses the clone instead of fetching twice",
            ws("scripts/choose-design-system.mjs", ["generate", "--into", into], { repo: bare }),
            { exit: 0, has: ["already registered"] });
    }

    // ---------------------------------------------------------------------
    t.group("the target folder is occupied");
    {
        const root = join(SANDBOX, "occupied");
        const bare = publish(makeRepo(join(root, "seed"), { book: true }), join(root, "remote", "starci-academy.git"));
        const into = join(root, "checkouts");

        // A folder that merely shares a name is a different thing, and adopting it is how the
        // wrong tree becomes the blueprint for every project at once.
        makeRepo(join(into, "starci-academy"), { book: true, origin: "https://example.invalid/someone/else.git" });
        const ws = sandbox(root, {});
        t.expect("a stranger sitting at the target is refused, not adopted",
            ws("scripts/choose-design-system.mjs", ["generate", "--into", into], { repo: bare }),
            { exit: 1, has: ["is not a checkout of"] });
    }

    {
        const root = join(SANDBOX, "occupied-right");
        const bare = publish(makeRepo(join(root, "seed"), { book: true }), join(root, "remote", "starci-academy.git"));
        const into = join(root, "checkouts");
        makeRepo(join(into, "starci-academy"), { book: true, origin: bare });
        const ws = sandbox(root, {});
        t.expect("the right checkout sitting at the target is used without cloning over it",
            ws("scripts/choose-design-system.mjs", ["generate", "--into", into], { repo: bare }),
            { exit: 0, has: ["Found an existing checkout"] });
    }

    // ---------------------------------------------------------------------
    t.group("what arrives has to be usable");
    {
        const root = join(SANDBOX, "shell");
        // A repo whose .storybook has no config: a folder, not a design system.
        const bare = publish(makeRepo(join(root, "seed"), { book: true, config: false }), join(root, "remote", "starci-academy.git"));
        const ws = sandbox(root, {});
        t.expect("a checkout without main.* is reported, not recorded as the blueprint",
            ws("scripts/choose-design-system.mjs", ["generate", "--into", join(root, "checkouts")], { repo: bare }),
            { exit: 1, has: ["not usable", "no main."] });
    }

    // ---------------------------------------------------------------------
    t.group("a mirror or a fork");
    {
        const root = join(SANDBOX, "mirror");
        const bare = publish(makeRepo(join(root, "seed"), { book: true }), join(root, "remote", "team-design.git"));
        const ws = sandbox(root, {});
        const into = join(root, "checkouts");

        // Naming the checkout after a constant would leave a mirror in a folder claiming to be
        // something it is not.
        t.expect("the checkout is named after the repo it came from, not after a constant",
            ws("scripts/choose-design-system.mjs", ["generate", "--into", into], { repo: bare }),
            { exit: 0, has: [join(into, "team-design")] });
    }
} finally {
    rmSync(SANDBOX, { recursive: true, force: true });
}

t.finish();
