import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

/**
 * One harness for the whole monorepo: a single `vitest run` at the workspace root collects the
 * specs that live beside their owners in both apps and in the shared package, so
 * `coverage/lcov.info` lands at the repo root exactly where `sonar-project.properties` points.
 * The `@shared` alias mirrors the tsconfig path mapping every app already compiles against, and
 * jsdom plus `@testing-library/react` are the same choices `todo-app-frontend` made.
 */
export default defineConfig({
    resolve: {
        alias: {
            "@shared": fileURLToPath(new URL("./packages/shared/src", import.meta.url)),
            "@fe-kit": fileURLToPath(new URL("../../packages/fe-kit/src", import.meta.url)),
        },
    },
    esbuild: {
        jsx: "automatic",
    },
    test: {
        environment: "jsdom",
        include: ["apps/*/src/**/*.spec.{ts,tsx}", "packages/*/src/**/*.spec.{ts,tsx}"],
        setupFiles: ["./vitest.setup.ts"],
        globals: false,
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov", "json-summary"],
            reportsDirectory: "coverage",
            include: ["apps/*/src/**/*.{ts,tsx}", "packages/shared/src/**/*.{ts,tsx}"],
            exclude: [
                "apps/*/src/**/*.spec.{ts,tsx}",
                "packages/shared/src/**/*.spec.{ts,tsx}",
                "apps/*/src/**/*.d.ts",
                "packages/shared/src/**/*.d.ts",
                "**/node_modules/**",
                "**/dist/**",
                "**/.next/**",
            ],
        },
    },
})
