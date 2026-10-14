# Full Supabase opt-in fixture

The full declaration enables Supabase through its primary back-end connection. The
database deployment workflow, project configuration, migrations, generated types
and Auth/Storage integration come from the shipped `examples/lite-app`
provider implementation, with the workflow and config naming this fixture's
project. Both editions use that implementation when the provider
is declared; the full edition owns its optional database workflow.

The fixture has no credentials and is inspected statically by
`tests/hfs/hfs-provider-fixtures.spec.mjs`. The copied workflow is evidence of the
release guard and sealed-custody flow; the test never executes its deployment.
