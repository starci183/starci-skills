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
triệu chứng quan sát được → outcome mong đợi → evidence source/legacy
→ gọi tên rule đang cai trị và đem nó ra xét → invariant bị thiếu hoặc bị vẽ sai
→ authority layer đúng → counterexample gần nhất → khả năng enforce
→ design identity bị ảnh hưởng → source consequence nhỏ nhất
```

Nhảy thẳng từ screenshot sang CSS, từ một ví dụ sang grammar rule hoặc từ principle sang churn source không liên
quan đều không hợp lệ. Trích rule đang cai trị mà không đem nó ra xét cũng không hợp lệ nốt: đọc một dòng trong
bảng situation không phải là đã hỏi xem situation ấy có được vẽ đúng chỗ hay không.

## Chất vấn authority

Luật bị đem ra xét trước, sản phẩm xét sau. Feedback của owner là bằng chứng rằng một mắt xích nào đó sai, và
mắt xích đầu tiên là rule chứ không phải component. Một lượt chạy tra bảng situation, thấy có câu trả lời rồi
quay sang đổ lỗi cho code là đã bỏ qua đúng bước duy nhất có thể bắt được một rule hỏng, bởi rule hỏng thì luôn
luôn có câu trả lời — đó chính là chỗ khiến nó hỏng chứ không phải thiếu.

Trước khi phân loại bất cứ thứ gì, hãy đo chính authority. Chạy gate dependency và grammar trên trust tree, đọc
mỗi finding như một sự thật về luật: một publication mang situation mà runtime record của nó không có, một
profile owner còn ghi nợ chưa trả, một manifest hash đã trôi khỏi nguồn. Không đo, những thứ đó sẽ quay lại dưới
dạng một gap giả nằm trong sản phẩm.

Sau đó gọi đúng tên rule, situation code hoặc profile owner đang cai trị từng item và trả về một phán quyết.
`sound` là rule trả lời đúng, lỗi thuộc về sản phẩm. `misdrawn` là rule có trả lời và trả lời sai ở đây.
`absent` là không rule nào với tới được situation này. Không item nào được bước sang phân loại mà thiếu phán
quyết, và `sound` không phải giá trị mặc định.

Phán quyết `misdrawn` phải được chứng minh bằng một counterexample mà rule hiện tại xử sai — một composition có
thật, làm đúng từng chữ của rule thì ra đúng cái outcome owner đang bắt sửa. Owner không hài lòng không phải là
counterexample, một rule nghe thô cũng vậy; thiếu counterexample thì phán quyết là `sound`.

Chất vấn còn là cách trả lời owner khi luật đứng vững. Một rule đã bị đem ra xét và trụ được thì có thể trình ra
cùng ranh giới và code liền kề của nó, đó là một lý lẽ. Một rule chỉ được tra cứu thì chỉ trình ra được một
trích dẫn, đó là mượn uy quyền.

## Phân loại

- **Law misruling:** một rule, situation hoặc profile owner đang cai trị ca này và xử sai — ranh giới vẽ nhầm chỗ, hoặc emit sai outcome. Sửa rule tại module sở hữu nó, mang publication cặp và runtime record đi cùng nhau, kèm counterexample rớt dưới cách viết cũ. Không bao giờ chiều một rule sai bằng cách sửa sản phẩm.
- **Evidence inventory miss:** precedent cần thiết đã có nhưng decomposition làm rơi mất.
- **Application miss:** grammar/principle hiện tại đã trả lời; sửa fact, situation, obligation, design và source mà không đổi law.
- **Grammar gap:** fact product-family ổn định chưa chọn được semantic owner xác định; phải promote đồng thời fact, rule, capsule, profile owner, golden/counterexample case và template.
- **Principle gap:** thiếu visual situation product-neutral hoặc emission cần thiết, kể cả trường hợp phải vô hiệu default của vendor.
- **Pattern or gate gap:** thiếu ownership architecture hoặc vi phạm lặp lại, quan sát được vẫn lọt enforcement.
- **Source drift:** authority/design đúng nhưng code khác.
- **Local preference:** chỉ đúng cho composition này; giữ trong design/source, không universalize.

## Quy trình

1. Resolve ngôn ngữ, Source, FE route, grammar/profile, business head, accepted design head và committed baseline.
2. Chất vấn authority trước: chạy gate dependency và grammar trên trust tree, ghi mọi finding như một sự thật về luật, rồi trả phán quyết `sound`/`misdrawn`/`absent` cho từng item kèm counterexample mà phán quyết `misdrawn` đòi hỏi. Authority đỏ hoặc stale phải được báo trước khi lấy nó làm căn cứ.
3. Tái hiện state và đọc đủ subtree source/legacy liên quan: header, identity, surface, controls, overlays và responsive owner.
4. Chạy thang suy luận và phân loại từng item, mang theo phán quyết ở bước 2. Có câu trả lời sẵn chỉ thành application miss khi câu trả lời đó trụ được qua chất vấn; câu trả lời rớt là `Law misruling`, và khi đó luật dịch chuyển chứ không phải sản phẩm.
5. Dựng impact cone: authority file, hash đổi, receipt stale, design identity bị ảnh hưởng, source owner và tests.
6. Hiển thị một approval `Touching` chính xác. Sau `OK`, chụp trust và FE baseline.
7. Ghi authority trước. Giữ English/Vietnamese/runtime đồng bộ; grammar promotion phải đủ bộ; law enforce được chỉ thêm machine twin trong route được duyệt.
8. Validate grammar, context và dependency graph bằng golden/counterexample có ý nghĩa.
9. Append full-page/flow design revision đã sửa và chỉ recompute receipt/obligation bị ảnh hưởng.
10. Implement qua semantic owner và source pattern đã emit, không paste preview CSS hoặc mở caller styling door.
11. Chạy gate scoped/toàn repo, unit/interaction test và browser proof cho mọi state/viewport bị ảnh hưởng.
12. Commit trust, registry và FE tách riêng; chỉ push khi được yêu cầu.

## Điểm dừng

- Không có state quan sát được hoặc outcome mong đợi có thể khôi phục.
- Source phủ định product fact được nêu.
- Law mới **thêm vào** vốn đã biểu đạt được bằng authority hiện tại. Sửa một rule đã có mà vẽ sai không phải là thêm, không bị chặn ở đây; nó chỉ dừng khi thiếu counterexample.
- Phán quyết `misdrawn` không kèm counterexample, hoặc một item bước sang phân loại mà chưa có phán quyết nào.
- Gate authority chưa chạy trước lần phân loại đầu tiên, hoặc một finding bị mang qua đó mà không báo.
- Grammar promotion thiếu bộ evidence đầy đủ hoặc impact cone.
- Principle addition không phân biệt được situation gần nhất.
- Immutable hoặc design history không liên quan sẽ bị viết lại.
- Source được ghi trước khi authority/design xanh.
- Machine/source cần thiết nằm ngoài approval.

## OUTPUT

Report classification, authority đã mạnh lên, design hash thay thế, source commit, business status và proof. Nói
rõ item nào là law gap thật, item nào chỉ là lỗi áp law.
