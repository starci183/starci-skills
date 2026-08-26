# `context/freshness-check` output

## JSON architecture

`state` emits `fresh`, `initialize-required`, or `blocked`; `produced` contains the metadata-only receipt decision. All operator state remains ephemeral and is purged at the parent skill-terminal.
