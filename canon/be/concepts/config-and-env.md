# Concept — Config: env vs app YAML vs mount keys

Source: `src/modules/env/`, `src/modules/filesystem/`.

Three configuration sources, and a value belongs to exactly one of them by its nature. Mixing them is
how a production value ends up unreachable without a deploy, or a business catalog ends up baked into
an image.

## Env — `src/modules/env/config.ts`, read as `envConfig().X.Y`

Infrastructure: paths, hosts, ports, credential locations, thresholds, and feature flags that differ
by environment (dev, staging, prod). Nothing reads `process.env` directly outside `config.ts`, and no
tunable value is hardcoded.

Parse with the matching parser — `parseEnvString`, `parseEnvInt`, `parseEnvMs("30m")`,
`parseEnvBool`. Names are `SCREAMING_SNAKE_CASE` prefixed by their domain, and every leaf carries a
`defaultValue` that lets the app run locally.

## App YAML — `.mount/config/app.yaml`, read as `mountFilesystemService.appConfig().X`

The business and runtime-ops catalog: the AI model list, payment provider IDs, thresholds — things an
operator changes without a deploy. Add the field to `src/modules/filesystem/types/config.ts` first,
then edit the YAML.

App-level config is YAML only. Do not add a `.json` file; the legacy `app.json` has already been
migrated.

## Mount keys — `.mount/...`, newline-separated

Arrays of API keys, read through `MountFilesystemService.{openAi,gemini,claude}ApiKeys()`. Never
through raw `fs`.

## Two traps that only appear at runtime

A `constants/` file that needs an env value wraps it in a **getter function**, never a top-level
`const`. Module load order puts the constant's evaluation before env is ready, so a top-level const
reads an empty value and nothing fails loudly.

Decorators are the opposite case: `@Cron`, `@Interval` and `@Throttle` take `envConfig().X.Y`
directly, because they are evaluated when the class loads rather than lazily.
