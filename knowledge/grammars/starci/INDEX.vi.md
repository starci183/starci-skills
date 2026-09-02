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

Đọc 0 tới 2 để quyết định dựng gì; đọc 3 khi một dòng đặt câu hỏi về chính family. Cách tiêu thụ gói trong code (import, một root family, cấm clone) là FE-IMPORTS-5 và FE-IMPORTS-7 trong knowledge/patterns/fe.

## Gate review

Thay đổi hợp lệ không import renderer từ `@starci/grammar/core`, Common CSS không import Core CSS, Grammar không có feature-named component, không lặp luật X-n và không drift EN/VI. Claim riêng của Core phải resolve được tới source đang chạy hoặc ghi rõ là gap.
