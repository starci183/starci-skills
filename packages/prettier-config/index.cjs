/**
 * The one StarCi Prettier config, for back end and front end alike.
 *
 * The shared Prettier config of the StarCi monorepos, chosen from what the repositories already wrote,
 * not from taste: none of them carries a Prettier file today; their layout came from ESLint formatting
 * rules (the largest back end: indent 4, double quotes, no semicolons) and every source file in the
 * front ends already follows the same four rules. The largest repository's dialect gives the smallest
 * reformat diff. See README.md.
 *
 * @type {import("prettier").Config}
 */
module.exports = {
    printWidth: 120,
    tabWidth: 4,
    useTabs: false,
    semi: false,
    singleQuote: false,
    trailingComma: "all",
    bracketSpacing: true,
    arrowParens: "always",
    endOfLine: "auto",
    overrides: [
        {
            files: ["*.json", "*.jsonc", "*.yaml", "*.yml", "*.md"],
            options: { tabWidth: 2 },
        },
    ],
}
