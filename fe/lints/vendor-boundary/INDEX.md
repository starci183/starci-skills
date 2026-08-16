---
id: fe-lints-vendor-boundary-index
title: INDEX.md
slug: /fe/lints/vendor-boundary
sidebar_label: vendor-boundary
sidebar_position: 0
description: What a machine can and cannot see of the vendor ownership law, rule by published rule name.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `vendor-boundary`

This shelf documents ENFORCEMENT, not law. The law is stated elsewhere; here we record which of it a
linter can actually observe, by what mechanism, and — the part that is usually left unwritten — what
it observes nothing of.

**A rule's identity is its published name.** The section headings below are those names verbatim,
because a name is what a build log prints, what a disable comment carries, and what every argument
about a failure refers to. No second numeric identifier is invented for any rule here.

**Reading convention for vendor strings.** The rules pin the component library by a package prefix
held in a constant (`VENDOR_PACKAGE_PREFIX`) and, in several rules, by an exact module specifier —
that package's React entry. Prose and examples write those as `<vendor-prefix>` and `@vendor/react`.
The substitution is one string; every mechanism below behaves exactly as written once it is made.

## Law

Vendor ownership is a closed list. Closed primitives under `leaves/`; the covering interaction
machines under `shells/`; the four named surface branches that project a typed content contract into
a vendor body. Everything else composes those owners.

The law is checked in BOTH directions, and the inward direction is the reason it is a policy rather
than a hole. Outward: a component importing the library from the wrong folder is misfiled. Inward: a
file sitting in a wrapper folder that wraps nothing is an ordinary component holding an exemption it
does not need — and without that check the folder becomes the place difficult things go.

The glyph library is deliberately somebody else's boundary. A rule that names one vendor protects one
vendor, and the gap between two such rules is where a glyph came to be imported directly at a size
that existed nowhere else, reported by nothing.

Codes carry the prefix `VENDOR-`.

## Rules

| Rule name | Code enforced | What it reports |
|---|---|---|
| `vendor-boundary` | `VENDOR-1`, `VENDOR-2` | A vendor import outside the owner set (`outside`); a shell folder that imports no vendor (`emptyShell`); a file under the shell folder that is not one of the named shells (`unknownShell`) |
| `modal-shell-owns-scroll-body` | `VENDOR-6` | The modal shell renders no vendor scroll body (`missing`); that body carries anything other than the zero-inset class (`inset`) |
| `field-input-uses-secondary-variant` | `VENDOR-7` | The house field renders the vendor input without the bounded-surface variant (`variant`) |
| `field-label-is-text-only` | `VENDOR-9` | A glyph rendered inside the field's label element (`icon`) |
| `no-surface-branch-in-overlay` | `VENDOR-8` | An overlay imports one of the four named surface branches (`nested`) |
| `text-link-uses-hero-link` | `VENDOR-10` | The text-link leaf never imports the vendor link (`missing`); it draws its own link with a raw button or a hover/underline class (`handmade`) |
| `account-control-owns-dropdown` | `VENDOR-11` | Shell without the vendor dropdown (`dropdown`); block without the shell (`shell`); block importing the vendor (`vendor`); navigation without the block (`menu`); an account icon button carrying its own action (`direct`); the block importing shell anatomy pieces (`pieces`) |
| `auth-overlay-owns-single-content-host` | `VENDOR-12` | The overlay opens a second projection host (`duplicate`); it never imports the projection host (`missing`); the centred column declares a vertical inset (`inset`) |
| `checkbox-keeps-compound-anatomy` | `VENDOR-13` | The compound control's required nesting is absent anywhere in the leaf (`anatomy`) |
| `no-internal-starci-href` | `VENDOR-14` | An internal destination written as an `href` literal or object value (`internal`); any `href` declared or rendered by an internal-only leaf (`leaf`) |

Ten rules published; ten mapped. No rule here enforces a code the law does not carry.

Three codes in the law have no rule on this shelf. `VENDOR-3` (surface branches keep typed
interiors) and `VENDOR-4` (no separate card shell) are **unenforced** — recorded as such in
`audit.md`, not repaired by inventing a mapping. `VENDOR-5` (glyph libraries keep their own
boundary) is deliberately delegated to the glyph module and is not a gap.

## Detection

Every mechanism below was read out of the rule bodies, not out of their names.

| Rule name | Mechanism |
|---|---|
| `vendor-boundary` | `context.filename`, forward-slash normalised, must contain `/src/components/`. Ownership is three substring/regex path tests: contains `/src/components/leaves/`; matches the four-name shell folder regex; matches the four-name surface-branch regex. Vendor detection is `ImportDeclaration` → `node.source.value.startsWith(<vendor-prefix>)`. A `Program:exit` visitor compares two booleans computed from the path (in the shell folder / is a named shell) against one boolean accumulated from imports |
| `modal-shell-owns-scroll-body` | Filename regex ending `/shells/ModalShell/index.tsx`. `JSXOpeningElement` whose `name` is a two-part `JSXMemberExpression` rendering the text `Modal.Body`. The inset check reads the `JSXAttribute` named `className` and requires `value.type === "Literal"` with value exactly `p-0`. `Program:exit` reports when no such member element was ever seen |
| `field-input-uses-secondary-variant` | Filename regex ending `/leaves/Field/index.tsx`. `ImportDeclaration` with `source.value` **exactly equal** to `@vendor/react`; every specifier whose `imported.name` is `Input` contributes its `local.name` to a binding set. `JSXOpeningElement` with a plain `JSXIdentifier` name in that set must carry a `variant` attribute whose value is the `Literal` `secondary` |
| `field-label-is-text-only` | Same filename regex as above. `ImportDeclaration` whose normalised `source.value` ends `/components/leaves/Icon`; specifiers named `Icon` contribute their local names. On each `JSXOpeningElement` using one of those bindings, the visitor walks `node.parent` upward looking for a `JSXElement` whose opening name is the lowercase `JSXIdentifier` `label` |
| `no-surface-branch-in-overlay` | `context.filename` must contain `/src/components/overlays/`. Single `ImportDeclaration` visitor; the normalised source must MATCH-AND-END with `/components/branches/<one of four names>` |
| `text-link-uses-hero-link` | Filename regex ending `/leaves/TextLink/index.tsx`. Import presence: any specifier `imported.name === "Link"` from the exact source `@vendor/react`. Two independent reports on `JSXOpeningElement`: the name being the lowercase `JSXIdentifier` `button`, and a `className` attribute whose `Literal` text matches `/(?:hover:\|underline)/`. `Program:exit` reports absence of the import |
| `account-control-owns-dropdown` | Three filename regexes select the shell `index.tsx`, the block `component.tsx` and the navigation `component.tsx`. `ExportNamedDeclaration` in the shell is checked by RAW SOURCE TEXT (`sourceCode.getText`) against `/\bDropdownShell(?:Item\|Section)\b/`. Imports drive one shared `hasOwner` flag per file role; the block additionally reports on any import from the exact vendor source, and on specifiers whose imported names start with the anatomy-piece prefixes. In the navigation, a `JSXOpeningElement` named `IconButton` is inspected for a `props` attribute holding an `ObjectExpression` with a `Property` `icon` whose value is the literal `account`, together with any attribute named `on` |
| `auth-overlay-owns-single-content-host` | Two filename regexes: the overlay `component.tsx`, and the contracts `index.ts`. In the overlay, detection is by IMPORTED NAME rather than import path — `ContractContent` sets a flag, `Tree` reports immediately. In the contracts file, a `Property` whose key is the centred-column token is read as RAW SOURCE TEXT and tested against a regex requiring a QUOTE CHARACTER immediately followed by `py-`, `pt-` or `pb-` |
| `checkbox-keeps-compound-anatomy` | Filename regex ending `/leaves/Checkbox/index.tsx`. Three file-wide booleans set from two-part `JSXMemberExpression` names, with a hard-coded local object name: the content part seen at all; the control part seen with a content ancestor; the indicator part seen with a control ancestor. `Program:exit` reports if any is false |
| `no-internal-starci-href` | Widest scope on the shelf: any path containing `/src/` that is not a test file. A second filename regex marks the four internal-only leaves. `JSXAttribute` named `href`, `Property` keyed `href` or `externalHref`, and `TSPropertySignature` named `href` are the three nodes visited. Value reading accepts a `Literal` string or a `TemplateLiteral` **with zero expressions**; internality is `startsWith("/")` or a pinned public-host regex |

## Escape Hatches

### Closed

| Rule name | A reader might expect this to slip past | Why it does not |
|---|---|---|
| `vendor-boundary` | Importing a subpath of the library instead of its main entry | Vendor detection is a PREFIX test, so every subpath is the same import |
| `vendor-boundary` | Creating a new folder under the shell tree and simply not importing the vendor there | The inward half reports on folder membership alone: a file under that folder that is not one of the named shells is reported with no import required |
| `vendor-boundary` | Putting a wrapper in a shell folder that wraps nothing | `emptyShell` reports at program exit precisely for that shape |
| `modal-shell-owns-scroll-body` | Deleting the scroll body entirely rather than fixing its padding | Absence is its own report at program exit |
| `field-input-uses-secondary-variant` | Renaming the import locally to hide it | The binding set keys on the IMPORTED name and tracks whatever local name it was given |
| `field-input-uses-secondary-variant` | Omitting the variant attribute rather than setting the wrong one | Absence and wrong value share one report |
| `field-label-is-text-only` | Burying the glyph several elements deep inside the label | The ancestor walk is unbounded in depth |
| `text-link-uses-hero-link` | Hiding the hand-drawn hover on an inner element rather than the root | Both reports fire on ANY opening element in the file, not only the exported root |
| `account-control-owns-dropdown` | Re-exporting the anatomy pieces under an aliased export name | The check reads the raw text of the export declaration, so an alias containing the piece names is still matched |
| `auth-overlay-owns-single-content-host` | Publishing the same branches from a package so the import path differs | Detection is by imported NAME, deliberately, so it holds wherever the module resolves from |
| `checkbox-keeps-compound-anatomy` | Inserting wrappers between the compound parts | Each nesting test is an ancestor walk, not a parent check |
| `no-internal-starci-href` | Writing the path in backticks instead of quotes | A template literal with no expressions is read as a string |
| `no-internal-starci-href` | Declaring the field in a type instead of rendering it, inside an internal-only leaf | The type property signature is visited too |

### Open

Every row is a way of writing that this rule genuinely does not catch.

| Rule name | Genuinely not caught |
|---|---|
| `vendor-boundary` | **Only `ImportDeclaration` is visited.** A dynamic `import()`, a `require()`, and — most importantly — a re-export (`export { X } from "<vendor>"`) are different node types. The re-export leaks twice: the vendor arrives unreported, AND the shell that obtained it that way is reported as empty |
| `vendor-boundary` | **A barrel inside a legal owner folder.** One file under the leaf folder that re-exports the library wholesale turns every subsequent import into a legal local path with nothing to report |
| `vendor-boundary` | **Folder membership is the entire ownership test.** Moving a misfiled panel into the leaf folder makes it a lawful vendor owner; nothing checks that a leaf is a closed primitive |
| `vendor-boundary` | **Path scoping.** The whole rule requires `/src/components/` in the path. A component tree that lives anywhere else is not merely exempt — the law does not exist for it |
| `modal-shell-owns-scroll-body` | **Alias and destructure.** The member name is compared as text. Rendering the same body through a renamed object, or through a destructured part, is invisible to the inset check — and in a file that already satisfies the presence check elsewhere, nothing reports at all |
| `modal-shell-owns-scroll-body` | **Padding arriving by a different prop.** Only the `className` attribute is read. A slot-style object prop carrying the inset is never inspected |
| `modal-shell-owns-scroll-body` | **Filename scoping.** The gate is one exact file name; the same shell split across a differently named file stops being governed |
| `field-input-uses-secondary-variant` | **The source must be exactly equal.** A subpath import of the same component satisfies nothing, so the binding set stays empty and the rule silently has no work to do |
| `field-input-uses-secondary-variant` | **Namespace import.** Rendering the component as a member expression yields no plain identifier name, and the visitor returns immediately |
| `field-input-uses-secondary-variant` | **Non-JSX creation.** An element built through a factory call is not an opening element |
| `field-label-is-text-only` | **Only a lowercase label ELEMENT is an ancestor.** A glyph passed into a label PROP, or placed inside a house label component, is outside the only relationship the rule can see |
| `field-label-is-text-only` | **One import path defines what a glyph is.** A glyph imported straight from the glyph package, or through a barrel, is not in the binding set — which is exactly the gap the source header warns about |
| `no-surface-branch-in-overlay` | **Relative imports miss entirely.** The path test requires the `components/branches/` segment; a relative specifier that climbs out of the overlay folder does not contain it |
| `no-surface-branch-in-overlay` | **Barrel or deep import.** An import of the branches index, or of the branch's own inner file, fails the end-anchored match while rendering the same surface |
| `no-surface-branch-in-overlay` | **It bans an import, not a render.** A thin local re-wrapper of the same branch mounts it with nothing reported |
| `text-link-uses-hero-link` | **Constants launder literals.** A hover or underline class gathered into a constant, a template literal or a class-merge call is not a `Literal` attribute value, and the substring test never runs |
| `text-link-uses-hero-link` | **Import presence is the whole proof.** Importing the vendor link and never rendering it satisfies the rule completely |
| `text-link-uses-hero-link` | **One tag and two substrings.** An anchor or a role-carrying container that draws its own affordance with a bottom border is neither a raw button nor a matching class string |
| `account-control-owns-dropdown` | **Import presence again.** The navigation satisfies its report by importing the block; whether it renders it is never examined |
| `account-control-owns-dropdown` | **The direct-action check requires one literal shape.** The account identity must be an inline object property with a literal value, and the action must be an attribute named exactly `on`. Either detail moved into a variable, or the handler named anything else, and the check evaporates |
| `account-control-owns-dropdown` | **Anatomy pieces under other names.** The text regex knows two prefixes; a piece exported under any other name is not anatomy as far as this rule is concerned |
| `auth-overlay-owns-single-content-host` | **The inset regex is anchored to the quote.** It only matches a vertical padding class that is the FIRST token of the string. The same class written after any other class in the same list is not matched |
| `auth-overlay-owns-single-content-host` | **All-sides padding is not vertical padding to this rule.** A single all-sides class reintroduces the second band unmatched |
| `auth-overlay-owns-single-content-host` | **Default imports and namespaces.** Detection reads `imported.name`; a default import, or a member access off a namespace, carries no imported name to compare |
| `checkbox-keeps-compound-anatomy` | **The three flags are file-wide, not per-tree.** One correct compound control anywhere in the file satisfies all three booleans for every other, broken one beside it |
| `checkbox-keeps-compound-anatomy` | **The local object name is hard-coded.** The compound imported under any other local name matches no member text |
| `checkbox-keeps-compound-anatomy` | **The label position is never checked.** The rule proves three nestings exist; it does not prove the visible words sit inside the press target, which is the failure the law describes |
| `no-internal-starci-href` | **Any computed destination.** A template literal with an interpolation, a variable, a constant lookup or a concatenation returns no readable text and passes — and that is the most common way an internal path is actually written |
| `no-internal-starci-href` | **Arrays and other keys.** A path inside a plain array of strings is at no `href` property; and a destination carried under a differently named key is not one of the two keys read |
| `no-internal-starci-href` | **The internal test is one leading character plus one pinned host.** A second internal host, a staging domain or a path written without its leading slash is external as far as the rule can tell — while a protocol-relative external address is misread as internal |
| `no-internal-starci-href` | **The internal-only leaf list is four hard-coded folder names at one file name.** A fifth leaf of the same kind carries no blanket ban |

## Inputs

| Input | What the rules read |
|---|---|
| filename | `context.filename` (or `getFilename()`), normalised to forward slashes so a Windows path compares like any other |
| import graph | `ImportDeclaration` nodes only: the source string and each specifier's imported and local name |
| element tree | `JSXOpeningElement` names, as plain identifiers or two-part member expressions, plus ancestor walks through `node.parent` |
| attribute values | `JSXAttribute` values, accepted only as `Literal` (and, in one rule, an expressionless `TemplateLiteral`) |
| object literals | `Property` keys and values, for destinations and contract tokens |
| type declarations | `TSPropertySignature` keys, in one rule |
| raw text | `sourceCode.getText(node)` for two checks that reason about a declaration's written form |

## Invariants

- A rule's identity is its published name; nothing on this shelf assigns it a second identifier.
- Detection is static and single-file. No rule resolves a module, follows a re-export, or evaluates
  a value.
- Path tests are substring or regex tests over a normalised filename, never a resolved module graph.
- Attribute checks accept a literal or nothing; an expression is not evaluated, and each rule states
  which direction that pushes it.
- Ownership is decided by FOLDER, never by what a file contains.
- Both directions are enforced by the same rule: an import in the wrong place, and a place with no
  import.
- The severity the module asks for is uniform: every published rule at error.

## Exceptions

Each exception is closed and names what it applies to.

- **Outside the component tree.** A provider standing the library up for the whole application is
  not a component reaching for a widget, and the boundary rule returns before visiting anything.
- **The framework shell.** One shell owns a FRAMEWORK mechanic rather than a vendor one: it converts
  the children a segment layout is handed into what every tier below expects, and it imports no
  vendor at all. Demanding a vendor import there would force an import that means nothing, which is
  how a rule teaches somebody to add noise.
- **Test files.** The two program-exit reports of the boundary rule skip test and spec files, and
  the internal-destination rule skips them entirely. The boundary rule's import report does NOT skip
  them — recorded as a finding, not documented as an intention.
- **The glyph library.** Not an exception granted here so much as a boundary owned elsewhere: this
  module names one package prefix, and the glyph package is another module's rule.

## Output

A report from this module is an ESLint problem carrying:

```text
rule:      starci-fe/<published rule name>
messageId: <one of the ids listed in the Rules table>
node:      <the import, element, attribute, property or Program node>
severity:  error
```

There is no numeric code in the output, and none should be inferred. The `VENDOR-<n>` code names the
LAW the report defends; the rule name is what the report is.

## Load Policy

Read this file first. Read `vi.md` for what each rule catches and why the law deserves a machine,
`example.md` for firing and passing code including the code that slips through, `audit.md` while
reviewing whether this shelf still matches the source, and `changelog.md` for version history.

When a rule's behaviour and this record disagree, the source is right and this record is a finding.

## Scope

This module documents exactly the rules published by one law's rule file — no more, and nothing that
ought to exist but does not. A rule that cannot be pointed at is a proposal; proposals live in
`audit.md` under open risk.

Prose and examples here name no product, no library and no repository. Published rule names, message
ids and matched identifiers are reproduced verbatim, because those are the strings a build prints.

## Version Rule

Increment all five records by `0.01` for an accepted change and record it in `changelog.md`. A major
increment is reserved for a change in module shape or in the shelf it belongs to.
