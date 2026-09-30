import { defineConfig } from "vitest/config"

/**
 * One harness for the whole monorepo: a single `vitest run` at the workspace root collects the
 * specs that live beside their owners in both apps and in the shared package, so
 * one run covers every workspace.
 * Shared code enters through the built workspace package's declared exports.
 */
export default defineConfig({
    esbuild: {
        jsx: "automatic",
    },
    test: {
        environment: "jsdom",
        include: ["apps/*/src/**/*.spec.{ts,tsx}", "packages/*/src/**/*.spec.{ts,tsx}"],
        setupFiles: ["./vitest.setup.ts"],
        globals: false,
    },
})
