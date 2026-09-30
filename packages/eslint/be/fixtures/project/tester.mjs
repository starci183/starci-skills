/**
 * The project-rule tester: a hermetic repository on disk (hfs.json, a root tsconfig, the files a case lists) whose project graph
 * the project rules read, and a RuleTester over @typescript-eslint/parser whose `settings.starci.hfs` is that repository's view.
 * A case's `filename` is `at("src/modules/...")`; its `code` is the text of that file (the rules judge the graph, which reads the
 * disk). Used by the back-end and the front-end project rule tests (`profile`).
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { execFileSync } from "node:child_process"
import tsParser from "@typescript-eslint/parser"
import { RuleTester } from "eslint"
import { resetProjectGraphs } from "../../runtime/scripts/lib/project-graph.mjs"
import { hfsFromDeclaration } from "../../lib/hfs.mjs"

const ts = createRequire(import.meta.url)("typescript")
const DEFAULT_APPS = { be: [{ name: "core", kind: "api" }], fe: [{ name: "web", kind: "next" }] }

/**
 * @param {{ profile?: "be" | "fe", files?: Record<string, string | null>, declaration?: object, apps?: object[] }} input
 * @returns {{ root: string, at: (rel: string) => string, tester: RuleTester, cleanup: () => void }}
 */
export const projectFixture = ({ profile = "be", files = {}, declaration = {}, apps = DEFAULT_APPS[profile] } = {}) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `starci-project-${profile}-`))
    const app = apps[0].name
    const extraApps = Object.fromEntries(profile === "fe" ? apps.slice(1).map((other) => [`apps/${other.name}/package.json`, JSON.stringify({ name: `@fixture/${other.name}`, private: true })]) : [])
    const baseline = {
        ...extraApps,
        "hfs.json": `${JSON.stringify({ hfs: 1, profile, project: "fixture", apps, ...declaration }, null, 2)}\n`,
        "package.json": JSON.stringify(profile === "fe" ? { name: "fixture-fe", private: true, workspaces: ["apps/*"] } : { name: "fixture-be", private: true }),
        "tsconfig.json": `${JSON.stringify({
            compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "preserve", allowJs: true, skipLibCheck: true, noEmit: true, experimentalDecorators: true },
            include: ["src/**/*", "apps/**/*"],
        }, null, 2)}\n`,
        ...(profile === "be"
            ? { [`apps/${app}/src/main.ts`]: "void 0;\n", [`apps/${app}/src/app.module.ts`]: "export const AppModule = 1;\n" }
            : { [`apps/${app}/package.json`]: JSON.stringify({ name: `@fixture/${app}`, private: true }), [`apps/${app}/src/app/.keep`]: "" }),
    }
    for (const [rel, content] of Object.entries({ ...baseline, ...files })) {
        if (content === null) continue
        const target = path.join(root, ...rel.split("/"))
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, content)
    }
    // the project graph reads the tracked tree: the fixture is a Git work tree with every file added
    execFileSync("git", ["init", "-q"], { cwd: root })
    execFileSync("git", ["add", "-A"], { cwd: root })
    resetProjectGraphs()
    const hfs = hfsFromDeclaration({ hfs: 1, profile, project: "fixture", apps, ...declaration }, fs.realpathSync(root))
    const tester = new RuleTester({
        languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
        settings: { starci: { hfs, injectedTypeScript: () => ts } },
    })
    return { root: hfs.repoRoot, at: (rel) => path.join(hfs.repoRoot, ...rel.split("/")), tester, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) }
}
