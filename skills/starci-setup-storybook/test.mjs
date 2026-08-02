#!/usr/bin/env node
/**
 * Tests for starci-setup-storybook.
 *
 * Each case is named as the CLAIM the skill makes, so a failing run reads as a promise broken
 * rather than as "test 7 failed".
 *
 * The skill has two lanes over one ledger key — choosing among what is already registered, and
 * fetching the canonical book when nothing is — and both are exercised here. A local bare repo
 * stands in for StarCi's remote — pointed at through `DESIGN_SYSTEM_REPO`, the same override a
 * team with an internal mirror would use — so the clone path runs a real `git clone` and still
 * needs no network.
 *
 * Everything is built under `.testtmp/` and deleted again — fake repos, fake ledgers, and that
 * local bare repo. This machine's own `context/workspace.json` is never read or written.
 *
 * What it cannot test: whether an agent holding this skill actually asks for
 * `design_system.path` instead of assuming a folder, or reaches for the right lane once it is
 * here. That needs an eval — see README.md.
 *
 *   node .claude/skills/starci-setup-storybook/test.mjs [--verbose]
 */

import { execFileSync } from "node:child_process";
import { cpSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-setup-storybook");
const SANDBOX = join(REPO, ".testtmp", "sb-setup");

/** The URL every fixture pretends the canonical repo lives at, for the "choose" cases. */
const FAKE_CANON = "https://example.invalid/acme/design-book.git";

/**
 * Build a repo, optionally with a storybook.
 * @param {string} dir
 * @param {{config?: boolean, script?: boolean, folder?: boolean, origin?: string}} shape
 *   `folder` create `.storybook/` at all · `config` put a main.ts in it ·
 *   `script` declare a storybook script · `origin` set a git remote
 */
function makeRepo(dir, shape = {}) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({
        name: dir.split(/[\\/]/).pop(),
        scripts: shape.script ? { storybook: "storybook dev -p 6006" } : {},
    }, null, 2));
    if (shape.folder) {
        mkdirSync(join(dir, ".storybook"), { recursive: true });
        if (shape.config) {
            writeFileSync(join(dir, ".storybook", "main.ts"), "export default {}\n");
        } else {
            // Something other than the config, always. Git does not track empty directories, so
            // a `.storybook/` holding nothing simply vanishes once cloned — and then a case meant
            // to test "config missing" would quietly test "folder missing" instead.
            writeFileSync(join(dir, ".storybook", "preview.tsx"), "export const parameters = {}\n");
        }
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

/**
 * A sandbox holding its own copy of the scripts and its own ledger.
 * @param {string} root
 * @param {Record<string, object>} projects what the ledger says is registered
 */
function sandbox(root, projects) {
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

    /**
     * @param {string} script
     * @param {string[]} [args]
     * @param {{repo?: string}} [env] `repo` sets DESIGN_SYSTEM_REPO for this call only
     */
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

const asProject = (fe, be = null) => ({ fe: fe ? { path: fe } : null, be: be ? { path: be } : null });

rmSync(SANDBOX, { recursive: true, force: true });
try {
    // === choosing among what is already on the machine ========================

    // ---------------------------------------------------------------------
    t.group("nothing to choose from");
    {
        const root = join(SANDBOX, "none");
        const app = makeRepo(join(root, "app"), {});
        const ws = sandbox(root, { app: asProject(app) });

        t.expect("with no storybook anywhere, listing says so and exits 1",
            ws("scripts/choose-design-system.mjs"), { exit: 1, has: ["No registered source carries"] });
        t.expect("choose points at the fetching lane rather than failing blankly",
            ws("scripts/choose-design-system.mjs", ["choose"]), { exit: 1, has: ["generate"] });
    }

    // ---------------------------------------------------------------------
    t.group("a folder is not a storybook");
    {
        const root = join(SANDBOX, "shell");
        const noConfig = makeRepo(join(root, "no-config"), { folder: true, script: true });
        const noScript = makeRepo(join(root, "no-script"), { folder: true, config: true });
        const ws = sandbox(root, { a: asProject(noConfig), b: asProject(noScript) });

        // The workspace record marks fe.design_system from existsSync alone, so an empty
        // .storybook/ satisfies it. Adopting that would point the ecosystem at a shell.
        t.expect("a .storybook with no main.* is refused, and the missing half is named",
            ws("scripts/choose-design-system.mjs", ["choose", noConfig]), { exit: 1, has: ["no main."] });
        t.expect("a .storybook with no storybook script is refused, and says which half",
            ws("scripts/choose-design-system.mjs", ["choose", noScript]), { exit: 1, has: ["no storybook script"] });
        t.expect("neither shell is offered as a candidate",
            ws("scripts/choose-design-system.mjs", ["choose"]), { exit: 1, has: ["No registered source carries a usable"] });
    }

    // ---------------------------------------------------------------------
    t.group("one usable storybook in the ledger");
    {
        const root = join(SANDBOX, "one");
        const book = makeRepo(join(root, "design-app"), { folder: true, config: true, script: true });
        const plain = makeRepo(join(root, "other-app"), {});
        const ws = sandbox(root, { alpha: asProject(book), beta: asProject(plain) });

        t.expect("the single usable storybook is adopted without being asked twice",
            ws("scripts/choose-design-system.mjs", ["choose"]), { exit: 0, has: ["design system for this ledger", "design-app"] });
        t.expect("the ledger records it at the top level, not inside a project",
            { code: ws.ledger().design_system ? 0 : 1, out: JSON.stringify(ws.ledger().design_system ?? {}) },
            { exit: 0, has: ["design-app", "\"from\""] });
        t.expect("the recorded commit is kept, so drift can be reported later",
            { code: 0, out: JSON.stringify(ws.ledger().design_system) }, { has: ["commit"] });
        t.expect("workspace.mjs answers design_system.path for the current project",
            ws("scripts/workspace/read-workspace-context.mjs", ["design_system.path"]), { exit: 0, has: ["design-app"] });

        // This is the whole point of holding it at ledger level rather than per project.
        execFileSync(process.execPath, [join(root, "skillset", "scripts", "workspace", "register-workspace-source.mjs"), "--use", "beta"], { cwd: root, stdio: "ignore" });
        t.expect("a project with no storybook of its own still reads the ecosystem's",
            ws("scripts/workspace/read-workspace-context.mjs", ["design_system.path"]), { exit: 0, has: ["design-app"] });
    }

    // ---------------------------------------------------------------------
    t.group("more than one usable storybook");
    {
        const root = join(SANDBOX, "several");
        const a = makeRepo(join(root, "book-a"), { folder: true, config: true, script: true });
        const b = makeRepo(join(root, "book-b"), { folder: true, config: true, script: true });
        const ws = sandbox(root, { one: asProject(a), two: asProject(b) });

        t.expect("with two equal candidates it refuses to pick, and lists both",
            ws("scripts/choose-design-system.mjs", ["choose"]), { exit: 1, has: ["say which", "book-a", "book-b"] });

        // The bias is the canonical book — deliberately, and by origin rather than by folder name.
        const s = makeRepo(join(root, "some-fork"), { folder: true, config: true, script: true, origin: FAKE_CANON });
        const ws2 = sandbox(join(root, "biased"), { one: asProject(a), canon: asProject(s) });
        process.env.DESIGN_SYSTEM_REPO = FAKE_CANON;
        t.expect("the canonical checkout wins over an equally valid stranger, identified by origin",
            ws2("scripts/choose-design-system.mjs", ["choose"]), { exit: 0, has: ["some-fork", "canonical"] });
        delete process.env.DESIGN_SYSTEM_REPO;
    }

    // ---------------------------------------------------------------------
    t.group("adopting one you built yourself");
    {
        const root = join(SANDBOX, "own");
        const mine = makeRepo(join(root, "my-book"), { folder: true, config: true, script: true });
        const other = makeRepo(join(root, "their-book"), { folder: true, config: true, script: true });
        const ws = sandbox(root, { app: asProject(other) });

        // Building your own is a deliberate act, so claiming it is one too — an unregistered
        // storybook is never noticed and adopted on your behalf.
        t.expect("a storybook outside the ledger is adopted only when named",
            ws("scripts/choose-design-system.mjs", ["choose", mine]), { exit: 0, has: ["my-book", "stated as"] });
        t.expect("pointing at the .storybook folder itself works as well as at the repo",
            ws("scripts/choose-design-system.mjs", ["choose", join(mine, ".storybook")]), { exit: 0, has: ["my-book"] });
        t.expect("a path with no .storybook at all is refused",
            ws("scripts/choose-design-system.mjs", ["choose", join(root, "nowhere")]), { exit: 1, has: ["No .storybook folder"] });
    }

    // ---------------------------------------------------------------------
    t.group("--check");
    {
        const root = join(SANDBOX, "check");
        const book = makeRepo(join(root, "book"), { folder: true, config: true, script: true });
        const ws = sandbox(root, { app: asProject(book) });
        ws("scripts/choose-design-system.mjs", ["choose"]);

        t.expect("--check passes while the book is there and usable",
            ws("scripts/choose-design-system.mjs", ["--check"]), { exit: 0, has: ["ok"] });

        // A moved commit is not an error — a blueprint is allowed to change — but it is how two
        // machines end up disagreeing about what the design system says.
        writeFileSync(join(book, "note.txt"), "later\n");
        execFileSync("git", ["-C", book, "add", "-A"], { stdio: "ignore" });
        execFileSync("git", ["-C", book, "commit", "-qm", "moved"], { stdio: "ignore" });
        t.expect("a commit that moved since it was recorded is warned about, not failed",
            ws("scripts/choose-design-system.mjs", ["--check"]), { exit: 0, has: ["WARN", "moved"] });

        rmSync(join(book, ".storybook"), { recursive: true, force: true });
        t.expect("--check fails once the book stops being usable",
            ws("scripts/choose-design-system.mjs", ["--check"]), { exit: 1, has: ["FAIL"] });
    }

    // ---------------------------------------------------------------------
    t.group("no ledger at all");
    {
        const root = join(SANDBOX, "noledger");
        const skillset = join(root, "skillset");
        mkdirSync(join(skillset, "scripts"), { recursive: true });
        cpSync(join(REPO, "scripts", "choose-design-system.mjs"), join(skillset, "scripts", "choose-design-system.mjs"));
        mkdirSync(join(skillset, "scripts", "workspace"), { recursive: true });
        cpSync(join(REPO, "scripts", "workspace", "read-workspace-context.mjs"), join(skillset, "scripts", "workspace", "read-workspace-context.mjs"));
        t.expect("without a workspace context it names the command that creates one",
            t.run(join(skillset, "scripts/choose-design-system.mjs"), [], root),
            { exit: 1, has: ["register-workspace-source.mjs"] });
    }

    // === fetching the canonical book when there is nothing to choose from =====

    // ---------------------------------------------------------------------
    t.group("generate: reuse before fetch");
    {
        const root = join(SANDBOX, "reuse");
        const bare = publish(makeRepo(join(root, "seed"), { folder: true, config: true, script: true }), join(root, "remote", "starci-academy.git"));
        const already = makeRepo(join(root, "already-here"), { folder: true, config: true, script: true, origin: bare });
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
    t.group("generate: fetching when there is nothing here");
    {
        const root = join(SANDBOX, "fetch");
        const bare = publish(makeRepo(join(root, "seed"), { folder: true, config: true, script: true }), join(root, "remote", "starci-academy.git"));
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
    t.group("generate: the target folder is occupied");
    {
        const root = join(SANDBOX, "occupied");
        const bare = publish(makeRepo(join(root, "seed"), { folder: true, config: true, script: true }), join(root, "remote", "starci-academy.git"));
        const into = join(root, "checkouts");

        // A folder that merely shares a name is a different thing, and adopting it is how the
        // wrong tree becomes the blueprint for every project at once.
        makeRepo(join(into, "starci-academy"), { folder: true, config: true, script: true, origin: "https://example.invalid/someone/else.git" });
        const ws = sandbox(root, {});
        t.expect("a stranger sitting at the target is refused, not adopted",
            ws("scripts/choose-design-system.mjs", ["generate", "--into", into], { repo: bare }),
            { exit: 1, has: ["is not a checkout of"] });
    }

    {
        const root = join(SANDBOX, "occupied-right");
        const bare = publish(makeRepo(join(root, "seed"), { folder: true, config: true, script: true }), join(root, "remote", "starci-academy.git"));
        const into = join(root, "checkouts");
        makeRepo(join(into, "starci-academy"), { folder: true, config: true, script: true, origin: bare });
        const ws = sandbox(root, {});
        t.expect("the right checkout sitting at the target is used without cloning over it",
            ws("scripts/choose-design-system.mjs", ["generate", "--into", into], { repo: bare }),
            { exit: 0, has: ["Found an existing checkout"] });
    }

    // ---------------------------------------------------------------------
    t.group("generate: what arrives has to be usable");
    {
        const root = join(SANDBOX, "shell-fetched");
        // A repo whose .storybook has no config: a folder, not a design system.
        const bare = publish(makeRepo(join(root, "seed"), { folder: true, config: false, script: true }), join(root, "remote", "starci-academy.git"));
        const ws = sandbox(root, {});
        t.expect("a checkout without main.* is reported, not recorded as the blueprint",
            ws("scripts/choose-design-system.mjs", ["generate", "--into", join(root, "checkouts")], { repo: bare }),
            { exit: 1, has: ["not usable", "no main."] });
    }

    // ---------------------------------------------------------------------
    t.group("generate: a mirror or a fork");
    {
        const root = join(SANDBOX, "mirror");
        const bare = publish(makeRepo(join(root, "seed"), { folder: true, config: true, script: true }), join(root, "remote", "team-design.git"));
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
