/*
 * The kit is canon-governed like any StarCi frontend source: this config attaches
 * @starci/eslint-canon-fe with the "single-app" layout, whose `src/**` glob is exactly
 * the tree this package ships. Peer modules (react, next-intl, @starci/grammar) are not
 * resolved during lint - the canon rules are AST rules and never ask the resolver.
 */
import starciFe, {
    recommended as starciRecommended,
    linterOptions as starciLinterOptions,
    starciFeConfig,
} from "@starci/eslint-canon-fe"

import js from "@eslint/js"
import globals from "globals"
import tsParser from "@typescript-eslint/parser"
import { defineConfig } from "eslint/config"

const SRC_GLOBS = ["src/**/*.{ts,tsx}"]

export default defineConfig([
    {
        ignores: ["**/node_modules/**", "**/dist/**"],
    },
    {
        files: SRC_GLOBS,
        plugins: { js },
        extends: ["js/recommended"],
        languageOptions: {
            globals: globals.browser,
            parser: tsParser,
            parserOptions: { ecmaFeatures: { jsx: true } },
        },
    },
    {
        files: SRC_GLOBS,
        rules: {
            indent: ["error", 4],
            quotes: ["error", "double"],
            semi: ["error", "never"],
            "linebreak-style": "off",
            // The JS rule cannot see TS function-type parameters and flags every documented
            // signature; the TS-aware replacement is not part of the canon plugin set.
            "no-unused-vars": "off",
        },
    },
    starciFeConfig({
        layout: "single-app",
        plugin: starciFe,
        recommended: starciRecommended,
        linterOptions: starciLinterOptions,
    }),
])
