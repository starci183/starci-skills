import { defineConfig } from "vitest/config"
import { starciVitestWorkspace } from "@starci/vitest-preset"

export default defineConfig(starciVitestWorkspace({ rootDir: import.meta.dirname }))
