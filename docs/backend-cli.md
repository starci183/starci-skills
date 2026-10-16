Owner: knowledge/hfs/rules.yaml

# Back-end application CLI

## Back-end CLI rules

Both lite and full put one-off application actions in the app named `cli`, with
kind `cli`, under `be/apps/cli`. A tracked command requires that declaration and
`be/apps/cli/Dockerfile`; a differently named CLI app or a missing image produces
`BE_CLI_REQUIRED` (R147). Full also requires the CLI when a back end declares a
connection for migrations. Lite delegates schema migration to the Supabase CLI,
so a connection alone does not require an application CLI.

The CLI entry calls nest-commander's `CommandFactory.run(...)`.
`BE_CLI_BOOTSTRAP` (R148) refuses an entry without that call and refuses HTTP
servers, microservice boot, and server adapters inside the CLI app.

`BE_CLI_COMMAND_SHAPE` (R149) keeps each nest-commander group `@Command` in
`be/src/features/cli/<group>/<group>.cli.ts` and each `@SubCommand` in
`be/src/features/cli/<group>/subs/<name>.cli.ts`. Each file declares one command,
and a sub-command extends nest-commander's `CommandRunner`. Keep its unit spec
beside it as `<name>.cli.spec.ts`; the colocated-unit-spec rule checks that
separate proof requirement. Run the image as `cli <group> <command>`.

`BE_CLI_OWNER` (R150) reserves nest-commander imports for the CLI app and CLI
feature root. Other back-end code must not open its own argument parser:
`process.argv`, commander, yargs, and minimist produce this finding. Add a CLI
sub-command for the action and delegate its work to the owning application or
domain service.
