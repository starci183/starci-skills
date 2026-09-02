# StarCi Core Grammar — mục lục đọc

Nhánh này mô tả một visual family: StarCi Core, và cái gu chỉ đạo cách ghép nó. Luật UI universal vẫn canonical tại [knowledge/ui](../../ui/INDEX.vi.md); nhánh này map các luật X-n đó vào family Core đang chạy và ghi lại những idiom StarCi thực sự dựng bằng. Nó không kể lại giải phẫu renderer — [DNA](DNA.vi.md), sinh ra từ package, đã nói cái gì tồn tại và mỗi renderer sở hữu cái gì.

## Chuỗi authority

`knowledge/ui X-n → @starci/grammar/common props/anatomy/state → @starci/grammar/core DNA và scoped CSS → product adapter`

- Common sở hữu public renderer, props, semantic DOM, accessibility, presentation state, universal spacing, `COMMON_GRAMMAR_COMPONENTS` và `defineGrammarFamily`.
- Core là sibling family có id `core`; `CoreGrammarRoot` cài `data-grammar-family="core"`.
- Feature code sở hữu domain fact, route, copy, permission, persistence và effect.
- Tên product như Learn, Console, Dashboard, Navbar hay Course không bao giờ trở thành Grammar identity.

## Thứ tự đọc

0. [DNA](DNA.vi.md) — sinh ra từ package: cái gì đang tồn tại. Mồi cho agent định hướng bằng đúng file này.
1. [Idiom](idioms.vi.md) — StarCi ghép những thứ đang tồn tại ra sao, mỗi idiom có ít nhất hai bằng chứng trong block đang chạy.
2. [Playbook](playbook.vi.md) — hình dạng nghiệp vụ nào đòi chuỗi idiom nào, và tham chiếu được góp gì.
3. [Family và DNA](family.vi.md) — danh tính riêng của visual family, token, hướng CSS, binding theme, và bảng gap duy nhất mà cả family công bố.
4. [Cách dùng](consumption.vi.md) — import, chọn root, family factory và boundary ownership.
5. [Ma trận component](components.vi.md) — đủ 41 Common public renderer và cách Core hiện thực.
6. [Field, action và state](states.vi.md) — input, command, destination, pending, feedback, focus và motion.
7. [Surface và composition](composition.vi.md) — material, đặt label, layout, navigation, hành vi responsive và hướng media/art.

Đọc 0 tới 2 để quyết định dựng cái gì; đọc 3 tới 7 khi một dòng làm nảy ra câu hỏi về chính family.

## Gate review

Thay đổi hợp lệ không import renderer từ `@starci/grammar/core`, Common CSS không import Core CSS, Grammar không có feature-named component, không lặp luật X-n và không drift EN/VI. Claim riêng của Core phải resolve được tới source đang chạy hoặc ghi rõ là gap.
