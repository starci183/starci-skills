import { defineConfig } from "vitest/config"
import { starciVitestProject } from "@starci/vitest-preset"

export default defineConfig(starciVitestProject({ name: "{{app}}", root: import.meta.dirname }))
