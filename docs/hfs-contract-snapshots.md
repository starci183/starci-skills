Owner: knowledge/hfs/rules.yaml

# Contract snapshots

## Committed contract snapshots

`HFS_CONTRACT_SNAPSHOT_DRIFT` requires each back-end API that serves GraphQL to
commit `be/contracts/<app>/schema.graphql`. An API with an operation table commits
`be/contracts/<app>/openapi.json`. Declare the corresponding optional contract slot
in `hfs.json`, run `npm run contract:emit`, and commit the generated artifact.

Both lite and full use this boundary. Front-end code generation reads the back-end
snapshots through `hfs.json`'s declared `be/contracts/` read; it does not keep a
second copy. A complete content check also regenerates each API's artifacts and
reports stale, unreadable, abandoned, or uncommitted snapshots and emit failures.
