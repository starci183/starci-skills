/**
 * How a module is composed, declared once in its `<c>.module-definition.ts` as `<C>_MODULE_KIND`. A Capability is
 * stateful (connection, pool, client, domain capability): registered exactly once per app at the app root with
 * `isGlobal: true` and consumed only through its `Inject<Thing>()` decorators. A Library is stateless: never registered at
 * an app root, imported by the modules that need it as `X.register({ isGlobal: false })`.
 */
export enum ModuleKind {
    /** Registered once per app, globally, at the app root. */
    Capability = "capability",
    /** Imported locally with `register({ isGlobal: false })` by each module that needs it. */
    Library = "library",
}
