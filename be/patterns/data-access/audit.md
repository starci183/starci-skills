---
id: be-patterns-data-access-audit
title: audit.md
slug: /be/patterns/data-access/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo được của luật data access.
---

# audit.md

> Version: `2.00` · Module: `data-access`

Audit này kiểm ba việc: luật có chọn được **một** handle từ dữ kiện đã nêu và chỉ từ đó; mỗi mã có
**đúng một tầng giữ** được nói thật; và mỗi mã có **neo được vào code thật** hay không.

## Verdict

Chấp nhận. Năm mã giữ nguyên số và nguyên nghĩa. Ba mã có lint giữ, hai mã chỉ có người đọc giữ, và
cả năm đều neo được vào file thật. Khoảng cách giữa năm mã và ba rule là **trạng thái thật**, không
phải chỗ hỏng cần che.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `DATA-1` vs `DATA-2` | Loại trừ được: một bên hỏi handle **trỏ vào đâu**, một bên hỏi handle **mang được gì**. Cùng một tham số constructor vẫn hỏng hai kiểu độc lập. |
| `DATA-2` vs `DATA-4` | Loại trừ được: `DATA-2` hỏi đã **có** đơn vị công việc chưa, `DATA-4` hỏi có **truyền** nó đi không. Sửa xong cái trước không tự sửa cái sau. |
| `DATA-3` vs `DATA-5` | Loại trừ được: cả hai là quyết định trên entity, nhưng một bên nói về **danh tính bảng**, bên kia nói về **chi phí của mọi query**. |
| `DATA-4` vs `DATA-5` | Loại trừ được bằng hậu quả: nhầm `DATA-4` mất dữ liệu, nhầm `DATA-5` chậm dần. |
| `DATA-1` vs `DATA-4` | Loại trừ được: sai ở **chỗ tiêm** hay sai ở **chỗ dùng**. Helper vi phạm `DATA-4` thường có phần tiêm hoàn toàn đúng `DATA-1`. |
| Thiếu dữ kiện "có mọc lệnh ghi thứ hai không" | Mặc định coi như **có**. Handle rộng hơn nhu cầu hôm nay rẻ hơn một lần đổi handle. |

## Findings

- **Ba mã enforced trùng khít với ba thứ một parser đọc được trong MỘT file**: một decorator trên
  tham số (`DATA-1`), một kiểu trên tham số (`DATA-2`), một đối số của decorator (`DATA-3`). Không có
  heuristic nào trong ba rule ấy, nên cả ba bật `error` được mà không cần burn-down ở repository
  tham chiếu.
- **`DATA-2` được giữ bằng HAI dấu hiệu, không phải một.** Rule đọc cả `@InjectRepository` lẫn kiểu
  `Repository` / `TreeRepository` / `MongoRepository`. Chỉ đọc decorator là để lọt bản viết bằng kiểu
  — mà bản viết bằng kiểu mới là bản trông "sạch", nên nó qua review dễ hơn.
- **`DATA-1` đọc cả tham số lẫn parameter property bọc ngoài nó.** Nếu không, `private readonly` sẽ
  giấu được decorator khỏi rule, và cách viết phổ biến nhất trong codebase này lại chính là cách viết
  lọt.
- **`DATA-3` cố ý chấp nhận dạng options.** Đây là một quyết định đã ghi trong chính rule: từ chối
  `@Entity({ name, schema })` sẽ đẩy tác giả tới chỗ **xoá schema đi** cho vừa luật — hỏng hơn cái
  tên bảng suy ra mà luật sinh ra để chặn. Một luật ép người ta phá thứ khác để tuân thủ là một luật
  sai, dù nó chặt hơn.
- **Hai mã còn lại không thiếu rule vì lười.** Module rule tự nói ra lý do: `DATA-4` cần call graph,
  `DATA-5` cần biết câu trả lời để làm gì. Cả hai đều không nằm trong một file. Một rule đoán mò ở
  hai chỗ này sẽ **báo đỏ lên code đúng**, và luật bị tắt là kết cục chắc chắn hơn luật được tuân.
- **Cả năm mã đều neo được.** Không mã nào phải ghi `chưa neo được`. `DATA-2` là mã duy nhất neo bằng
  **hai loại bằng chứng**: một handler ghi nhiều bảng trong một transaction (bằng chứng khẳng định),
  cộng với việc `@InjectRepository` và `Repository<…>` xuất hiện **không lần nào** trong `src/` (bằng
  chứng phủ định). Bằng chứng phủ định một mình thì yếu — nó chỉ nói "chưa ai vi phạm", không nói
  "luật đang được dùng" — nên nó không được đứng một mình.

## Decisions

- Giữ đúng năm mã: `DATA-1`, `DATA-2`, `DATA-3`, `DATA-4`, `DATA-5`. Không đổi số, không đổi nghĩa,
  không thêm mã mới. Mã được trích dẫn từ file luật khác và từ task record cũ; đổi số một mã là làm
  gãy một trích dẫn ai đó đã viết ra rồi.
- Giữ nguyên mọi quyết định của bản luật phẳng: `EntityManager` thay repository, decorator gọi tên
  datasource, tên bảng viết ra, transaction được truyền, relation khai ở call site.
- Ghi tầng giữ **đúng như đo được**: ba `enforced` (có tên rule), hai `documented`. Không mã nào được
  ghi `enforced` mà không nêu được tên rule.
- Bảng `Anchor` chỉ mang path của repository tham chiếu và chỉ dùng để **kiểm chứng**; ví dụ trong
  `example.md` không mang tên sản phẩm, tên công ty hay tên repository nào.
- `DATA-4` và `DATA-5` được coi là **bắt buộc ngang ba mã kia**. Khác biệt duy nhất là tầng giữ.

## Rủi ro còn mở

Mọi mã chỉ ở tầng `documented` đều nằm dưới đây, kèm câu trả lời cho câu hỏi: một rule sẽ phải **nhìn
thấy cái gì** thì mới giữ nổi mã ấy.

- **`DATA-4` — transaction được truyền.** Một rule muốn giữ mã này phải nhìn thấy, cho mỗi lời gọi
  nằm trong thân callback của `transaction()`: thân hàm của callee, và trong thân hàm ấy, mọi lối
  chạm dữ liệu là qua tham số nhận vào hay qua field của chính callee. Nghĩa là cần **call graph liên
  file** cộng **type resolution**, và cả hai đều ngoài tầm một rule đọc AST một file. Có thể thu hẹp
  thành một rule yếu hơn — "trong callback của `transaction()`, cấm dùng `this.entityManager`" — và
  bản thu hẹp ấy giữ được đúng **một** trong hai hình dạng lỗi, hình dạng dễ thấy nhất. Hình dạng
  thật sự đắt là helper ở file khác, và nó vẫn lọt. Đây là một đề xuất rule, chưa được chấp nhận, và
  ghi ở đây để nó không bị thêm vào lặng lẽ.
- **`DATA-5` — relation khai ở call site.** Mã này gồm **hai nửa** với khả năng giữ rất khác nhau, và
  bản luật phẳng gộp chung. Nửa cấm — `eager: true` trong option của một relation decorator — là một
  thuộc tính nằm gọn trong một file, một rule đọc AST **nhìn thấy được**. Nửa còn lại — call site có
  hỏi đúng thứ nó cần không — thì không rule nào thấy được, vì dữ kiện quyết định là "câu trả lời
  dùng để làm gì". Bản luật phẳng đã quyết định **không** enforce mã này, và audit này **giữ nguyên
  quyết định đó**; ghi ở đây rằng nửa cấm là thứ duy nhất trong hai mã `documented` có thể lên
  `enforced` mà không cần đoán, nếu và chỉ nếu điều đó được chấp nhận thành một thay đổi luật có ghi
  changelog. Ở repository tham chiếu, `eager: true` hiện xuất hiện không lần nào, nên rule ấy sẽ bật
  ở `error` mà không có nợ.
- **Ngoại lệ "manager lấy từ query runner tự mở" là suy ra từ anchor, không phải chữ của luật phẳng.**
  Bản phẳng chỉ nói "mọi thứ bên trong nhận manager transactional làm tham số", không nói manager ấy
  phải sinh ra từ đâu. Code thật thì có một helper mở query runner riêng để giữ advisory lock rồi
  truyền manager của chính runner đó vào trong — đúng tinh thần, không đúng chữ. Module này đọc luật
  theo tinh thần và **ghi lại chỗ lệch** thay vì sửa chữ luật trong im lặng. Nếu cách đọc này bị bác,
  chỗ phải sửa là ngoại lệ trong `INDEX.md`, không phải cái anchor.
- **Ngoại lệ "repository dẫn từ manager transactional" cũng là một cách đọc, không phải một câu
  chữ.** Luật phẳng viết "persistence never arrives as an **injected** repository". `manager.getRepository(…)`
  gọi trên manager đang giữ transaction thì không phải repository được tiêm và không rời khỏi đơn vị
  công việc. Rule `no-injected-repository` chỉ đọc tham số constructor nên nó không đụng tới cách viết
  này, dù đúng hay sai. Ghi lại vì hai cách viết trông giống hệt nhau ở call site và chỉ khác nhau ở
  chỗ `getRepository` được gọi trên cái gì — đây là chỗ dễ sai nhất mà không có tầng nào giữ.
- **Số đo `zero offender` là số đo của một repository, không phải một tính chất của luật.** Ba rule
  bật `error` được vì repository tham chiếu đo ra không. Một repository khác phải **đo lại** trước
  khi bật, và phải đếm **chỉ report của rule đang đo** — đếm lẫn report của rule mà config đo tối
  thiểu không nạp sẽ thổi phồng mọi con số về cùng một phía.

## Re-audit Triggers

- Có đề xuất thêm một mã `DATA-<n>` mới, hoặc đề xuất bỏ một mã đang có.
- Có rule mới trong `sources/be/data-access.mjs` — bảng `Tầng giữ` phải đổi theo trong cùng một lần.
- `eager: true` xuất hiện lần đầu trong `src/`, hoặc `@InjectRepository` xuất hiện lần đầu.
- Một file trong bảng `Anchor` bị đổi tên, di chuyển hoặc xoá.
- Xuất hiện datasource thứ tư, hoặc một decorator tiêm manager thứ hai trỏ vào cùng một connection.
- Một sự cố sản xuất có hình dạng "một nửa đã ghi" — đó là `DATA-4` được đọc như khuyến nghị.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
