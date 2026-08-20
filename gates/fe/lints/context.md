# Frontend lint router

## LOADS

None.

## Routes

Run the repository's canonical frontend lint gate before loading a child gate. Child gates are routed
only after the lint machine emits a finding. A clean run stops here: do not load every lint module.
For each emitted rule, load the exact child runtime record below. Load more than one child only when
the machine emitted rules from more than one row. Bare and plugin-qualified rule names route identically.

| Emitted rule | Situation | Trigger | Load |
|---|---|---|---|
| `require-export-jsdoc` | COMMENTS-1 | an exported declaration lacks its required JSDoc | `comments/context.md` |
| `no-second-language-in-source` | COMMENTS-2, COMMENTS-3 | source text, comments or identifiers contain the second language | `comments/context.md` |
| `no-emoji-in-source` | COMMENTS-4 | an emoji or pictograph appears in governed source | `comments/context.md` |
| `no-literal-structural-class` | CONTRACT-1 | a call site writes or hoists a structural class | `contract/context.md` |
| `no-class-composition-outside-contract` | CONTRACT-2 | class composition or interpolation occurs outside the contract | `contract/context.md` |
| `only-the-frame-wears-a-node` | CONTRACT-4 | `contractNodeProps` is called outside the frame | `contract/context.md` |
| `contract-why-is-a-reason` | CONTRACT-6 | a contract reason is too short or merely restates the key | `contract/context.md` |
| `no-structural-host-outside-contract-frame` | CONTRACT-7 | a caller opens or styles the structural host | `contract/context.md` |
| `no-hand-written-contract-attrs` | CONTRACT-8 | `data-node` or `data-why` is handwritten | `contract/context.md` |
| `no-duplicate-entry-shape` | CONTRACT-9 | two contract entries duplicate classes, host and slots | `contract/context.md` |
| `no-unknown-contract-key` | machine-only identity | a requested contract key is absent | `contract/context.md` |
| `no-interaction-class-in-entry` | CONTRACT-12 | a contract entry owns interaction, paint or elevation | `contract/context.md` |
| `no-dead-contract-key` | CONTRACT-13 | a contract key has no reachable consumer | `contract/context.md` |
| `contract-children-are-typed` | CONTRACT-11 | a contract child/slot declaration omits or contradicts its typed owner and cardinality | `contract/context.md` |
| `no-structural-arrangement-in-leaf` | CONTRACT-1, CONTRACT-7 | a leaf arranges multiple structural contents and therefore escapes the contract boundary through its tier exemption | `contract/context.md` |
| `export-matches-folder` | FILE-1 | a surface's named export differs from its folder | `file-layout/context.md` |
| `surface-folder-two-files-only` | FILE-2 | a surface folder contains files beyond its closed pair | `file-layout/context.md` |
| `unit-test-colocated` | FILE-9 | a frontend unit must be a colocated `.spec.` beside its owner; `.test.` and separate unit/E2E trees are refused | `file-layout/context.md` |
| `no-helper-folder-in-components` | FILE-3 | a helper-like folder appears in the component tree | `file-layout/context.md` |
| `no-runtime-namespace` | FILE-4 | a runtime namespace object is introduced | `file-layout/context.md` |
| `monorepo-tier-belongs-to-its-side` | FILE-5 | feature tiers cross the app/shared-package boundary | `file-layout/context.md` |
| `route-tree-holds-routes-only` | FILE-6 | non-route implementation lives in the route tree | `file-layout/context.md` |
| `source-tier-marker-matches-folder` | FILE-7 | a declared source-tier marker disagrees with the file's actual tier folder | `file-layout/context.md` |
| `no-shell-tier` | FILE-8 | a retired shell tier or shell-shaped source boundary is introduced | `file-layout/context.md` |
| `no-off-scale-glyph-size` | ICON-1 | an icon size is fractional, arbitrary or off the approved scale | `icon/context.md` |
| `no-vendor-icon-outside-icon-leaf` | ICON-6 | a vendor glyph is imported outside the icon leaf | `icon/context.md` |
| `heroicons-is-the-glyph-vendor` | ICON-7 | a glyph package is outside the approved Heroicons families | `icon/context.md` |
| `no-decorative-icon-in-metric-cell` | ICON-10 | a metric cell contains a decorative icon | `icon/context.md` |
| `rank-artwork-is-a-closed-set` | machine-only identity | rank artwork falls outside its closed identifier and asset set | `icon/context.md` |
| `routed-page-is-a-main-landmark` | LANDMARK-4 | routed page chrome lacks its main landmark | `landmark/context.md` |
| `main-landmark-belongs-to-a-route-file` | LANDMARK-5 | a lower tier opens the main landmark | `landmark/context.md` |
| `no-inline-lint-config` | LINT-ESCAPE-1 | source contains an inline ESLint directive | `lint-escape-hatch/context.md` |
| `no-resting-twin-component` | LOADING-1 | a separate resting/loading twin component exists | `loading/context.md` |
| `no-placeholder-prop` | LOADING-1 | a ready-made placeholder tree crosses a prop boundary | `loading/context.md` |
| `no-resting-branch-at-call-site` | LOADING-2 | a call site branches between waiting and ready roots | `loading/context.md` |
| `prefer-arrow-export` | NAMING-1 | a top-level exported function declaration is used | `naming/context.md` |
| `handler-on-prefix` | NAMING-2 | a handler name begins with `handle` instead of `on` | `naming/context.md` |
| `no-second-language-in-path` | NAMING-3 | a governed path segment uses the second language | `naming/context.md` |
| `no-inline-parameter-type` | SLOTS-3 | a destructured parameter carries an inline object type | `props-and-slots/context.md` |
| `no-children-slot` | SLOTS-4 | a governed surface exposes a generic `children` slot | `props-and-slots/context.md` |
| `no-surface-list-items-slot` | SLOTS-7 | a surface accepts pre-shaped list items rather than owned data | `props-and-slots/context.md` |
| `no-public-classname-prop` | SLOTS-6 | a public props surface exposes a generic `className` appearance door | `props-and-slots/context.md` |
| `no-per-part-classname-prop` | SLOTS-6 | a public props surface exposes a `<part>ClassName` appearance door | `props-and-slots/context.md` |
| `no-public-frame-css-props` | SLOTS-6 | a non-leaf public surface exposes CSS-shaped frame props | `props-and-slots/context.md` |
| `no-css-door-type-laundering` | SLOTS-6 | `Omit`, `Pick` or `Exclude` launders an appearance door through a public props type | `props-and-slots/context.md` |
| `api-client-attaches-the-locale` | LOCALE-1 | the terminal HTTP client omits locale attachment | `served-locale/context.md` |
| `locale-header-belongs-to-the-link` | LOCALE-5 | `x-locale` is attached outside the locale link | `served-locale/context.md` |
| `presentational-purity` | SPLIT-1 | a presentational component reaches into state or services | `the-split/context.md` |
| `connected-block-has-presentational-twin` | SPLIT-5 | a connected block lacks or bypasses its presentational twin | `the-split/context.md` |
| `no-fractional-step` | TOKEN-3 | a static utility uses a fractional measurement | `tokens/context.md` |
| `no-arbitrary-value` | TOKEN-4 | spacing or size uses a bracketed arbitrary value | `tokens/context.md` |
| `no-hand-rolled-heading` | TOKEN-5 | utility classes recreate heading typography | `tokens/context.md` |
| `no-unresolved-token-class` | TOKEN-9 | a class names a theme variable not defined by loaded CSS | `tokens/context.md` |
| `no-copy-resolution-below-block` | COPY-1 | copy is translated below the block boundary | `translation/context.md` |
| `no-hardcoded-copy-in-vocabulary` | COPY-2 | governed copy is hardcoded instead of vocabulary-owned | `translation/context.md` |
| `no-double-cast` | TYPE-SAFETY-1 | a value is cast through an intermediate type | `type-safety/context.md` |
| `no-heading-tag-outside-heading-component` | TYPESET-1, TYPESET-2 | an intrinsic heading tag opens outside the heading component | `typography/context.md` |
| `vendor-boundary` | machine-only identity | a vendor component crosses the leaf, branch or block ownership boundary | `vendor-boundary/context.md` |
| `modal-branch-owns-scroll-body` | machine-only identity | `ModalBranch` does not own the required scroll body | `vendor-boundary/context.md` |
| `field-input-uses-secondary-variant` | machine-only identity | the house Field input uses the wrong vendor variant | `vendor-boundary/context.md` |
| `field-label-is-text-only` | machine-only identity | an icon appears inside a Field label | `vendor-boundary/context.md` |
| `no-surface-branch-in-overlay` | machine-only identity | an overlay imports a surface branch | `vendor-boundary/context.md` |
| `text-link-uses-hero-link` | machine-only identity | a text link bypasses the owned HeroUI Link path | `vendor-boundary/context.md` |
| `account-control-owns-dropdown` | machine-only identity | dropdown ownership escapes the account-control chain | `vendor-boundary/context.md` |
| `auth-overlay-owns-single-content-host` | machine-only identity | an auth overlay lacks or duplicates its content host | `vendor-boundary/context.md` |
| `checkbox-keeps-compound-anatomy` | machine-only identity | checkbox compound anatomy is broken | `vendor-boundary/context.md` |
| `no-internal-starci-href` | machine-only identity | a governed component owns an internal StarCi href | `vendor-boundary/context.md` |

## Unknown findings

If the canonical frontend gate emits a rule absent from this table, stop and report an unaccountable machine rule. Do
not guess a neighboring module and do not load the full shelf.
