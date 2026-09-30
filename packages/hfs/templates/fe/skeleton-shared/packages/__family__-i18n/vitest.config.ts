import { defineConfig } from "vitest/config"
import { starciVitestProject } from "@starci/vitest-preset"

export default defineConfig(starciVitestProject({ name: "@{{family}}/i18n", root: import.meta.dirname }))
