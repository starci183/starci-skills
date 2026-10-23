/*
 * The kit is canon-governed like any StarCi frontend source: the plain-source config of
 * @starci/eslint-canon-fe lints `src/` with types, the React Hooks rules, the Sonar way
 * rules and every canon rule that needs no HFS slot view, all at error. The config states
 * no rule, no ignore and no override. The canon is imported from this repository's own
 * source, and `npm run link-peers` links the lint dependencies it resolves.
 */
import { starciPlainSourceConfig } from "../eslint/fe/index.mjs"

export default starciPlainSourceConfig({ root: import.meta.dirname })
