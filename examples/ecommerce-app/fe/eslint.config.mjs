import { loadHfs, starciFeConfig } from "@starci/eslint-canon-fe"

export default starciFeConfig({ hfs: loadHfs(import.meta.url) })
