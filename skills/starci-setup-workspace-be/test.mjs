#!/usr/bin/env node
/**
 * Tests for starci-setup-workspace-be.
 *
 * Each case is named as the CLAIM the skill makes, so a failing run reads as a promise broken
 * rather than as "test 7 failed".
 *
 * Most of these are about the PORT, because that is where a backend answer goes wrong quietly:
 * a path that is wrong fails loudly on the first `ls`, while a port that is wrong just refuses
 * to connect and looks like the server being down.
 *
 *   node .claude/skills/starci-setup-workspace-be/test.mjs [--verbose]
 */

import { execFileSync } from "node:child_process";
import { cpSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { harness, REPO } from "../../scripts/test-harness.mjs";

const t = harness("starci-setup-workspace-be");
const SANDBOX = join(REPO, ".testtmp", "be");

/**
 * Write a fake backend.
 * @param {string} dir
 * @param {{deps?: object, env?: string, config?: {rel: string, body: string}}} shape
 */
function makeRepo(dir, shape = {}) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({
        name: dir.split(/[\\/]/).pop(),
        dependencies: shape.deps ?? { "@nestjs/core": "10" },
    }, null, 2));
    if (shape.env) writeFileSync(join(dir, ".env"), shape.env);
    if (shape.config) {
        mkdirSync(join(dir, shape.config.rel, ".."), { recursive: true });
        const full = join(dir, shape.config.rel);
        mkdirSync(join(full, ".."), { recursive: true });
        writeFileSync(full, shape.config.body);
    }
    return dir;
}

function commitAll(dir) {
    const g = (...a) => execFileSync("git", ["-C", dir, ...a], { stdio: "ignore" });
    g("init", "-q");
    g("config", "user.email", "test@example.invalid");
    g("config", "user.name", "test");
    g("add", "-A");
    g("commit", "-qm", "fixture");
    return dir;
}

function sandboxRunner(root) {
    const skillset = join(root, "skillset");
    mkdirSync(join(skillset, "scripts"), { recursive: true });
    for (const f of ["register-workspace-source.mjs", "read-workspace-context.mjs"]) {
        cpSync(join(REPO, "scripts", f), join(skillset, "scripts", f));
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
            ws("scripts/read-workspace-context.mjs", ["be.url"]), { exit: 1, has: ["register-workspace-source.mjs"] });
    }

    // ---------------------------------------------------------------------
    t.group("where the port comes from");
    {
        const root = join(SANDBOX, "ports");
        const ws = sandboxRunner(root);

        // The code default is what a machine with no .env will actually serve.
        const fromCode = makeRepo(join(root, "api-default"), {
            config: {
                rel: "src/modules/env/config.ts",
                body: `export const envConfig = () => ({\n  services: { core: { port: parseEnvInt({ key: "CORE_PORT", defaultValue: 3001 }) } },\n})\n`,
            },
        });
        t.expect("with no .env, the port is the code's own default, and it says which file said so",
            ws("scripts/register-workspace-source.mjs", ["--dry", "--project", "d", "--be", fromCode]),
            { exit: 0, has: ["http://localhost:3001", "CORE_PORT default in"] });

        // .env wins, because overriding the default is precisely what an .env is for.
        const fromEnv = makeRepo(join(root, "api-env"), {
            env: "CORE_PORT=4100\n",
            config: {
                rel: "src/modules/env/config.ts",
                body: `parseEnvInt({ key: "CORE_PORT", defaultValue: 3001 })\n`,
            },
        });
        t.expect("an .env port beats the code default",
            ws("scripts/register-workspace-source.mjs", ["--dry", "--project", "e", "--be", fromEnv]),
            { exit: 0, has: ["http://localhost:4100", "CORE_PORT in .env"] });

        // Not every project calls it CORE_PORT.
        const plainPort = makeRepo(join(root, "api-plain"), { env: "PORT=8080\n" });
        t.expect("a project that simply says PORT is read too",
            ws("scripts/register-workspace-source.mjs", ["--dry", "--project", "p", "--be", plainPort]),
            { exit: 0, has: ["http://localhost:8080"] });

        // Silence beats a guess: a made-up port fails at call time, far from its cause.
        const noPort = makeRepo(join(root, "api-silent"));
        ws("scripts/register-workspace-source.mjs", ["--project", "s", "--be", noPort]);
        t.expect("a project that states no port answers null rather than inventing one",
            ws("scripts/read-workspace-context.mjs", ["be.url"]), { exit: 1, has: ["no value at"] });
    }

    // ---------------------------------------------------------------------
    t.group("a back end, stated");
    {
        const root = join(SANDBOX, "stated");
        const ws = sandboxRunner(root);
        const be = commitAll(makeRepo(join(root, "shop-api"), {
            deps: { "@nestjs/core": "10" },
            env: "CORE_PORT=4000\n",
        }));

        const r = ws("scripts/register-workspace-source.mjs", ["--project", "shop", "--be", be]);
        t.expect("a repo named nothing like ours is accepted, and annotated by its dependency", r,
            { exit: 0, has: ["shop-api", "depends on @nestjs/core"] });
        t.expect("the last commit is recorded, so a stale checkout is visible at a glance", r,
            { exit: 0, has: ["fixture"] });
        t.expect("one value prints bare, with no label to strip",
            ws("scripts/read-workspace-context.mjs", ["be.url"]), { exit: 0, has: ["4000"], lacks: ["url  "] });
        t.expect("--check passes for a project that states only a back end",
            ws("scripts/register-workspace-source.mjs", ["--check"]), { exit: 0, has: ["ok"] });

        rmSync(be, { recursive: true, force: true });
        t.expect("--check fails once the recorded tree is gone",
            ws("scripts/register-workspace-source.mjs", ["--check"]), { exit: 1, has: ["does not exist"] });
    }

    // ---------------------------------------------------------------------
    t.group("a source stated wrong");
    {
        const root = join(SANDBOX, "wrong");
        const ws = sandboxRunner(root);

        t.expect("a path that does not exist is refused, and says which path",
            ws("scripts/register-workspace-source.mjs", ["--dry", "--be", join(root, "nope")]),
            { exit: 1, has: ["does not exist", "nope"] });

        // This is the case that once recorded the backend as the front end as well, because it
        // carries vite to build an internal dashboard — and every FE lookup then hit the API.
        const both = makeRepo(join(root, "monolith"), { deps: { "@nestjs/core": "10", vite: "5" } });
        t.expect("one folder cannot be registered as both roles",
            ws("scripts/register-workspace-source.mjs", [both, both]), { exit: 1, has: ["same folder"] });

        const express = makeRepo(join(root, "legacy-api"), { deps: { express: "4" } });
        t.expect("a non-Nest server is recognised as a back end too",
            ws("scripts/register-workspace-source.mjs", ["--dry", "--project", "l", "--be", express]),
            { exit: 0, has: ["depends on express"] });
    }
} finally {
    rmSync(SANDBOX, { recursive: true, force: true });
}

t.finish();
