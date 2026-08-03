# Landing and app are separate surfaces — apex domain vs `app.` subdomain

> A marketing landing and the product it sells are not one surface. The landing is public,
> SEO-first, mostly static, and changes on a marketing cadence; the product is authenticated,
> dynamic, and ships on a feature cadence. They differ in audience, in caching, in who edits them and
> how often — so they get their own host, and, when the code splits too, one monorepo rather than two
> repos. Keeping them on one indistinct surface is how the app's auth weight slows the landing's SEO,
> and how a marketing copy tweak waits on an app release.

## The domain rule

- **The marketing landing lives at the apex domain** — `domain.com` (and `www.domain.com`). Public,
  indexable, mostly static.
- **The product app lives at the `app.` subdomain** — `app.domain.com`. Authenticated, dynamic.
- Same brand, two hosts, two deploy pipelines. State the pair explicitly whenever the topology is set
  up, because a landing accidentally served from `app.` inherits the app's auth and cache rules and
  quietly loses its SEO.

## When the code splits, split into ONE monorepo — not two repos

Splitting the code follows splitting the surface, but the split is one repository with two apps, not
two repositories:

```
domain/
  apps/landing     -> domain.com        (marketing)
  apps/app         -> app.domain.com    (product)
  packages/ui      -> the ONE design system (read from the one storybook, tokens in one globals.css)
  packages/config  -> shared tsconfig / eslint / tailwind
```

Next.js supports this first-class (Turborepo, or pnpm/npm workspaces with `transpilePackages`); each
app builds and deploys to its own domain. Two SEPARATE repositories would force the design system to
be published-and-versioned or copied between them — which drifts, the exact single-source failure the
one-book rule prevents (`starci-setup-storybook`, and [[single-source-render]]). A monorepo shares the
design system, the tokens and the types **once**, so the two surfaces cannot fall out of step.

## Not a reason to split early

A single app can serve the landing at `/` and the product under `/dashboard`, and split later by
subdomain with a rewrite. Splitting adds a second build-and-deploy surface, so it earns its keep only
when the marketing and product cadences — or teams — genuinely diverge. Until then, one app with the
landing at the root is the smaller, honest setup; the domain rule above is what the split resolves to
when it comes, not a thing to build on day one.

## Exception — one domain, middleware decides by situation

The apex-vs-`app.` split is the default, not the only shape. A product may keep a SINGLE app on a
SINGLE domain and let MIDDLEWARE choose which surface renders from the request — the visitor's
situation (auth state, path, entitlement) picks landing versus app, instead of a subdomain doing it.
StarCi Academy runs this way: one host, and middleware routes a logged-out visitor to the marketing
surface and a signed-in one into the app.

The trade is explicit: one deploy and one domain, at the cost of the app's weight and auth sitting
behind the same host as the landing (so the SEO and caching benefits of a dedicated apex host are
given up). Which topology a product uses — the subdomain split above, or middleware on one domain —
is the product's decision, and the one it chose is recorded either way so a reader knows where the
landing actually lives. Graduate from the middleware form to the `app.` split when the marketing and
product cadences diverge enough to want separate hosts and pipelines.
