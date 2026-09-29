/**
 * The one StarCi Prettier config, for back end and front end alike.
 *
 * Chosen from what the repositories already wrote, not from taste: none of nivo-backend, nivo-fe,
 * starci-next, starci-next-fe, mia-mia-backend or miamia-fe carries a Prettier file today; their layout came from ESLint
 * formatting rules (nivo-backend: indent 4, double quotes, no semicolons) and every source file in the
 * front ends already follows the same four rules. nivo-backend is the largest repo, so its dialect gives
 * the smallest reformat diff. See README.md.
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
