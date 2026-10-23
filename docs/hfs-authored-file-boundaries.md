Owner: knowledge/hfs/rules.yaml

# HFS authored file boundaries

## R94 slot file roles

`FE_SLOT_FILE_ROLE` means a front-end directory contains a file that its slot does
not name, or a file occupies the place where the slot expects an owning folder.
Keep hook files within a hook domain and use only the roles declared by that
slot's `requires` and `allows` entries. A route `page.tsx` belongs to a route
directory, not a hook domain. Test paths are owned by R97 instead.

## R96 document language

`HFS_DOC_NOT_ENGLISH` rejects non-English document content in Markdown and YAML
under `knowledge/`, `docs/`, `src/` and `apps/`, including code fences. In both
editions, only YAML data in message-catalog or i18n-fixtures slots may contain
localized text. A Markdown README in such a directory is still English prose.

## R97 front-end test exclusion

`FE_NO_TESTS` rejects front-end test files, test directories, test configuration,
test scripts and testing dependencies in both editions. The restriction includes
files under `scripts/` and every front-end package manifest. Keep production
source and build or lint scripts; remove test tooling from the front-end side.

<a id="r303"></a>

## R303 no bypass of a check

`HFS_BYPASS_MARKER` rejects, in both editions and in every side, the text that makes a check pass
without satisfying it: an inline disable of any tool (ESLint, stylelint, TSLint, Prettier, Biome), a
type-check escape (`@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`), a Sonar exclusion comment, an
istanbul, c8 or v8 coverage ignore, a skipped, focused or todo test or a skip option, and a failure
swallowed in a hook, script or workflow (`|| true`, `continue-on-error`, `set +e`, `HUSKY=0`,
`--no-verify`, `fail_ci_if_error: false`). A front end has no specs, but its source is still judged
for the inline disables. `starci app check` reads the tracked tree; `starci app hygiene`, which the
managed pre-commit hook runs, reads the staged files from the index, so a bypass fails at the commit.
Fix the cause and delete the marker.
