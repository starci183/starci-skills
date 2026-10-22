/**
 * The one place the library loads a module on first use: a peer dependency of the repository (`pg`, `@nestjs/cqrs`,
 * `tsconfig-paths`), the repository's own test-world declaration, or a heavy sibling (`./stack`) a command that never
 * touches Docker must not load. `module.require` is the loader of the running module system, so under jest a
 * module comes from jest's registry (the repository's own `@nestjs/cqrs` instance, never a second copy) and under
 * node from node's. Dynamic `import()` would be refused inside the jest sandbox, which has no ESM support enabled.
 *
 * `specifier` resolves from this file: a relative one is relative to `src/` (`./stack`), a bare one walks up from the
 * package to the repository's `node_modules`, and an absolute path loads that file.
 */
export const lazyRequire = <T>(specifier: string): T => module.require(specifier) as T
