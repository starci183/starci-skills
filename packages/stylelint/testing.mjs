/** Shared helpers of the specs: lint a string as a named file with the canon's own factory config. Not published. */
import stylelint from "stylelint"
import { starciStylelintConfig } from "./index.mjs"

/** Where a file sits decides which kind of stylesheet it is. */
export const FILES = {
  brand: "D:/repo/apps/web/src/modules/brand/brand.css",
  globals: "D:/repo/apps/web/src/app/globals.css",
  module: "D:/repo/apps/web/src/components/Card/Card.module.css",
  css: "D:/repo/apps/web/src/components/Card/card.css",
}

/** Every warning of one lint run. */
export async function lint(code, file = FILES.module, options = {}) {
  const result = await stylelint.lint({ code, codeFilename: file, config: starciStylelintConfig(options) })
  return result.results[0].warnings
}

/** The warnings of one rule (short name, without `starci/`). */
export async function lintRule(rule, code, file = FILES.module, options = {}) {
  return (await lint(code, file, options)).filter((warning) => warning.rule === `starci/${rule}`)
}
