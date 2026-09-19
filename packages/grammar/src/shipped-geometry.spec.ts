import { readdirSync, readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join, relative, sep } from "node:path"
import { describe, expect, it } from "vitest"

const sourceRoot = fileURLToPath(new URL(".", import.meta.url))

const sourceFiles = (directory: string): ReadonlyArray<string> => readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(path) && !/\.(spec|test)\./.test(path) ? [path] : []
})

const posix = (path: string) => relative(sourceRoot, path).split(sep).join("/")

/**
 * Geometry utilities. A shipped object may not spell its layout in these, in JSX or in a
 * `classNames.ts`: the class only exists if the CONSUMER's Tailwind build scanned this package,
 * and most do not scan `node_modules`.
 */
const GEOMETRY_UTILITY = /^(?:flex|grid|(?:border|rounded)(?:-[\w./[\]()%-]+)?|(?:[wh]|size|p[xytblrse]?|gap(?:-[xy])?)-[\w./[\]()%-]+)$/

const utilityTokens = (source: string): ReadonlyArray<string> => [...source.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`\n$]*)`/g)]
    .flatMap((match) => (match[1] ?? match[2] ?? match[3] ?? "").split(/\s+/))
    .map((token) => token.split(":").at(-1) ?? "")
    .filter((token) => GEOMETRY_UTILITY.test(token))

/**
 * Files that still spell geometry in utilities, recorded rather than silently tolerated.
 *
 * Nothing may be ADDED here: the list only shrinks as each object moves its layout into
 * `src/common/styles.css`. Sidebar was the entry removed in 0.4.3; 0.4.4 paid the rest of it, so
 * the debt is now empty and the check below is the thing that keeps it that way.
 */
const UTILITY_DEBT: ReadonlyArray<string> = []

describe("Shipped geometry", () => {
    const files = [...sourceFiles(join(sourceRoot, "core")), ...sourceFiles(join(sourceRoot, "common"))]
    const offenders = files.filter((file) => utilityTokens(readFileSync(file, "utf8")).length > 0).map(posix)

    it("keeps layout and geometry in the packaged stylesheet, not in Tailwind utilities", () => {
        expect(files.length).toBeGreaterThan(20)
        expect(offenders.filter((file) => !UTILITY_DEBT.includes(file))).toEqual([])
    })

    it("keeps the recorded debt honest, and keeps Sidebar out of it", () => {
        expect(UTILITY_DEBT.filter((file) => !offenders.includes(file))).toEqual([])
        expect(UTILITY_DEBT).not.toContain("core/composition/Sidebar/index.tsx")
        expect(UTILITY_DEBT).not.toContain("core/composition/Sidebar/classNames.ts")
        for (const file of ["core/composition/Sidebar/index.tsx", "core/composition/Sidebar/classNames.ts"]) {
            expect(offenders, `${file} must own its geometry in styles.css`).not.toContain(file)
        }
    })

    it("routes every Sidebar class through classNames.ts", () => {
        const component = readFileSync(join(sourceRoot, "core", "composition", "Sidebar", "index.tsx"), "utf8")
        const classNames = readFileSync(join(sourceRoot, "core", "composition", "Sidebar", "classNames.ts"), "utf8")
        expect(component).not.toMatch(/className=\{?["'`]/)
        expect([...classNames.matchAll(/cn\("([^"]+)"\)/g)].map((match) => match[1] ?? "")).toEqual([
            "starci-core-sidebar",
            "starci-core-sidebar-toggle",
            "starci-core-sidebar-header",
            "starci-core-sidebar-list",
            "starci-core-sidebar-section",
            "starci-core-sidebar-section-label",
            "starci-core-sidebar-item",
            "starci-core-sidebar-item-label",
            "starci-core-sidebar-item-trailing",
            "starci-core-sidebar-footer",
        ])
    })
})
