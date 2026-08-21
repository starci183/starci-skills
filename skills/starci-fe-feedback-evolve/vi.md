---
title: starci-fe-feedback-evolve · Vietnamese
---

# starci-fe-feedback-evolve

## LOADS

| Alias | Target | Kind | Lý do |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | biên approval, baseline và report dùng chung |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | verify FE route cùng grammar/profile được khai rõ |
| `@worktrees` | `contexts/worktrees/vi.md` | vi | giữ design history immutable và draft có thể dựng lại |
| `@business` | `contexts/business/vi.md` | vi | phân biệt correction hình ảnh với thay đổi product truth |
| `@grammar` | `grammars` | module | kiểm tra vocabulary product-family ổn định có bị thiếu không |
| `@principles` | `compilers/principles` | module | kiểm tra visual law tổng quát bị thiếu hay bị áp sai |
| `@patterns-fe` | `compilers/patterns/fe` | module | kiểm tra source ownership và kiến trúc file |
| `@lints-fe` | `gates/fe/lints` | module | buộc law quan sát được vào gate có accountability |
| `@standards` | `standards` | module | giữ chuỗi accountability từ law tới proof |
| `@design-review` | `publication/design-review-preview/vi.md` | vi | append design revision immutable đã sửa |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | chứng minh grammar fact, case, capsule, template và profile owner |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | recompute design receipt bị ảnh hưởng sau grammar evolution |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | chứng minh accepted revision và block-parent currentness |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | từ chối source write dựa trên business authority sai |
| `@compile-context` | `scripts/compile-context.mjs` | script | dựng lại runtime context sau paired authority publication change |
| `@check-deps` | `scripts/check-deps.mjs` | script | chứng minh runtime, English và Vietnamese dependency graph |

## NESTED SKILLS

Không có.

## Mục đích

Biến feedback cụ thể của owner trên frontend design hoặc implementation đã accepted thành một hệ thống suy luận
tốt hơn và một kết quả sản phẩm đã sửa. Capability này tách rõ authority thật sự bị thiếu với trường hợp agent
không áp authority vốn đã tồn tại, chỉ nâng owner bền vững cao nhất còn thiếu rồi truyền correction đó qua design
authority bị ảnh hưởng và product code.

## Biên giới

Đầu vào là feedback gắn với page/state nhìn thấy được, accepted revision hoặc frontend commit. Lượt chạy chỉ được
ghi các authority module, design identity bị ảnh hưởng và FE file đã công khai trong boundary. Screenshot không
tạo business fact. Immutable revision chỉ được thay bằng revision mới, không sửa tại chỗ. Grammar hash đổi không
cho phép refresh receipt không liên quan. Thay đổi product behavior phải quay về business authority trước khi ghi;
correction hình ảnh bind feature `implemented` hiện tại với `businessImpact: none`.

## Thang suy luận

Mỗi feedback item phải chứng minh:

```text
triệu chứng quan sát được → outcome mong đợi → evidence source/legacy → invariant bị thiếu
→ authority layer đúng → counterexample gần nhất → khả năng enforce
→ design identity bị ảnh hưởng → source consequence nhỏ nhất
```

Nhảy thẳng từ screenshot sang CSS, từ một ví dụ sang grammar rule hoặc từ principle sang churn source không liên
quan đều không hợp lệ.

## Phân loại

- **Evidence inventory miss:** precedent cần thiết đã có nhưng decomposition làm rơi mất.
- **Application miss:** grammar/principle hiện tại đã trả lời; sửa fact, situation, obligation, design và source mà không đổi law.
- **Grammar gap:** fact product-family ổn định chưa chọn được semantic owner xác định; phải promote đồng thời fact, rule, capsule, profile owner, golden/counterexample case và template.
- **Principle gap:** thiếu visual situation product-neutral hoặc emission cần thiết, kể cả trường hợp phải vô hiệu default của vendor.
- **Pattern or gate gap:** thiếu ownership architecture hoặc vi phạm lặp lại, quan sát được vẫn lọt enforcement.
- **Source drift:** authority/design đúng nhưng code khác.
- **Local preference:** chỉ đúng cho composition này; giữ trong design/source, không universalize.

## Quy trình

1. Resolve ngôn ngữ, Source, FE route, grammar/profile, business head, accepted design head và committed baseline.
2. Tái hiện state và đọc đủ subtree source/legacy liên quan: header, identity, surface, controls, overlays và responsive owner.
3. Search authority hiện tại, chạy thang suy luận và phân loại từng item trước khi đề xuất file.
4. Dựng impact cone: authority file, hash đổi, receipt stale, design identity bị ảnh hưởng, source owner và tests.
5. Hiển thị một approval `Touching` chính xác. Sau `OK`, chụp trust và FE baseline.
6. Ghi authority trước. Giữ English/Vietnamese/runtime đồng bộ; grammar promotion phải đủ bộ; law enforce được chỉ thêm machine twin trong route được duyệt.
7. Validate grammar, context và dependency graph bằng golden/counterexample có ý nghĩa.
8. Append full-page/flow design revision đã sửa và chỉ recompute receipt/obligation bị ảnh hưởng.
9. Implement qua semantic owner và source pattern đã emit, không paste preview CSS hoặc mở caller styling door.
10. Chạy gate scoped/toàn repo, unit/interaction test và browser proof cho mọi state/viewport bị ảnh hưởng.
11. Commit trust, registry và FE tách riêng; chỉ push khi được yêu cầu.

## Điểm dừng

- Không có state quan sát được hoặc outcome mong đợi có thể khôi phục.
- Source phủ định product fact được nêu.
- Law mới đề xuất vốn đã biểu đạt được bằng authority hiện tại.
- Grammar promotion thiếu bộ evidence đầy đủ hoặc impact cone.
- Principle addition không phân biệt được situation gần nhất.
- Immutable hoặc design history không liên quan sẽ bị viết lại.
- Source được ghi trước khi authority/design xanh.
- Machine/source cần thiết nằm ngoài approval.

## OUTPUT

Report classification, authority đã mạnh lên, design hash thay thế, source commit, business status và proof. Nói
rõ item nào là law gap thật, item nào chỉ là lỗi áp law.
