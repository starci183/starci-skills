Owner: knowledge/hfs/rules.yaml

# Contract snapshots

## Committed contract snapshots

`HFS_CONTRACT_SNAPSHOT_DRIFT` requires each back-end API that serves GraphQL to
commit `be/contracts/<app>/schema.graphql`. An API with an operation table commits
`be/contracts/<app>/openapi.json`. Declare the corresponding optional contract slot
in `hfs.json`, run the `contract:emit` script of the back end package, and commit the generated artifact.

Both lite and full use this boundary. Front-end code generation reads the back-end
snapshots through `hfs.json`'s declared `be/contracts/` read; it does not keep a
second copy. A complete content check also regenerates each API's artifacts and
reports stale, unreadable, abandoned, or uncommitted snapshots and emit failures.

<a id="r302"></a>

## MCP tool catalogs

An app that serves an MCP server may commit the catalog its clients rely on at
`be/contracts/<app>/<contract>.tools.json` (slot `be.contract.mcp-tools`, opt-in: list it in
`hfs.json` `sides.be.optionalSlots`). `<contract>` is `<server>@<major>`, and the file is the
server's `tools/list` result: `{ contract, server: { name, version }, tools }`. The canon emits no
MCP catalog, so `HFS_MCP_TOOLS_SNAPSHOT` (R302, lite and full) judges the shape: the folder names a
declared back-end app, the contract equals the file name and the server name at an integer major,
and every tool has a unique name, a description and an object `inputSchema`. A breaking change to
the tools is a new major file, as for the event contract.
