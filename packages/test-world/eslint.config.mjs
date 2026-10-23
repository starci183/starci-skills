/*
 * The package is linted the way every StarCi source is: an inline lint directive is refused, not honoured
 * (noInlineConfig), so a suppression cannot enter; a ts directive comment is refused in every form. The back-end canon
 * itself needs an app's hfs.json, so this library states the shared part of it here.
 */
import tseslint from "typescript-eslint"

export default tseslint.config(
    { ignores: ["dist/**", "node_modules/**"] },
    {
        files: ["src/**/*.ts", "*.mjs"],
        extends: [tseslint.configs.recommended],
        linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "error" },
        rules: {
            "@typescript-eslint/ban-ts-comment": ["error", { "ts-expect-error": true, "ts-ignore": true, "ts-nocheck": true, "ts-check": true }],
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-non-null-assertion": "error",
            "@typescript-eslint/no-require-imports": "error",
            "no-console": "error",
        },
    },
)
