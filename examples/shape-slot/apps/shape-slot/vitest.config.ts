import react from "@vitejs/plugin-react"
import { resolve } from "node:path"
import { defineConfig } from "vitest/config"
import { starciVitestProject } from "@starci/vitest-preset"

export default defineConfig(
    starciVitestProject({
        name: "@shape-slot/app",
        root: import.meta.dirname,
        alias: { "@": resolve(import.meta.dirname, "src") },
        setupFiles: ["../../vitest.setup.ts"],
        plugins: [react()],
    }),
)
