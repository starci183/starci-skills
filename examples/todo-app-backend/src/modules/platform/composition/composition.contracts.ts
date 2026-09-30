/** How a module is composed: a capability is registered once per app root and reached through injectors; a library is stateless and imported locally. */
export enum ModuleKind {
    /** Stateful (database, config, logging, queues, clients, every domain capability): `X.register({ isGlobal: true, ... })` once in the app root. */
    Capability = "capability",
    /** Stateless: a module that needs it imports `X.register({ isGlobal: false, ... })` itself. */
    Library = "library",
}
