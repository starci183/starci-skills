# Page model output

The output is a product-semantic model at `state.generate / ready`:

- one journey with entry and terminal outcome;
- one ordered set of pages;
- one dominant task for each page;
- product Blocks that normalize raw content into named responsibilities;
- one global journey-progress Block when the flow crosses pages;
- page references to that global owner rather than duplicated local progress state.

Every Block says what it does, what content or data it owns, which user intent it serves and which business evidence supports it. Blocks remain above Grammar branches, composites and leaves. The model contains no grid classes, column spans, sticky behavior, component package paths or visual styling.

This stage creates one model for the approved flow. It has no approval checkpoint.
