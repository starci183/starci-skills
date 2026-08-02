# No uppercase text unless it is approved for that spot — STRICT

Typography ruling, 2026-06-24: *"rules không có chữ hoa nào thầy cho phép thì thôi"* — no all-caps
anywhere that has not been approved individually.

## The rules

**`uppercase` / `text-transform: uppercase` / hand-typed ALL-CAPS is banned in the UI** — labels,
eyebrows, tooltip titles, section labels, chips, badges. Text stays in sentence case, exactly as the
i18n source wrote it.

**Do not capitalise on your own initiative**, including eyebrows like "CHI TIẾT GIÁ" or "QUẢNG CÁO"
and caps-locked section labels. All-caps is only used where it has been approved for that specific
place.

**A secondary label is demoted with SIZE and COLOUR, not with case** — `text-xs text-muted`. Setting
a label in caps to make it "look like a label" adds visual weight to the least important text on the
surface, which is the opposite of what it needs. A quiet eyebrow is small and muted, not uppercase.

## First applied 2026-06-24

The `PriceTag` tooltip title "Chi tiết giá" lost its `uppercase tracking-wide` and became ordinary
sentence case. Remaining `uppercase` occurrences are cleaned up as they are encountered.
