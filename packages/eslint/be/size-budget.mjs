/**
 * The rules that hold the file size budget (catalog R20 `HFS_SIZE_GROWTH`, the file-level half).
 *
 * A source file has a soft budget of `fileLines` lines (500 by default, read through `lib/slots.mjs`). Two rules
 * split the work because they answer different questions:
 *
 *   - `file-size-soft-limit` is advisory: it WARNS on every file over the budget, so an editor and a review show
 *     where the debt is. The factory keeps this one at `warn`; it is the only warning the canon publishes.
 *   - `file-size-growth` is the ratchet and fails only on a file that must not be this long: a NEW file over the
 *     budget, or an existing file over the budget that is longer than its recorded size. The recorded size is
 *     the file's line count at the parent commit (`git show HEAD:<file>`), or an entry of the `recorded` option.
 *     A file may stay as large as it is; it may not grow, and it may not be born large.
 *
 * There is no baseline file and no allowlist: the record is the repository's own history. A migration is exempt
 * (it is append-only and generated), and so is every test-lane file.
 */
import { execFileSync } from "node:child_process"
import { basename, dirname } from "node:path"
import { isDeclarationFile, isMigrationFile, isTestLane, normalizePath } from "./lib/path.mjs"
import { hfsParams } from "./lib/slots.mjs"

const lineCount = (text) => {
    const lines = text.split(/\r?\n/)
    return lines.at(-1) === "" ? lines.length - 1 : lines.length
}

/** Whether a file is a source file this budget governs. */
const governed = (filename) =>
    /\.[cm]?tsx?$/.test(filename) &&
    !isDeclarationFile(filename) &&
    !isMigrationFile(filename) &&
    !isTestLane(filename) &&
    !filename.includes("/__generated__/")

/**
 * The line count of a file at a git revision, or null when the file did not exist there or git is absent.
 *
 * @param {string} filename - Absolute path of the file.
 * @param {string} ref - The revision, `HEAD` by default (the parent of the commit being made).
 * @returns {number | null} The recorded line count.
 */
export const recordedLines = (filename, ref = "HEAD") => {
    try {
        const text = execFileSync("git", ["-C", dirname(filename), "show", `${ref}:./${basename(filename)}`], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
            maxBuffer: 64 * 1024 * 1024,
        })
        return lineCount(text)
    } catch {
        // no repository, no such revision, or a new file: all mean there is no recorded size to compare with
        return null
    }
}

const optionSchema = [
    {
        type: "object",
        properties: {
            max: { type: "integer", minimum: 1 },
            ref: { type: "string" },
            recorded: { type: "object", additionalProperties: { type: "integer", minimum: 0 } },
        },
        additionalProperties: false,
    },
]

/** Advisory: every governed file over the budget is shown. */
export const fileSizeSoftLimit = {
    meta: {
        type: "suggestion",
        docs: { description: "A source file over the soft line budget is reported as a warning." },
        schema: optionSchema,
        messages: {
            over: "This file has {{lines}} lines, over the budget of {{max}}. Split it by responsibility before it grows.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (!governed(filename)) return {}
        const max = context.options[0]?.max ?? hfsParams.fileLines
        return {
            "Program:exit"(node) {
                const lines = lineCount((context.sourceCode || context.getSourceCode()).text)
                if (lines > max) context.report({ node, loc: { line: 1, column: 0 }, messageId: "over", data: { lines, max } })
            },
        }
    },
}

/** The ratchet: a file over the budget must not be new and must not grow. */
export const fileSizeGrowth = {
    meta: {
        type: "problem",
        docs: { description: "A source file over the budget is neither new nor longer than its recorded size." },
        schema: optionSchema,
        messages: {
            born: "This new file has {{lines}} lines, over the budget of {{max}}. A new file starts within the budget: split it by responsibility.",
            grew: "This file has {{lines}} lines, over the budget of {{max}}, and it was {{recorded}} at the parent commit. A file over the budget may not grow: move the new code into its own file.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (!governed(filename)) return {}
        const options = context.options[0] ?? {}
        const max = options.max ?? hfsParams.fileLines
        return {
            "Program:exit"(node) {
                const lines = lineCount((context.sourceCode || context.getSourceCode()).text)
                if (lines <= max) return
                const listed = options.recorded
                    ? Object.entries(options.recorded).find(([path]) => filename.endsWith(`/${path}`) || filename === path)
                    : undefined
                const recorded = listed ? listed[1] : recordedLines(context.filename || context.getFilename(), options.ref)
                const loc = { line: 1, column: 0 }
                if (recorded === null) context.report({ node, loc, messageId: "born", data: { lines, max } })
                else if (lines > recorded) context.report({ node, loc, messageId: "grew", data: { lines, max, recorded } })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "file-size-soft-limit": fileSizeSoftLimit,
    "file-size-growth": fileSizeGrowth,
}

/**
 * The soft limit is the one advisory rule, and `ADVISORY` in `lib/config.mjs` names it so the factory does not
 * lift it to `error`. The ratchet is `error`.
 */
export const recommended = {
    "starci-be/file-size-soft-limit": "warn",
    "starci-be/file-size-growth": "error",
}
