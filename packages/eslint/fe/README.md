# @starci/eslint-canon-fe

The StarCi front-end lint canon for traditional React and TypeScript applications. It keeps
component ownership, accessibility, loading behavior, vendor boundaries, translations, naming,
and colocated class-name composition consistent without prescribing a custom rendering protocol.

```bash
npm i -D @starci/eslint-canon-fe
```

```js
import starciFe, { recommended, linterOptions, starciFeConfig } from "@starci/eslint-canon-fe"

export default [starciFeConfig({
  layout: "single-app",
  plugin: starciFe,
  recommended,
  linterOptions,
})]
```

The `single-app` layout governs `src/**`; `monorepo` governs shared package and app source trees.
The package publishes the plugin, recommended levels, repository audits, and layout helper from
the root entry point.

## Rules

Rules cover comments, file layout, icons and vendor ownership, landmarks, loading states, naming,
props, served locales, component splits, design tokens, translations, type safety, typography, and
class-name ownership. Reusable class names belong in a colocated `classNames.ts` module and should
be composed with HeroUI `cn` using one utility token per argument.

Grammar is a business-neutral HeroUI-backed component package. Its components accept ordinary
typed React props and children.

## Requirements

ESLint 9+ (flat config) and Node.js 20.9+.
