Owner: knowledge/hfs/rules.yaml

# Export and file liveness

## Export and file liveness {#export-and-file-liveness}

`HFS_UNUSED_EXPORT` reports a public entry export with no eligible consumer. Import the exported name where it is needed, or remove it. Public index exports need a consumer outside their owner; additional declared entries, such as operation and type files, follow their declared entry consumption boundary.

`HFS_UNUSED_FILE` reports production source that no application, route, or package root reaches through imports or re-exports. Connect the file to the production graph where it is needed, or remove it. A spec alone does not make production source reachable.

These checks apply to both back-end and front-end projects in the lite and full editions. The dedicated proof spec exercises a consumed public export and reached source alongside an unused export and unreachable source in every profile and edition.
