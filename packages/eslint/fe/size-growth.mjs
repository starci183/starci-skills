/**
 * The rule that holds the file size budget (HFS R20 `HFS_SIZE_GROWTH`, the file-level half).
 *
 * A source file has a hard-growth budget of `fileLines.soft` lines while `fileLines.hardGrowth` holds
 * (`ruleParams.fe.fileLines` of the slot manifest, read through `lib/params.mjs`). `file-size-growth` is the ratchet and
 * fails only on a file that must not be this long: a NEW file over the budget, or an existing file over the budget that
 * is longer than its recorded size. The recorded size is the file's line count at the parent commit
 * (`git show HEAD:<file>`). A file may stay as large as it is; it may not grow, and it may not be born large. The rule
 * takes no option: the budget is the manifest's, the baseline is git's.
 *
 * There is no baseline file and no allowlist: the record is the repository's own history. A spec and an e2e file are
 * source files like any other; a declaration file (`*.d.ts`) carries no behaviour and is not governed. Component,
 * hook and state budgets are stricter still where they apply (`size-and-state-budget`); this ratchet is the one that
 * needs the previous revision.
 */
import { feParams } from "./lib/params.mjs"
import { hardGrowthLines, lineCount, recordedLines } from "./runtime/scripts/lib/recorded-lines.mjs"

/** Whether a file is a source file this budget governs. */
const governed = (filename) => /\.[cm]?tsx?$/.test(filename) && !/\.d\.[cm]?ts$/.test(filename)

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
    if (!governed(filename)) return {}
    const max = hardGrowthLines(feParams.fileLines)
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
  "starci-fe/file-size-growth": "error",
}
