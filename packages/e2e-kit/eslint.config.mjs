/*
 * The kit's own lint gate: the same canon the consuming apps enforce
 * (@starci/eslint-canon-be recommended) plus the same code style, over the kit's
 * own sources. The kit IS test infrastructure - the helpers a spec's world is
 * built from - so it gets the test lane's one exemption: `throw new Error` is a
 * harness failure report here, not a domain failure, exactly as `src/tests/**`
 * is excused inside each app.
 */
import starciBeCanon, {
    recommended as starciBeCanonRecommended,
} from "@starci/eslint-canon-be"

import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import { defineConfig } from "eslint/config"

const KIT_GLOBS = ["src/**/*.ts"]

export default defineConfig([
    {
        ignores: [
            "**/node_modules/**",
            "eslint.config.mjs",
            "**/*.js",
            "**/*.cjs",
            "**/*.d.ts",
        ],
    },
    {
        files: KIT_GLOBS,
        plugins: { js },
        extends: ["js/recommended"],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
    ...tseslint.configs.recommended.map((config) => ({
        ...config,
        files: KIT_GLOBS,
    })),
    {
        files: KIT_GLOBS,
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
        files: KIT_GLOBS,
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    selector: "TSAsExpression:has(> TSAsExpression > TSUnknownKeyword)",
                    message: "`as unknown as` is banned - narrow properly instead (type-safety).",
                },
            ],
        },
    },
    {
        files: KIT_GLOBS,
        plugins: {
            "starci-be": {
                meta: { name: "eslint-plugin-starci-be" },
                rules: { ...starciBeCanon.rules },
            },
        },
        rules: {
            ...starciBeCanonRecommended,
            "starci-be/throw-abstract-exception": "off",
        },
    },
])
