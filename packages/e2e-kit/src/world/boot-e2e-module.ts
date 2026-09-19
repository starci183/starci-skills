/**
 * The subset of a Nest TestingModule the boot wrapper drives: init() runs the providers'
 * onModuleInit - which is where the compose stack and the api child processes actually come
 * up. Declared structurally so the kit never imports @nestjs itself: the app hands its own
 * Test facade in and gets its own TestingModule type back out.
 */
export interface E2EModuleHandle {
  init(): Promise<unknown>;
}

/** A TestingModuleBuilder-shaped object: compile() resolves the built module. */
export interface E2EModuleBuilder<M extends E2EModuleHandle> {
  compile(): Promise<M>;
}

/** The module metadata a boot passes through verbatim - only `imports` is ever set. */
export interface E2ETestingModuleMetadata {
  imports?: Array<unknown>;
}

/**
 * The subset of @nestjs/testing's `Test` the wrapper needs. The app's world boot passes its
 * own `Test` in (`bootE2EModule(Test, TestingInfraModule.register({...}))`), which keeps the
 * built module on the app's own Nest runtime rather than a kit-local copy.
 */
export interface E2ETestingHost<M extends E2EModuleHandle> {
  createTestingModule(metadata: E2ETestingModuleMetadata): E2EModuleBuilder<M>;
}

/**
 * The one place an e2e flow stands its TestingModule up: compile() instantiates the provider
 * graph and init() runs the providers' onModuleInit. An app's world boot calls this and then
 * assembles its own world object off the returned moduleRef; a flow that needs a provider
 * override states it on that moduleRef rather than rebuilding a graph.
 */
export async function bootE2EModule<M extends E2EModuleHandle>(
    host: E2ETestingHost<M>,
    imported: unknown | Array<unknown>,
): Promise<M> {
    const moduleRef = await host.createTestingModule({
        imports: Array.isArray(imported) ? imported : [imported],
    }).compile()
    await moduleRef.init()
    return moduleRef
}
