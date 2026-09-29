/*
 * StarCi's React/TypeScript canon is published as @starci/eslint-canon-fe; this repository owns
 * only which globs the law applies to. Mirrors the reference config at
 * starci-academy-fe/eslint.config.mjs, with every block scoped to APP_GLOBS - this example tree
 * also holds out-of-lane scratch (scripts/ harnesses, e2e/) that lint must not govern.
 */
import { starciFeConfig } from "@starci/eslint-canon-fe"

import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import pluginReact from "eslint-plugin-react"
import { defineConfig } from "eslint/config"
import jsxA11y from "eslint-plugin-jsx-a11y"

const APP_GLOBS = ["apps/*/src/**/*.{ts,tsx}"]

export default defineConfig([
    {
        ignores: [
            "**/.next/**",
            "**/node_modules/**",
            "**/dist/**",
            "**/out/**",
            "**/coverage/**",
            "**/next-env.d.ts",
        ],
    },
    {
        files: APP_GLOBS,
        plugins: { js },
        extends: ["js/recommended"],
        languageOptions: { globals: globals.browser },
    },
    ...tseslint.configs.recommended.map((config) => ({
        ...config,
        files: APP_GLOBS,
    })),
    {
        ...pluginReact.configs.flat.recommended,
        files: APP_GLOBS,
    },
    {
        files: APP_GLOBS,
        settings: { react: { version: "detect" } },
        rules: {
            "react/display-name": "off",
            "react/react-in-jsx-scope": "off",
            "react/no-unescaped-entities": "off",
            indent: ["error", 4],
            "linebreak-style": "off",
            quotes: ["error", "double"],
            semi: ["error", "never"],
        },
    },
    {
        // One spelling for an array type: `Array<T>` and `ReadonlyArray<T>`, never `T[]`.
        files: APP_GLOBS,
        rules: {
            "@typescript-eslint/array-type": ["error", { default: "generic", readonly: "generic" }],
            "react/prop-types": "off",
        },
    },
    ...starciFeConfig({ layout: "monorepo" }),
    {
        // A connected block and its pure twin are an architectural boundary, not a local lint
        // preference. Inline config is disabled in both halves so neither `eslint-disable` nor
        // `eslint-enable` can turn that boundary off. There is deliberately no allowlist.
        files: ["apps/*/src/components/blocks/**/{index,component}.tsx"],
        linterOptions: { noInlineConfig: true },
    },
    {
        // The legacy filename-twin heuristic is switched off for connected blocks per
        // NEXT-LEGACY-BLOCK-TWIN-GUARD (the conditional world-owner architecture check
        // replaces it) - see the starci.codePatterns block in package.json.
        files: ["apps/*/src/components/blocks/**/index.tsx"],
        rules: {
            "starci-fe/connected-block-has-presentational-twin": "off",
        },
    },
    {
        files: APP_GLOBS,
        plugins: { "jsx-a11y": jsxA11y },
        rules: {
            "jsx-a11y/alt-text": "error",
            "jsx-a11y/anchor-has-content": "error",
            "jsx-a11y/anchor-is-valid": "error",
            "jsx-a11y/aria-props": "error",
            "jsx-a11y/aria-role": "error",
            "jsx-a11y/aria-unsupported-elements": "error",
            "jsx-a11y/role-has-required-aria-props": "error",
            "jsx-a11y/role-supports-aria-props": "error",
            "jsx-a11y/click-events-have-key-events": "error",
            "jsx-a11y/no-static-element-interactions": "error",
            "jsx-a11y/label-has-associated-control": "error",
            "jsx-a11y/no-redundant-roles": "error",
        },
    },
])
