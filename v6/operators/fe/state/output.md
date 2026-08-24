# State output

State returns one of two results:

- `layout.generate / ready` when the state model is complete enough for layout;
- `state.result / blocked` when a sensitive state is required but business truth is missing.

The model is owned by product Blocks. It defines domain meaning, triggers, permitted actions, transitions and a neutral presentation state. Neutral presentation states such as `affirmative`, `caution`, `critical` and `pending` communicate intent without choosing a component or icon. A later Grammar maps them to generic treatment.

Missing facts involving money, access, entitlement, data loss, legal consequence or terminal outcome are recorded as unknown and blocking. They are never filled with a plausible default. Non-sensitive unknowns may be recorded as non-blocking only when they cannot change the journey, commitment or outcome.

No source code, layout direction or visual component is produced here.
