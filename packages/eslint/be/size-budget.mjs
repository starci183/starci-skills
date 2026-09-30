/**
 * The rules that hold the file size budget (catalog R20 `HFS_SIZE_GROWTH`, the file-level half).
 *
 * A source file has a hard-growth budget of `fileLines.hardGrowth` lines (`ruleParams.be.fileLines` of the
 * slot manifest, read through `settings.starci.hfs`, see `lib/hfs.mjs`). `file-size-growth` is the ratchet and fails only on a file that must not
 * be this long: a NEW file over the budget, or an existing file over the budget that is longer than its recorded size.
 * The recorded size is the file's line count at the parent commit (`git show HEAD:<file>`). A file may stay as large
 * as it is; it may not grow, and it may not be born large. The rule takes no option: the budget is the manifest's, the
 * baseline is git's.
 *
 * There is no soft-limit lint rule: a warning under a zero-warning gate is an exception in disguise. Listing the
 * files over the soft budget (`fileLines.soft`) is a report item of the hfs check, never a block.
 * There is no baseline file and no allowlist: the record is the repository's own history. A spec, a fixture and an e2e
 * file are source files like any other. A migration is exempt (a file of the `be.persistence` slot named
 * `<timestamp>-<name>.ts`: append-only, never edited), and so is a declaration file.
 */
import { execFileSync } from "node:child_process"
import { basename, dirname } from "node:path"
import { hfsOf } from "./lib/hfs.mjs"

/** The line count above which a file may not grow: the soft budget when `hardGrowth` holds, else no limit. */
const hardGrowthLines = ({ soft, hardGrowth }) => (hardGrowth ? soft : Number.POSITIVE_INFINITY)

const lineCount = (text) => {
    const lines = text.split(/\r?\n/)
    return lines.at(-1) === "" ? lines.length - 1 : lines.length
}

/** A migration is a file of the persistence slot named `<timestamp>-<name>.ts`. */
const isMigration = (hfs, filename) => hfs.slotOf(filename) === "be.persistence" && /^\d{13,14}-[^/]+\.[cm]?ts$/.test(basename(filename))

/** Whether a file is a source file this budget governs. */
const governed = (hfs, filename) => /\.[cm]?tsx?$/.test(filename) && !/\.d\.[cm]?ts$/.test(filename) && !isMigration(hfs, filename)

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

/** The ratchet: a file over the budget must not be new and must not grow. */
export const fileSizeGrowth = {
    meta: {
        type: "problem",
        docs: { description: "A source file over the budget is neither new nor longer than its recorded size." },
        schema: [],
        messages: {
            born: "This new file has {{lines}} lines, over the budget of {{max}}. A new file starts within the budget: split it by responsibility.",
            grew: "This file has {{lines}} lines, over the budget of {{max}}, and it was {{recorded}} at the parent commit. A file over the budget may not grow: move the new code into its own file.",
        },
    },
    create(context) {
        const filename = context.filename || context.getFilename()
        const hfs = hfsOf(context)
        if (!governed(hfs, filename)) return {}
        const max = hardGrowthLines(hfs.ruleParams.fileLines)
        return {
            "Program:exit"(node) {
                const lines = lineCount((context.sourceCode || context.getSourceCode()).text)
                if (lines <= max) return
                const recorded = recordedLines(filename)
                const loc = { line: 1, column: 0 }
                if (recorded === null) context.report({ node, loc, messageId: "born", data: { lines, max } })
                else if (lines > recorded) context.report({ node, loc, messageId: "grew", data: { lines, max, recorded } })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "file-size-growth": fileSizeGrowth,
}

/** The ratchet is an error. */
export const recommended = {
    "starci-be/file-size-growth": "error",
}
