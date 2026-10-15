Owner: knowledge/hfs/rules.yaml

# Managed tooling boundaries

## Local tool configuration

`HFS_TOOL_CONFIG_LOCAL` rejects a second tool configuration, a repository-defined lint rule, configuration keys in package manifests, and commands that replace the canonical configuration. Keep the managed factory configuration at its rendered filename and run the tools without configuration override flags. The same boundaries apply in lite and full.

## Rendered lint configurations

`HFS_RULE_OFF_WITHOUT_REPLACEMENT` reports an ESLint configuration or front-end stylelint configuration that differs from its managed render. The factory call is the entire configuration; adding a local rule override, including an off or warning level, changes that render. Run `starci app sync --write` to restore the canonical file in either edition.

## Canonical formatting

`HFS_FORMAT` reports tracked files that the repository's installed Prettier would change or cannot parse. Format the file with the pinned Prettier and the managed configuration, then check it again. The formatter uses the repository's ignore file and excludes package lockfiles in both editions.
