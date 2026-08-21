---
title: StarCi deterministic frontend grammar · Vietnamese
---

# StarCi frontend grammar

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@grammar` | `grammars/starci/grammar.json` | file | luật đóng từ fact sang outcome |
| `@facts` | `grammars/starci/facts.json` | file | catalog fact quan sát được và đóng |
| `@capsules` | `grammars/starci/capsules.json` | file | behavior bền vững, ruling và binding case/template |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | chọn một winner tất định mỗi slot và emit context pack gọn |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | chứng minh identity, case, hash, template và provenance bị cấm |

## Record

Authority package này định nghĩa fact UI đóng của product family, outcome ngữ nghĩa, nghĩa vụ behavior,
owner theo project và principle concern tất định để resolver sử dụng. Nó chỉ được load khi workspace route khai
báo rõ grammar `starci` và một profile cụ thể như `starci-academy`.

Package tự chứa founder ruling, durable capsule, golden/counterexample case và file `.template.tsx`
được hash, nên vẫn dùng được khi mọi repository từng gợi ý behavior đó biến mất. Có thể đọc source khi
khám phá rule, nhưng source origin bị cấm trong package đã promote.

## Law

1. `GRAMMAR-1` — Chỉ resolve grammar và profile do workspace route đã verify khai báo.
2. `GRAMMAR-2` — Rule nhận fact id đóng và emit outcome cùng obligation đóng.
3. `GRAMMAR-3` — Mọi behavior được promote có founder ruling, durable capsule, cả hai loại case và TSX template được hash.
4. `GRAMMAR-4` — Mỗi slot có một winner theo priority, specificity rồi lexical rule id.
5. `GRAMMAR-5` — Thiếu route, owner hoặc fact thì dừng; không được hand-build JSX fallback.
6. `GRAMMAR-6` — Remote, revision, path, symbol, blob và source-origin record của repository bị cấm.
7. `GRAMMAR-7` — Resolution chỉ trả fact, capsule, template và principle concern đã chọn.
8. `GRAMMAR-8` — Visual contract của profile khóa trục direction, semantic role token và giá trị token chính xác; design cùng execute từ chối mọi thay thế.

## Routing

Layout và block design phân loại tình huống có bằng chứng thành fact id, chạy `@resolve-grammar`, rồi
bind receipt vào accepted design revision. Outcome giới hạn semantic owner nào được reuse, extend hay
báo `new-required`; outcome không chọn visual class. Owner đã chọn có thể mang thêm visual contract,
khóa semantic theme token và giá trị trước khi so direction.

Execute tính lại đúng receipt từ fact đã accept và profile hiện hành đã khai báo. Hash drift, capsule
thiếu, template đổi hoặc owner vắng mặt đều trả về design. Nó chỉ load compact context pack đã emit,
sau đó resolve `principleConcerns` qua principle compiler.
Visual contract còn bắt buộc mọi preview state mount boundary, khai báo và dùng chính xác mọi locked token,
đồng thời không mang raw palette value nằm ngoài contract.

## Rules

1. Tên product/project không bao giờ suy ra grammar identity.
2. Grammar fact là tình huống quan sát được, không phải component name hay outcome mong muốn.
3. Golden case phải resolve đủ expected outcome và không có rejected outcome bất kể thứ tự fact.
4. Counterexample phải chứng minh rule gần nhất không fire.
5. Template giữ owner boundary và state transition; đó là reference, không phải source để paste mù.
6. Optional immutable ref chỉ là provenance và không được thay đổi durable authority.
7. Design skill ghi grammar/profile id cùng receipt hash để execution phát hiện drift.
8. Visual contract do grammar khóa là bất biến giữa candidate composition, viewport và interaction state.
9. Receipt có visual contract chưa hoàn chỉnh nếu thiếu `preview.html` proof tương ứng.

## Stops

- Workspace route thiếu grammar/profile hoặc trỏ authority package/profile không tồn tại.
- Tình huống bắt buộc không thể biểu diễn bằng closed fact catalog.
- Hai rule hòa ngoài thứ tự tất định hoặc outcome không có owner.
- Validation capsule/case/template hoặc bất kỳ receipt hash nào fail.

## Output

Trả fact đã sort, một decision cho mỗi slot khớp, compact context pack đã chọn và receipt hash của
grammar, profile, facts, decisions cùng context. Không load hoặc trả grammar law không liên quan.
