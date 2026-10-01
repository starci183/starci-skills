import { existsSync, readFileSync, statSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"

/** The path aliases of a project, resolved the way TypeScript resolves them. */
export interface ResolvedTsPaths {
    /** The absolute directory every `paths` target is relative to. */
    readonly baseUrl: string
    /** The `paths` mapping as the declaring config wrote it. */
    readonly paths: Readonly<Record<string, ReadonlyArray<string>>>
}

/** One compiler option found in the `extends` chain, with the folder of the config that declared it. */
interface Declared<T> {
    readonly value: T
    readonly dir: string
}

/** One tsconfig of the chain: its folder, its compiler options and the configs it extends (later entries win). */
interface ConfigNode {
    readonly dir: string
    readonly options: Readonly<Record<string, unknown>>
    readonly bases: ReadonlyArray<ConfigNode>
}

/** Removes comments and trailing commas outside strings: tsconfig files are JSONC. */
export const stripJsonc = (text: string): string => {
    let out = ""
    let index = 0
    while (index < text.length) {
        const char = text[index]
        const next = text[index + 1]
        if (char === '"') {
            let end = index + 1
            while (end < text.length && text[end] !== '"') end += text[end] === "\\" ? 2 : 1
            out += text.slice(index, end + 1)
            index = end + 1
        } else if (char === "/" && next === "/") {
            while (index < text.length && text[index] !== "\n") index += 1
        } else if (char === "/" && next === "*") {
            const end = text.indexOf("*/", index + 2)
            index = end === -1 ? text.length : end + 2
        } else {
            out += char
            index += 1
        }
    }
    return out.replace(/,(\s*[}\]])/g, "$1")
}

const isFile = (path: string): boolean => existsSync(path) && statSync(path).isFile()

/** Resolves an `extends` entry from the folder of the config that names it: a relative or absolute path, or a package specifier. */
export const resolveExtends = (specifier: string, fromDir: string): string | null => {
    if (specifier.startsWith(".") || isAbsolute(specifier)) {
        const base = resolve(fromDir, specifier)
        return [base, `${base}.json`, join(base, "tsconfig.json")].find(isFile) ?? null
    }
    for (const candidate of [specifier, `${specifier}.json`, `${specifier}/tsconfig.json`]) {
        try {
            return require.resolve(candidate, { paths: [fromDir] })
        } catch {
            // the next candidate spelling, as TypeScript tries them
        }
    }
    return null
}

const asRecord = (value: unknown): Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

/** Reads a tsconfig and every config it extends, depth first; a config seen twice on one path is not read again. */
const readConfig = (file: string, seen: ReadonlySet<string> = new Set()): ConfigNode => {
    const dir = dirname(file)
    const raw = asRecord(JSON.parse(stripJsonc(readFileSync(file, "utf8"))))
    const extended = typeof raw.extends === "string" ? [raw.extends] : Array.isArray(raw.extends) ? raw.extends.filter((entry): entry is string => typeof entry === "string") : []
    const chain = new Set([...seen, file])
    const bases = extended
        .map((specifier) => resolveExtends(specifier, dir))
        .filter((path): path is string => path !== null && !chain.has(path))
        .map((path) => readConfig(path, chain))
    return { dir, options: asRecord(raw.compilerOptions), bases }
}

/** The nearest declaration of a compiler option: the config's own, else its bases from the last to the first (later entries win). */
const nearest = <T>(node: ConfigNode, key: string, accept: (value: unknown) => value is T): Declared<T> | null => {
    const own = node.options[key]
    if (accept(own)) return { value: own, dir: node.dir }
    for (const base of [...node.bases].reverse()) {
        const found = nearest(base, key, accept)
        if (found !== null) return found
    }
    return null
}

const isPaths = (value: unknown): value is Readonly<Record<string, ReadonlyArray<string>>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === "string"

/**
 * The aliases of the tsconfig `file`, resolved as TypeScript resolves them: `paths` comes from the nearest config of the
 * `extends` chain that declares it; its targets are relative to the effective `baseUrl` (the nearest config that declares
 * one, resolved against that config's folder) or, without a `baseUrl` anywhere in the chain, to the folder of the config that
 * declares `paths`. Answers null when the chain declares no `paths`.
 */
export const resolveTsPaths = (file: string): ResolvedTsPaths | null => {
    const root = readConfig(resolve(file))
    const paths = nearest(root, "paths", isPaths)
    if (paths === null) return null
    const baseUrl = nearest(root, "baseUrl", isText)
    return { baseUrl: baseUrl === null ? paths.dir : resolve(baseUrl.dir, baseUrl.value), paths: paths.value }
}

/**
 * Registers the repository path aliases (`@modules/*`, `@features/*`, `@tests/*`) for the code the globalSetup loads in the jest
 * parent process (jest's moduleNameMapper does not apply there). Reads `src/tests/tsconfig.json` when present, else
 * `tsconfig.json`, and resolves its `extends` chain as TypeScript does. Answers the function that unregisters the aliases.
 * A repository without `tsconfig-paths` installed gets a clear failure at the first alias import instead.
 */
export const registerTsPaths = (root: string): (() => void) => {
    const testsConfig = join(root, "src", "tests", "tsconfig.json")
    const file = isFile(testsConfig) ? testsConfig : join(root, "tsconfig.json")
    if (!isFile(file)) return () => undefined
    const resolved = resolveTsPaths(file)
    if (resolved === null) return () => undefined
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const tsconfigPaths = require("tsconfig-paths") as typeof import("tsconfig-paths")
        return tsconfigPaths.register({ baseUrl: resolved.baseUrl, paths: { ...resolved.paths } as Record<string, Array<string>>, addMatchAll: false })
    } catch {
        // tsconfig-paths is a peer dependency; a repository with no aliases does not need it
        return () => undefined
    }
}
