/*
 * Rules are authored in the trust tree and published as @starci/eslint-canon-be; this repository
 * owns only which globs they apply to and which vendored repository-local rules join them
 * (./plugins/eslint — the seven rules canon does not publish, copied from the host repo's
 * plugins/eslint/index.mjs).
 *
 *   plugins: { "starci-be": { rules: { ...canon, ...local } } },
 *   rules: { ...recommended, ... },
 */
import starciBeCanon, {
    recommended as starciBeCanonRecommended,
} from "@starci/eslint-canon-be"

import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import { defineConfig } from "eslint/config"
import starciBe from "./plugins/eslint/index.mjs"

const APP_GLOBS = ["src/**/*.ts", "apps/**/*.ts"]

export default defineConfig([
    {
        ignores: [
            "**/node_modules/**",
            "**/dist/**",
            "**/coverage/**",
            "scripts/**",
            "eslint.config.mjs",
            "**/*.js",
            "**/*.cjs",
            "**/*.d.ts",
        ],
    },
    {
        files: APP_GLOBS,
        plugins: { js },
        extends: ["js/recommended"],
        languageOptions: {
            globals: { ...globals.node, ...globals.jest },
        },
    },
    ...tseslint.configs.recommended.map((config) => ({
        ...config,
        files: APP_GLOBS,
    })),
    {
        files: APP_GLOBS,
        rules: {
            "@typescript-eslint/no-empty-object-type": "off",
            "array-element-newline": ["error", "always"],
            "object-curly-newline": [
                "error",
                {
                    ObjectExpression: "always",
                    ImportDeclaration: "always",
                },
            ],
            "function-call-argument-newline": ["error", "always"],
            indent: ["error", 4],
            "linebreak-style": "off",
            quotes: ["error", "double"],
            semi: ["error", "never"],
        },
    },
    {
        // type-safety §6 + config-and-env §8 — banned outside specs/test infra. `src/tests/**`
        // owns process.env because the e2e stack points the app at what it just booted.
        files: APP_GLOBS,
        ignores: [
            "**/*spec.ts",
            "src/tests/**",
        ],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    selector: "TSAsExpression:has(> TSAsExpression > TSUnknownKeyword)",
                    message: "`as unknown as X` is banned outside test mocks — narrow properly instead (type-safety §6).",
                },
                {
                    selector: "MemberExpression[object.name='process'][property.name='env']",
                    message: "`process.env` reads belong behind the app's typed config service (config-and-env §8).",
                },
            ],
        },
    },
    {
        // Canon + the seven vendored repository-local rules canon does not publish.
        files: APP_GLOBS,
        plugins: {
            "starci-be": {
                meta: { name: "eslint-plugin-starci-be" },
                rules: {
                    ...starciBeCanon.rules,
                    ...starciBe.rules,
                },
            },
        },
        rules: {
            ...starciBeCanonRecommended,
            "starci-be/no-ai-symbol": "error",
            "starci-be/no-emoji": "error",
            "starci-be/no-vietnamese": "error",
            "starci-be/no-default-export": "error",
            "starci-be/no-nest-logger": "error",
            "starci-be/must-use-cache-service": "error",
        },
    },
    {
        // naming-and-structure §8 — modules do not import other in-repo modules.
        files: ["src/modules/**/*.module.ts", "src/features/**/*.module.ts"],
        rules: {
            "starci-be/no-non-global-module-import": "error",
        },
    },
    {
        // Test lanes write runner assertions, not domain failures. Specs get no language
        // exemption anywhere else: tests are written in English, full stop.
        files: ["src/tests/**/*.ts", "**/*spec.ts"],
        rules: {
            "starci-be/throw-abstract-exception": "off",
        },
    },
    {
        // Locale dictionaries are the one place Vietnamese (and emoji as content) is the
        // point, not commentary. Mirrors the lang-file exemption inside no-vietnamese for
        // the other text rules; i18n CODE beside the dictionaries stays policed.
        files: [
            "**/messages/**/*.{ts,tsx}",
            "**/locale*/**/*.{ts,tsx}",
            "**/lang/**/*.{ts,tsx}",
            "**/*.lang.{ts,tsx}",
        ],
        rules: {
            "starci-be/no-non-ascii-source": "off",
            "starci-be/no-emoji": "off",
            "starci-be/no-ai-symbol": "off",
        },
    },
])
