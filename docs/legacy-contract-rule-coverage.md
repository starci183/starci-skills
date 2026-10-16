Owner: knowledge/hfs/rules.yaml

# Application integration and GraphQL contracts

## R111

`HFS_PEER_INTEGRATION_MISSING` checks the app root `package.json` against
`knowledge/hfs/peer-integrations.yaml` in lite and full. When all packages and
named majors of an integration pair are present, its required peer must be a
runtime dependency. A peer listed only in `devDependencies` cannot satisfy a
production install. For example, Nest Apollo on `@nestjs/platform-express` 11
requires `@as-integrations/express5` in `dependencies`. A different driver major
or an absent integration does not activate that pair.

The dedicated peer integration spec proves missing and development-only peers
are refused and the matching runtime dependency passes in both editions.

## R113

`FE_GRAPHQL_CONTRACT` checks front-end GraphQL operations against the serving
back-end snapshot at `be/contracts/<service>/schema.graphql` in lite and full.
The service is selected by the operation's first root field. Every selected
field, argument and input must exist; required values must be supplied, variables
must match their argument types and be used, and selections must match scalar or
object results. The checker also judges static `gql` templates in front-end
source files. Invalid GraphQL or an operation with no serving contract is a
finding on its source.

The dedicated document spec proves an undeclared output field and a missing
required argument are refused, while a matching operation passes in both
editions. Contract snapshots are emitted from the application's own schema.
