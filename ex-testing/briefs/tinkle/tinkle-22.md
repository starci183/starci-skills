# tinkle-22 — .dist deletion + zero-reference sweep (WAIT-LANE)

Read `tinkle/_common-distless.md`. WAIT for done markers: tinkle-14,15,16,17,18,19,20,21 before starting (poll `ex-testing/lint/done/` every 2min; if a lane hasn't landed in 30min, proceed anyway and note it).

Mission:
1. Grep `\.dist` across `.claude/` (exclude node_modules, ex-testing/briefs, .dist itself, legacy/) → must be ZERO remaining live references
2. `rm -rf .dist` (gitignored — plain rm)
3. Cold-boot test: kernel entry + one check script + route scripts, all must run with no `.dist` present
4. Report `tinkle-22-REPORT.md`: sweep result + boot test evidence. Marker `done/tinkle-22.done`.
