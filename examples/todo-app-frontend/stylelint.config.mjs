import { loadAppTokens, starciStylelintConfig } from "@starci/stylelint-canon"

export default starciStylelintConfig({ appTokens: loadAppTokens(import.meta.url) })
