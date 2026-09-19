/*
 * StarCi's React/TypeScript canon is published as @starci/eslint-canon-fe; this repository owns
 * only the repository layout. Rule definitions and severities stay in the package.
 *
 * This is a MONOREPO (`apps/*` npm workspaces: landing + shop), so the canon attaches with
 * layout "monorepo" - its component tree lives at `apps/<app>/src/**`, which is exactly the
 * glob the monorepo branch governs. "single-app" would match nothing here.
 */
import starciFe, {
    recommended as starciRecommended,
    linterOptions as starciLinterOptions,
    starciFeConfig,
} from "@starci/eslint-canon-fe"

import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import pluginReact from "eslint-plugin-react"
import pluginReactHooks from "eslint-plugin-react-hooks"
import { defineConfig } from "eslint/config"
import jsxA11y from "eslint-plugin-jsx-a11y"

const APP_GLOBS = ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"]

export default defineConfig([{
    ignores: [
        "**/.next/**",
        "**/node_modules/**",
        "**/dist/**",
        "**/out/**",
        "**/coverage/**",
        "**/next-env.d.ts",
        // Disposable review evidence: captured HTML/PNG snapshots plus the capture script.
        "captures/**",
        // sonar-scanner's working directory: it vendors its own JS/TS analyzer bridge bundle.
        "**/.scannerwork/**",
    ],
}, {
    files: [
        "apps/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
        "packages/**/*.{ts,mts,cts,tsx}",
        "scripts/**/*.{js,mjs,cjs}",
    ],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
},
    ...tseslint.configs.recommended.map((config) => ({ ...config, files: APP_GLOBS })), {
    ...pluginReact.configs.flat.recommended,
    files: APP_GLOBS,
}, {
    files: APP_GLOBS,
    plugins: { "react-hooks": pluginReactHooks },
    settings: { react: { version: "detect" } },
    rules: {
        "react/display-name": "off",
        "react/react-in-jsx-scope": "off",
        "react/no-unescaped-entities": "off",
        indent: ["error", 4],
        "react-hooks/exhaustive-deps": "off",
        "linebreak-style": "off",
        quotes: ["error", "double"],
        semi: ["error", "never"],
    },
}, {
    files: APP_GLOBS,
    rules: {
        "@typescript-eslint/array-type": ["error", { default: "generic", readonly: "generic" }],
        "react/prop-types": "off",
    },
}, starciFeConfig({
    layout: "monorepo",
    plugin: starciFe,
    recommended: starciRecommended,
    linterOptions: starciLinterOptions,
}), {
    /*
     * Lang/dictionary files are the ONE place Vietnamese and non-ASCII content belongs. The
     * exemption lives in the config (not inline comments, which noInlineConfig refuses) so a
     * reader finds it by searching for the rule.
     */
    files: ["**/messages/**", "**/locale*/**", "**/lang/**", "**/*.lang.*"],
    rules: {
        "starci-fe/no-second-language-in-source": "off",
        "starci-fe/no-emoji-in-source": "off",
    },
}, {
    files: ["apps/*/src/**/*.{ts,tsx}"],
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
}, {
    // Operator scripts are Node programs that never reach a bundle: they read `process.env`
    // and exit with a code, both of which are the point rather than an oversight.
    files: ["scripts/**/*.{js,mjs,cjs}", "apps/*/next.config.mjs", "apps/*/postcss.config.mjs"],
    languageOptions: { globals: globals.node },
}])
