---
title: InnerLayout src twin connected but staged (app route not swapped)
role: fe
state: open
cost: medium
opened: 2026-08-03
rule: src-tier-ported-but-unused
paths: [src/components/layoutsv2/InnerLayout/index.tsx, src/components/layoutsv2/InnerLayout/component.tsx, src/app/InnerLayout.tsx]
---

## What is wrong

The InnerLayout app-shell twin is now CONNECTED: index.tsx takes only `children` (like LearnShell) and resolves the whole Navbar + Footer data surface itself — nav routing + logo (pathConfig + @/i18n router), search trigger (useSearchOverlayState), locale switch (router.replace idiom), theme toggle (next-themes), cart, notifications (useQueryMyNotificationsSwr + mark-read/mark-all-read mutations + queryResolveRoute mapped to NavbarNotificationItem[]), account/auth (keycloak.authenticated + state.user.user + auth overlay + sign-out mutation + link-GitHub overlay), mobile drawer (local UI state), Footer explore/support links + founder socials + terms/privacy, and showFooter (regex lifted verbatim from v1 src/app/InnerLayout.tsx).

The ONLY remaining deferral: it is still STAGED. src/app/[locale]/layout.tsx renders the v1 src/app/InnerLayout.tsx; nothing imports this twin yet. The v1 app shell additionally owns app-tier chrome that does NOT belong in a presentational shell twin (provider stack, AppSplash, TopLoader, AmbientBackgroundGate, SocketConnectionStatus, modal/drawer/toast/cookie containers, the ContentAiChatRail split) — those must be resolved by the eventual root-layout migration, not here.

Honest prop gap: the v1 shell Navbar renders no cart, but the presentational Navbar requires `cartCount`/`onCartPress`. These are sourced from the app's REAL cart (useQueryMyCartSwr count + useMiniCartOverlayState open) rather than fabricated — but the shell has never surfaced a cart, so this pairing is unproven in the shell context and should be reviewed when the route is swapped.

## Why it was left

The root-layout swap and the app-tier chrome above are genuinely app/ concerns, out of scope for a presentational shell twin's connected boundary. Swapping src/app/[locale]/layout.tsx onto this twin without also porting the provider stack + global containers would break the running app, so the swap is deferred until that migration is planned as its own unit.

## What paying it looks like

Migrate the root layout onto the twin: mount InnerLayout (this connected file) from src/app/[locale]/layout.tsx (or a thin app wrapper) with the provider stack + global overlay/toast/cookie containers + ContentAiChatRail split composed around it, retire the v1 src/app/InnerLayout.tsx + src/components/features/{navbar,footer}, and confirm the cart trigger belongs in the shell (or drop it) as part of that review.
