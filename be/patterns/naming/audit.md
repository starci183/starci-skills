---
id: be-patterns-naming-audit
title: audit.md
slug: /be/patterns/naming/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, mức giữ được và khả năng chống bịa của luật naming.
---

# audit.md

> Version: `2.00` · Module: `naming`

Audit này kiểm tra hai việc. Thứ nhất: từ **chủ thể, vai trò, path và tập người gọi** đã nêu, luật có
chọn được đúng **một** cái tên hay không. Thứ hai: bảy mã này thật sự được bảo đảm bằng gì — và bản
audit từ chối gọi "một phần" là "đã được enforce".

## Verdict

Chấp nhận. Bảy mã đóng, có tính khái quát, không phụ thuộc tên sản phẩm nào, và mỗi mã đều neo được
vào mã nguồn thật. Điểm yếu không nằm ở khả năng phân định mà ở **tầng giữ**: năm trên bảy mã chỉ có
người đọc bảo đảm, còn hai mã có lint thì cả hai đều hẹp hơn luật.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `NAME-1` vs `NAME-3` | Loại trừ được khi đã nêu đoạn path đó **phân loại** hay **lưu trữ** |
| `NAME-1` vs `NAME-7` | Loại trừ được khi đã nêu symbol là **operation của một bề mặt** hay **capability dùng chung** |
| `NAME-2` vs `NAME-6` | Loại trừ được khi đã nêu cái hỏng là **dạng câu** hay **chủ đề câu hỏi**; boolean hỏi về đời schema ghi `NAME-2` |
| `NAME-3` vs `NAME-4` | Loại trừ được khi đã nêu từ mượn là **chỗ vật nằm** hay **cách vật được sinh ra** |
| `NAME-4` vs ngoại lệ integration | Loại trừ được khi đã nêu module **là** cơ chế hay chỉ **chạy trên** cơ chế |
| `NAME-5` vs `NAME-6` | Loại trừ được bằng kiểu trả về: `boolean` thì sang `NAME-6` |
| `NAME-5` vs phạm vi | Loại trừ được bằng một dữ kiện cú pháp: có `export` hay không |
| `NAME-7` vs ngoại lệ read model | Loại trừ được khi đã nêu bề mặt là **khái niệm nghiệp vụ** hay **người đặt hàng đầu tiên** |
| Thiếu dữ kiện người gọi | Mặc định đặt theo **năng lực**; chỉ hỏi khi bên yêu cầu nói rõ đây là một read model riêng của một bề mặt |

## Findings

- Bảy mã thực chất là **hai luật**. `NAME-1` nói tên được lấy từ đâu; `NAME-2`, `NAME-3`, `NAME-4`,
  `NAME-7` nói tên **không** được lấy từ đâu; `NAME-5` và `NAME-6` nói **hình dạng** của tên theo
  loại symbol. Giữ nguyên bảy mã vì bốn "cấm" kia hỏng theo bốn nhịp khác nhau, và một mã gộp sẽ
  không trích dẫn được nhịp nào đã hỏng.
- **`NAME-1` gánh hai nghĩa vụ trong một mã**: "path mang vai trò, file gọi tên chủ thể" và "hậu tố
  khớp vai trò export". Một trích dẫn `NAME-1` vì thế không nói được nửa nào bị vi phạm. Đây là chỗ
  người audit này **không đồng ý** với hình dạng hiện tại — và theo luật codes-are-fixed, mã vẫn giữ
  nguyên số và nguyên nghĩa; bất đồng ghi ở "Rủi ro còn mở" chứ không sửa lặng lẽ.
- **Rule `no-version-in-name` hẹp hơn `NAME-2`.** Nó thăm `FunctionDeclaration`, `ClassDeclaration`,
  `TSInterfaceDeclaration`, `TSTypeAliasDeclaration` và `MethodDefinition`. Nó **không** thăm biến,
  property, tham số. Bằng chứng sống: `src/features/api/processors/ai/review-milestone-task/steps/review-milestone-task-grade-step.service.ts`
  có `const isV2Task = Boolean(milestoneTask.verified)` — đúng vi phạm mà luật viết ra để cấm, và
  rule không thấy.
- **Rule `no-bare-verb-export` chỉ kiểm tra một danh sách đóng gồm mười tám động từ.** `src/tests/helpers/judge.ts`
  export `judge`, một động từ trần không nằm trong danh sách, nên lint im lặng trong khi luật thì
  không. Danh sách đóng là lựa chọn đúng (một rule đoán "cái này có phải động từ không" sẽ báo sai
  hàng loạt), nhưng nó có nghĩa là mã `NAME-5` được giữ **một phần**, không phải toàn phần.
- **Hai rule đã có trong plugin nhưng chưa được bật trong `eslint.config.mjs` của repository tham
  chiếu.** Chính rule file dặn như vậy: đo trước, vào ở mức `warn` kèm số, rồi mới lên `error`.
  Nên trên thực tế hôm nay, `NAME-2` và `NAME-5` cũng đang được giữ bằng người đọc. Bảng
  `Tầng giữ` ghi `enforced` theo nghĩa **rule tồn tại và bắt được**; câu này là phần còn lại của sự
  thật.
- **Một rule thứ ba đã từng được viết rồi bị xoá, và chỗ xoá là phần có ích.** Nó đòi tên file đánh
  vần trọn tên class, và đo được **616 vi phạm trên 4430 file**. Mười bốn phần trăm một cây mã là
  **quy ước**, không phải nợ. Canon ghi lại cái mã nguồn đang làm; một rule lệch với mã nguồn ở quy
  mô đó là rule sai. Đó là lý do `NAME-1` không có lint và sẽ không có lint ở nửa "path mang vai
  trò".
- **`unrepresentable` rỗng là do cấu trúc, không phải do bỏ sót.** Identifier không phải giá trị, nên
  không union đóng hay branded type nào làm cho một cái tên sai trở nên không viết được. `isV2` hợp
  lệ ở mọi vị trí `hasVerifiedMarker` hợp lệ, và compiler không có ý kiến về việc cái nào nói thật.

## Decisions

- Giữ đúng bảy mã, đúng số, đúng nghĩa: `NAME-1` … `NAME-7`. Không đánh số lại, không thêm mã thứ
  tám trong lần chuyển shelf này.
- Ghi `enforced` **chỉ** cho hai mã có rule gọi được tên: `NAME-2` → `no-version-in-name`, `NAME-5` →
  `no-bare-verb-export`. Năm mã còn lại ghi `documented`, kể cả những mã có vẻ "hiển nhiên phải bắt
  được".
- Neo cả bảy mã vào mã nguồn thật, và neo **cả hai phía** ở chỗ có: một anchor đúng luật và một
  anchor vi phạm còn sống. Một luật chỉ neo vào ví dụ đẹp là một luật chưa bị thử.
- Giữ nguyên quyết định lịch sử 616/4430: luật ghi cái mã nguồn làm, không ghi cái người viết luật
  muốn nó làm.
- Giữ mọi ví dụ ở dạng TypeScript/NestJS tổng quát, không tên sản phẩm; đường dẫn repository chỉ xuất
  hiện trong bảng `Anchor`, vì anchor bắt buộc phải là đường dẫn thật.

## Rủi ro còn mở

Năm mã dưới đây **chỉ có người đọc giữ**. Với mỗi mã: một rule sẽ phải **nhìn thấy** cái gì mới giữ
được — hoặc vì sao không rule nào giữ được.

- **`NAME-1` — nửa hậu tố thì máy thấy được, nửa còn lại thì không.** Một rule chỉ cần AST và tên
  file là bắt được "`*.service.ts` phải export một class kết thúc bằng `Service`"; đó là ứng viên
  rule khả thi nhất của cả module, và chỉ chưa được viết. Nửa kia — "file không lặp lại vai trò của
  folder" — cần biết **từ nào trong path là vai trò và từ nào là phạm vi**, mà không parser nào biết:
  `broker/broker.module.ts` là hợp lệ còn `broker/broker-producer.service.ts` thì không, và hai
  chuỗi đó khác nhau đúng một dấu gạch. Đây cũng là mã người audit này cho là **nên tách làm hai**;
  giữ nguyên theo luật codes-are-fixed, ghi lại ở đây.
- **`NAME-3` — không rule nào giữ được.** Muốn bắt được, rule phải biết cái tên **đến từ** một thư
  mục, và biết thư mục đó **đã bị đổi tên**. Cả hai đều nằm ngoài AST: cái thứ nhất nằm trong đầu
  người đặt tên, cái thứ hai nằm trong lịch sử git. `VolumeService` đọc lên hoàn toàn hợp lý cho tới
  lúc bạn biết thư mục tên gì bây giờ. Một rule yếu hơn — cấm identifier trùng tên với thư mục tổ
  tiên — sẽ báo sai ngay ở `broker/broker.module.ts`.
- **`NAME-4` — không rule nào giữ được, và lý do thì mỉa mai.** Rule sẽ phải có một từ điển các từ
  "chỉ cơ chế", mà từ điển đó **cũ đi đúng lúc nó cần nhất**: ngày cơ chế bị thay là ngày từ đó rời
  khỏi từ vựng của hệ thống. Thêm nữa, ranh giới hợp lệ/không hợp lệ phụ thuộc **module đó là gì**,
  không phụ thuộc từ được dùng: `BrokerService` trong `integrations/broker/` đúng, `LedgerRedisService`
  trong tầng nghiệp vụ sai, và cả hai đều chỉ là một danh từ hạ tầng trong tên.
- **`NAME-6` — gần rule nhất trong năm mã.** Một typed lint rule sẽ phải nhìn **kiểu trả về đã khai
  báo** cùng với tiền tố tên: báo khi tên khớp `^check[A-Z]` và kiểu trả về là `boolean` hoặc
  `Promise<boolean>`. Đúng cặp dữ kiện đó phân biệt được `checkEnrollment` (trả `boolean`, là vi
  phạm) với `checkEligible` (trả `Array<BadgeTier>`, không phải vi phạm) — và không có kiểu thì
  không phân biệt được. Rào chắn là type information, không phải ý tưởng.
- **`NAME-7` — cần dữ kiện sản phẩm, không phải cú pháp.** Rule sẽ phải biết danh sách **tên bề
  mặt**, và biết symbol đang nằm ở **tầng dùng chung** hay tầng operation. Cái thứ hai suy được từ
  path; cái thứ nhất là tri thức sản phẩm và sẽ phải bảo trì tay. Một biến thể hẹp có thể làm được:
  cấm symbol trong `modules/**` mang tiền tố trùng với một đoạn thư mục dưới `features/**/queries/**`.
  Nó sẽ bắt được `DashboardContentService` nhưng cũng bắt nhầm read model hợp lệ ở ngoại lệ.

Hai rủi ro nữa, không thuộc riêng mã nào:

- **Bảng `Tầng giữ` có thể bị đọc thành "hai mã này đã an toàn".** Không. Cả hai rule đều hẹp hơn
  luật, và hiện chưa bật ở config tham chiếu. Ai đọc bảng mà bỏ qua đoạn văn ngay dưới nó sẽ tin
  nhầm.
- **`NAME-2` và `NAME-6` chồng lấn ở đúng một ví dụ nổi tiếng** (`isV2`). Luật đã chốt ghi `NAME-2`.
  Nếu thực tế cho thấy người ta liên tục ghi nhầm sang `NAME-6`, đó là một đề xuất đổi luật, không
  phải một lần chọn khác đi.

## Re-audit Triggers

- Có đề xuất thêm, bỏ hoặc đánh số lại một mã `NAME-<n>`.
- `no-version-in-name` hoặc `no-bare-verb-export` được bật lên trong config của một repository, hoặc
  đổi mức: bảng `Tầng giữ` và đoạn cảnh báo dưới nó phải được đọc lại.
- Rule "hậu tố khớp vai trò export" được viết: `NAME-1` chuyển một nửa từ `documented` sang
  `enforced`, và dòng "Two enforced, five documented" trong `INDEX.md` phải đổi theo.
- Có ai đó đo lại tỉ lệ file-name/class-name và ra con số khác hẳn 616/4430 — quy ước có thể đã đổi,
  và luật ghi cái mã nguồn làm.
- Một anchor trong bảng `Anchor` không còn tồn tại, hoặc vi phạm còn sống được neo trong đó đã được
  sửa: mất anchor vi phạm thì luật mất phía bị thử.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
