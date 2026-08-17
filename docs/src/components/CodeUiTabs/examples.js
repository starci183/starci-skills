"use client";

// Live example registry for `<CodeUiTabs example="…" />` in a published record.
//
// One entry per example id:
//   "id": {title: "…", code: "…", render: () => <Preview />}
//
// `render` draws the real component from the synced frontend source (`@/…` resolves into
// `.academy-src`); `code` is the snippet shown under the Code tab. The v3 tree owns no examples
// yet, so an unknown id renders a visible "not found" notice instead of failing the build.
export const EXAMPLES = {};
