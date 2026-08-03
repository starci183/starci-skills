---
title: Card/composite raw className carries appearance the closed AllowedClassName union excludes
role: fe
state: open
cost: medium
opened: 2026-08-03
---

## What is wrong

Card/composite raw className carries appearance the closed AllowedClassName union excludes

## Why it was left

Left over from the atomic className-drill fix (92 files cleaned, tsc green). These composites/block-cards keep a raw className/contentClassName/titleClassName/*ClassName string that carries APPEARANCE (radius/shadow/colored band), ARBITRARY SIZE (h-[84vh]), or load-bearing CONTAINER-QUERY placement (@lg:col-start-2) — exactly what AllowedClassName (positioning-only) deliberately excludes. So they cannot be mechanically routed through the typed classNames union without either extending the closed union with an appearance/size channel or accepting a documented escape, AND migrating dozens of app-wide callers. Files: starci-academy .storybook+src twins of composites/cards/SurfaceCard (contentClassName, 31 external callers + internal .PressableGroup TILE_CHROME), composites/chips/EnumChip (@deprecated, 2 off-limits _legacy callers), composites/viewers/PDFView (heightClassName h-[84vh]), and blocks/cards SurfaceListCard / SectionCard / LabeledCard / GroupPressableCard (raw className+contentClassName used app-wide, GroupPressableCard's per-item @lg:col-start-2 is real grid placement). Plus .storybook ModalShell WithLeadingTabs story drills bodyClassName. Needs a DESIGN decision (extend AllowedClassName vs documented escape) then an app-wide migration — a dedicated pass, not a prop deletion.

## What paying it looks like

_Not worked out yet._
