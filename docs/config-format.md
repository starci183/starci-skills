# Local config format

StarCi keeps **local runtime preferences** in ignored `config.json` at the skill root. That file is never bundled into `.dist` and is not overwritten by install/update when it already exists.

## Example source

| File | Role |
| --- | --- |
| `config.example.yaml` | Preferred authored example (defaults: `language: vi`, `model: null`, `effort: medium`). |
| `config.example.json` | Legacy example mirror kept during migration; loaders still accept it when the YAML example is absent. |
| `config.json` | User-local runtime config. Always JSON. Created only when missing. |

## Init copy policy

`scripts/config.mjs` `loadConfig(root, {initialize:true})`:

1. If `config.json` already exists under `root`, load and validate it. Do not rewrite it from the example.
2. If absent, resolve the example in this order under the same `root`:
   - `config.example.yaml` (preferred authored source)
   - `config.example.json` (legacy mirror)
   - `.dist/config.example.json` (built projection after `ensure-build`)
3. Write a new `config.json` as pretty-printed JSON with the validated example values (`wx` create-only).

Existing user `config.json` files are not migrated to YAML and must not be modified by example updates. Build projects the example into `.dist/config.example.json` for runtime packaging; that projection is not a second authored source.

## Shape

Required keys only:

- `language` — BCP-47-like tag (`vi`, `en`, …)
- `model` — `null` (inherit host) or non-empty host model name
- `effort` — one of `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, `ultra`

## Related catalog ownership (not config)

| Path | Decision |
| --- | --- |
| `docs/catalog.json` | **Generated** by `scripts/build-docs.mjs` (also feeds `sites/skills/src/catalog.generated.json`). Do not author a parallel `docs/catalog.yaml`. |
| `README.yaml` / `INDEX.yaml` / `UPDATE.yaml` / `core/README.yaml` | Authored declarative metadata; YAML is the preferred source. JSON mirrors remain until a later delete pass. |
| `examples/*.yaml` (`nivo-setup-*`, `nivo-service-routing`) | Authored structured examples; YAML preferred. JSON mirrors remain until a later delete pass. Build projects them to `.dist/examples/*.json`. |
| `fixtures/forward-goal-report.yaml` | Authored synthetic evaluation narrative (`starci/fixture-report@1`), not an exact JSON wire fixture under test. Converted to YAML. Executable replay uses `fixtures/forward-goal/draft/**` (Work YAML). |
