/**
 * The declaration of the test world: selection and overrides only. The service list and the image versions come from the stack
 * definition (`.starcistacks/dev`); the library runs the Postgres of every connection real behind toxiproxy, migrates it once per
 * run through the cli app and boots the api apps in process.
 */
import { defineTestWorld } from "@starci/test-world"
{{appModuleImports}}
import { {{optionsImports}} } from "./test-apps.options"

export const { useTestWorld, useSandbox } = defineTestWorld({
    stack: ".starcistacks/dev",
    stacks: {
        postgresql: { connections: [{{connectionDeclarations}}] },
    },
    apps: {
{{worldApps}}
    },
    migrate: { module: migrateCli, options: cliOptionsOf },
    modules: { base: platformBase },
})
