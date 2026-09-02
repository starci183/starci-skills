# StarCi Core Grammar — mục lục đọc

Nhánh này mô tả một visual family: StarCi Core. Luật UI universal vẫn canonical tại [knowledge/ui](../../ui/INDEX.vi.md); nhánh này chỉ map các luật X-n đó vào family Core đang chạy.

## Chuỗi authority

`knowledge/ui X-n → @starci/grammar/common props/anatomy/state → @starci/grammar/core DNA và scoped CSS → product adapter`

- Common sở hữu public renderer, props, semantic DOM, accessibility, presentation state, universal spacing, `COMMON_GRAMMAR_COMPONENTS` và `defineGrammarFamily`.
- Core là sibling family có id `core`; `CoreGrammarRoot` cài `data-grammar-family="core"`.
- Feature code sở hữu domain fact, route, copy, permission, persistence và effect.
- Tên product như Learn, Console, Dashboard, Navbar hay Course không bao giờ trở thành Grammar identity.

## Thứ tự đọc

1. [Family và DNA](family.vi.md) — identity, token, hướng CSS, binding X-n và gap đã biết.
2. [Cách dùng](consumption.vi.md) — import, chọn root, family factory và boundary ownership.
3. [Ma trận component](components.vi.md) — đủ 41 Common public renderer và cách Core hiện thực.
4. [Field, action và state](states.vi.md) — input, command, destination, pending, feedback, focus và motion.
5. [Surface và composition](composition.vi.md) — material, vị trí label, layout, navigation, responsive và media/art direction.

## Gate review

Thay đổi hợp lệ không import renderer từ `@starci/grammar/core`, Common CSS không import Core CSS, Grammar không có feature-named component, không lặp luật X-n và không drift EN/VI. Claim riêng của Core phải resolve được tới source đang chạy hoặc ghi rõ là gap.
