/**
 * What Sonar does not analyse in a front-end repository, expressed once: `sonarExclusions()` renders `sonar.exclusions`.
 * Sonar reads no coverage report, so there is no coverage denominator here.
 */
export const SONAR_EXCLUSIONS = [
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/.next/**",
    "**/node_modules/**",
    "**/coverage/**",
    "**/src/messages/**",
]

export const sonarExclusions = () => SONAR_EXCLUSIONS.join(",")

/** Packages a workspace lane must resolve once, so React context and HeroUI state are shared. */
export const DEDUPE = ["react", "react-dom", "@heroui/react", "@heroui/styles"]

/** Packages that ship untranspiled ESM/CSS and must go through vite rather than node's loader. */
export const INLINE_DEPS = ["next-intl", /[\\/]node_modules[\\/]@starci[\\/]grammar[\\/]/]

/**
 * One workspace lane (an app or a package): its own root, aliases and jsdom environment.
 *
 * @param {object} options
 * @param {string} options.name          project name, usually the workspace package name
 * @param {string} options.root          the lane directory (`import.meta.dirname`)
 * @param {Record<string,string>} [options.alias]   path aliases, resolved by the caller
 * @param {string[]} [options.setupFiles]           setup files, relative to `root`
 * @param {unknown[]} [options.plugins]             vite plugins, e.g. `[react()]`
 * @param {(string|RegExp)[]} [options.inline]      extra deps to inline, added to INLINE_DEPS
 */
export function starciVitestProject(options) {
    const { name, root, alias = {}, setupFiles = [], plugins = [], inline = [] } = options
    return {
        plugins,
        resolve: { dedupe: DEDUPE, alias },
        test: {
            name,
            root,
            environment: "jsdom",
            globals: true,
            setupFiles,
            include: ["src/**/*.spec.{ts,tsx}"],
            server: { deps: { inline: [...INLINE_DEPS, ...inline] } },
        },
    }
}

/**
 * The repository-root config: every lane is a `projects` entry, so one run runs every lane.
 *
 * @param {object} options
 * @param {string} options.rootDir              `import.meta.dirname` of the root config
 * @param {string[]} [options.projects]         default apps/* and packages/* vitest configs
 * @param {unknown[]} [options.plugins]
 */
export function starciVitestWorkspace(options) {
    const { projects = ["apps/*/vitest.config.ts", "packages/*/vitest.config.ts"], plugins = [] } = options
    return {
        plugins,
        test: {
            projects,
        },
    }
}
