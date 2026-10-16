Owner: knowledge/hfs/rules.yaml

# Runtime source hygiene

The runtime gate applies these tracked-source checks in both lite and full editions. The proof spec builds its invalid bytes and host paths in memory, alongside portable passing sources.

## R126

`RT_CONTROL_CHARACTER` rejects raw control bytes U+0000 through U+001F, except tab, LF and CR, and U+007F in tracked text source. Write an escape such as `\0`, `\b` or `\u001b` instead. The check covers JavaScript, TypeScript, YAML, Markdown and JSON extensions listed by the rule; generated runtime copies are excluded. A finding identifies the first offending byte, its line and the number of offending bytes in that file.

## R127

`RT_ABSOLUTE_PATH` rejects hard-coded drive paths, user-profile paths and expanded AppData paths. Resolve paths from the runtime root, `os.tmpdir()`, configuration or a state-root helper, and construct test fixtures from their temporary directory. An unexpanded `%LOCALAPPDATA%` name is accepted.

In source files, the checker reads string and template values and comments through the syntax tree. URLs and generic drive-pattern regular expressions are accepted. In supported text formats, including YAML, JSON and Markdown, it checks line text; package lock files are excluded.
