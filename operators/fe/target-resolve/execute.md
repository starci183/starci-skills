# Execute `fe/target-resolve`

Resolve one exact frontend target and routed checkout.

Preserve the frozen `uxUiChangeLevel` from `knowledge/ux-ui-change-levels.md`. Resolve only targets
whose existence and requested mutation boundary match that level; otherwise return `blocked` with the
exact scope question required.

Use StarCi-native frontend authority from `knowledge/ui.md` and the routed project Grammar. Follow `AI-first -> Rules-first -> Grammar-last`. Return only this atomic result; never route internally. 
