import { loadHfs, starciBeConfig } from "@starci/eslint-canon-be"

export default starciBeConfig({ hfs: loadHfs(import.meta.url) })
