/**
 * The project-rule tester: a hermetic app on disk (the app-root hfs.json and package.json, and in the side folder of `profile` a
 * tsconfig and the files a case lists) whose project graph the project rules read, and a RuleTester over @typescript-eslint/parser
 * whose `settings.starci.hfs` is that side's view. `rootFiles` are written at the app root (`.starcistacks/` lives there). A case's `filename` is `at("src/modules/...")`, relative to the side folder; its
 * `code` is the text of that file (the rules judge the graph, which reads the disk). Used by the back-end and the front-end project
 * rule tests (`profile`).
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { execFileSync } from "node:child_process"
import tsParser from "@typescript-eslint/parser"
import { RuleTester } from "eslint"
import { resetProjectGraphs } from "../../runtime/scripts/hfs/project-graph.mjs"
import { declaredHfsView } from "../../runtime/scripts/hfs/view.mjs"
import { appDeclaration } from "../app.mjs"

const ts = createRequire(import.meta.url)("typescript")
const RUNTIME = path.join(import.meta.dirname, "..", "..", "runtime")
const DEFAULT_APPS = { be: [{ name: "core", kind: "api" }], fe: [{ name: "web", kind: "next" }] }

/**
 * @param {{ profile?: "be" | "fe", edition?: "full" | "lite", files?: Record<string, string | null>, rootFiles?: Record<string, string>, declaration?: object, apps?: object[] }} input
 * @returns {{ root: string, at: (rel: string) => string, tester: RuleTester, cleanup: () => void }}
 */
export const projectFixture = ({ profile = "be", edition, files = {}, rootFiles = {}, declaration = {}, apps = DEFAULT_APPS[profile] } = {}) => {
    const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), `starci-project-${profile}-`))
    const root = path.join(appRoot, profile)
    const app = apps[0].name
    const hfsJson = { ...appDeclaration(profile, { apps, ...declaration }), ...(edition ? { edition } : {}) }
    const baseline = {
        "tsconfig.json": `${JSON.stringify({
            compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "preserve", allowJs: true, skipLibCheck: true, noEmit: true, experimentalDecorators: true },
            include: ["src/**/*", "apps/**/*"],
        }, null, 2)}\n`,
        ...(profile === "be"
            ? { [`apps/${app}/src/main.ts`]: "void 0;\n", [`apps/${app}/src/app.module.ts`]: "export const AppModule = 1;\n" }
            : { [`apps/${app}/src/app/.keep`]: "" }),
    }
    const write = (base, rel, content) => {
        const target = path.join(base, ...rel.split("/"))
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, content)
    }
    write(appRoot, "hfs.json", `${JSON.stringify(hfsJson, null, 2)}\n`)
    write(appRoot, "package.json", JSON.stringify({ name: "fixture", private: true }))
    for (const [rel, content] of Object.entries({ ...baseline, ...files })) if (content !== null) write(root, rel, content)
    for (const [rel, content] of Object.entries(rootFiles)) write(appRoot, rel, content)
    // the project graph reads the tracked tree: the fixture app is a Git work tree with every file added
    execFileSync("git", ["init", "-q"], { cwd: appRoot })
    execFileSync("git", ["add", "-A"], { cwd: appRoot })
    resetProjectGraphs()
    const hfs = declaredHfsView({ runtimeRoot: RUNTIME, declaration: hfsJson, repoRoot: fs.realpathSync(root), side: profile })
    const tester = new RuleTester({
        languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
        settings: { starci: { hfs, injectedTypeScript: () => ts } },
    })
    return { root: hfs.repoRoot, at: (rel) => path.join(hfs.repoRoot, ...rel.split("/")), tester, cleanup: () => fs.rmSync(appRoot, { recursive: true, force: true }) }
}
