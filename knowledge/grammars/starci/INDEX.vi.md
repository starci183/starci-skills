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
6. [Surface](surface.vi.md) — giải phẫu SURFACE-1..5: một compound card duy nhất, nơi Core sơn vật liệu duy nhất, prop hình học đóng, quyền sở hữu state/action toàn mặt/cuộn/highlight, và gap cấp heading.
7. [Boundary](boundary.vi.md) — giải phẫu BOUNDARY-1..5: owner nào vẽ, lồng, đặt tên, nâng và cắt một vùng, và cái gì sống sót qua đổi state và viewport.
8. [Icon](icon.vi.md) — cơ chế ICON-1..6: hộp `Icon usage`, chip trạng thái, danh tính tab, mũi tên action, tiện ích chỉ có glyph, và đặt tên truy cập được.
9. [Media](media.vi.md) — cơ chế MEDIA-1..6: tỉ lệ, fit, treatment, caption của `MediaFrame`, và gap loading/error lẫn tiêu điểm.
10. [Control state](control-state.vi.md) — CONTROL-STATE-1..4: pending, không dùng được, skeleton và lựa chọn bền vững qua các prop đã công bố.
11. [Field](field.vi.md) — FIELD-1..4: nhãn, hướng dẫn, lỗi, tính khả dụng của `Input` và `OtpInput`, và bằng chứng chứng minh quan hệ đó.

## Gate review

Thay đổi hợp lệ không import renderer từ `@starci/grammar/core`, Common CSS không import Core CSS, Grammar không có feature-named component, không lặp luật X-n và không drift EN/VI. Claim riêng của Core phải resolve được tới source đang chạy hoặc ghi rõ là gap.
