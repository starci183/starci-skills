import { createHash } from "node:crypto"
import { lstat, readdir, readFile, readlink } from "node:fs/promises"
import { join, posix } from "node:path"
import { byCodeUnit } from "../../order"

/** The lockfiles looked up at the build context root; every one that exists is part of the hash. */
export const LOCKFILES: ReadonlyArray<string> = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]

const tokenize = (text: string): Array<string> => {
    const tokens: Array<string> = []
    for (const match of text.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) tokens.push(match[1] ?? match[2] ?? match[3] ?? "")
    return tokens
}

/**
 * The local sources of every `COPY`/`ADD` of a Dockerfile. Ignored: stage copies (`--from=`), heredoc copies, URL/git
 * sources. Handles flags (`--chown`, `--chmod`, `--link`, ...), line continuations, comments, the JSON-array form and
 * multi-source lines. A source that uses a build variable (`$`) cannot be resolved statically and stands for the whole context (`.`).
 */
export const parseCopySources = (dockerfile: string): ReadonlyArray<string> => {
    const logical: Array<string> = []
    let pending = ""
    for (const raw of dockerfile.split(/\r?\n/)) {
        const trimmed = raw.trim()
        if (trimmed.startsWith("#")) continue
        if (trimmed.endsWith("\\")) {
            pending += `${trimmed.slice(0, -1)} `
            continue
        }
        logical.push(pending + trimmed)
        pending = ""
    }
    if (pending.trim() !== "") logical.push(pending)

    const sources: Array<string> = []
    for (const line of logical) {
        const instruction = /^(COPY|ADD)\s+(.*)$/i.exec(line)
        if (instruction === null) continue
        let rest = (instruction[2] ?? "").trim()
        let fromStage = false
        while (rest.startsWith("--")) {
            const end = rest.search(/\s/)
            const flag = end === -1 ? rest : rest.slice(0, end)
            if (/^--from(=|$)/i.test(flag)) fromStage = true
            rest = end === -1 ? "" : rest.slice(end).trim()
        }
        if (fromStage || rest.startsWith("<<")) continue
        let tokens: Array<string>
        if (rest.startsWith("[")) {
            try {
                const parsed: unknown = JSON.parse(rest)
                tokens = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
            } catch {
                tokens = tokenize(rest)
            }
        } else {
            tokens = tokenize(rest)
        }
        if (tokens.length < 2) continue
        for (const source of tokens.slice(0, -1)) {
            if (/^[a-z][a-z0-9+.-]*:\/\//i.test(source) || source.startsWith("git@")) continue
            sources.push(source.includes("$") ? "." : source)
        }
    }
    return sources
}

/** Converts a docker glob (`*`, `**`, `?`, `[..]`) to an anchored RegExp over posix relative paths. */
export const globToRegExp = (pattern: string): RegExp => {
    let out = ""
    let i = 0
    while (i < pattern.length) {
        const char = pattern.charAt(i)
        if (char === "*") {
            if (pattern.charAt(i + 1) === "*") {
                if (pattern.charAt(i + 2) === "/") {
                    out += "(?:.*/)?"
                    i += 2
                } else {
                    out += ".*"
                    i += 1
                }
            } else {
                out += "[^/]*"
            }
        } else if (char === "?") {
            out += "[^/]"
        } else if (char === "[" && pattern.includes("]", i + 2)) {
            const close = pattern.indexOf("]", i + 2)
            const body = pattern.slice(i + 1, close)
            out += `[${body.startsWith("!") ? "^" : ""}${body.replace(/^!/, "").replaceAll("\\", String.raw`\\`)}]`
            i = close
        } else {
            out += char.replaceAll(/[.+^${}()|\\\][]/g, String.raw`\$&`)
        }
        i += 1
    }
    return new RegExp(`^${out}$`)
}

interface IgnoreRule {
    readonly negated: boolean
    readonly regex: RegExp
}

/** A `.dockerignore` matcher over posix relative paths: last matching rule wins; a rule matching a directory covers its contents. */
export interface Ignore {
    (relative: string): boolean
    /** Whether a `!` rule exists (then ignored directories cannot be pruned while walking). */
    readonly hasNegation: boolean
}

/** Parses the text of a `.dockerignore`. */
export const parseDockerignore = (text: string): Ignore => {
    const rules: Array<IgnoreRule> = []
    for (const raw of text.split(/\r?\n/)) {
        let line = raw.trim()
        if (line === "" || line.startsWith("#")) continue
        const negated = line.startsWith("!")
        if (negated) line = line.slice(1).trim()
        line = posix.normalize(line.replace(/^\/+/, "")).replace(/\/+$/, "")
        if (line === "" || line === ".") continue
        rules.push({ negated, regex: globToRegExp(line) })
    }
    const matcher = (relative: string): boolean => {
        const parts = relative.split("/")
        let ignored = false
        for (const rule of rules) {
            for (let n = 1; n <= parts.length; n++) {
                if (rule.regex.test(parts.slice(0, n).join("/"))) {
                    ignored = !rule.negated
                    break
                }
            }
        }
        return ignored
    }
    return Object.assign(matcher, { hasNegation: rules.some((rule) => rule.negated) })
}

const walk = async (root: string, relative: string, ignore: Ignore, out: Set<string>): Promise<void> => {
    const entries = await readdir(relative === "" ? root : join(root, relative), { withFileTypes: true })
    for (const entry of entries) {
        if (entry.name === ".git") continue
        const child = relative === "" ? entry.name : `${relative}/${entry.name}`
        if (entry.isDirectory()) {
            if (!ignore.hasNegation && ignore(child)) continue
            await walk(root, child, ignore, out)
        } else if (!ignore(child)) {
            out.add(child)
        }
    }
}

/** The relative posix paths of the files the sources select, respecting the ignore rules. */
export const resolveSources = async (root: string, sources: ReadonlyArray<string>, ignore: Ignore): Promise<ReadonlyArray<string>> => {
    const selected = new Set<string>()
    let everything: Set<string> | null = null
    const all = async (): Promise<Set<string>> => {
        if (everything === null) {
            everything = new Set<string>()
            await walk(root, "", ignore, everything)
        }
        return everything
    }
    for (const source of sources) {
        const normalized = posix.normalize(source.replaceAll("\\", "/").replace(/^\.?\/+/, "")).replace(/\/+$/, "")
        if (normalized === "." || normalized === "") {
            for (const file of await all()) selected.add(file)
        } else if (/[*?[]/.test(normalized)) {
            const regex = globToRegExp(normalized)
            for (const file of await all()) {
                const parts = file.split("/")
                if (parts.some((_, index) => regex.test(parts.slice(0, index + 1).join("/")))) selected.add(file)
            }
        } else {
            let stats
            try {
                stats = await lstat(join(root, normalized))
            } catch {
                continue
            }
            if (stats.isDirectory()) {
                const inside = new Set<string>()
                await walkInto(root, normalized, ignore, inside)
                for (const file of inside) selected.add(file)
            } else if (!ignore(normalized)) {
                selected.add(normalized)
            }
        }
    }
    return [...selected].sort(byCodeUnit)
}

const walkInto = async (root: string, relative: string, ignore: Ignore, out: Set<string>): Promise<void> => {
    if (!ignore.hasNegation && ignore(relative)) return
    await walk(root, relative, ignore, out)
}

/** What {@link computeImageHash} answers. */
export interface ImageHash {
    /** Full sha256 hex. */
    readonly hash: string
    /** `src-<first 12 hex>`. */
    readonly tag: string
    /** The source files hashed (relative posix paths, sorted). */
    readonly files: ReadonlyArray<string>
}

/**
 * The content hash of an own image: the Dockerfile text, every lockfile at the context root, and every file the
 * Dockerfile COPY/ADDs (minus `.dockerignore`), as `path \0 content` in sorted order. The `.git` directory is never hashed.
 */
export const computeImageHash = async (input: { readonly root: string; readonly dockerfile: string }): Promise<ImageHash> => {
    const dockerfileText = await readFile(join(input.root, input.dockerfile), "utf8")
    let ignoreText = ""
    try {
        ignoreText = await readFile(join(input.root, ".dockerignore"), "utf8")
    } catch {
        ignoreText = ""
    }
    const files = await resolveSources(input.root, parseCopySources(dockerfileText), parseDockerignore(ignoreText))
    const hash = createHash("sha256")
    hash.update(`dockerfile\0${dockerfileText}\0`)
    for (const lockfile of LOCKFILES) {
        let content: Buffer
        try {
            content = await readFile(join(input.root, lockfile))
        } catch {
            continue
        }
        hash.update(`lock:${lockfile}\0`)
        hash.update(content)
        hash.update("\0")
    }
    for (const file of files) {
        hash.update(`${file}\0`)
        const stats = await lstat(join(input.root, file))
        hash.update(stats.isSymbolicLink() ? `link:${await readlink(join(input.root, file))}` : await readFile(join(input.root, file)))
        hash.update("\0")
    }
    const hex = hash.digest("hex")
    return { hash: hex, tag: `src-${hex.slice(0, 12)}`, files }
}
