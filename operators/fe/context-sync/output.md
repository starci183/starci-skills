# `fe/context-sync` output

## JSON architecture

The output state is `reused`, `updated`, or `blocked`. It records the canonical coding-context manifest, generation hash, snapshot hash, active Qdrant generation, and actual durable writes. Context lineage lists metadata plus only changed bodies that were loaded. Session intermediates are purged at skill-terminal.

Qdrant is a derived candidate index. The canonical JSON generation remains the authority for exact component and contract verification.
