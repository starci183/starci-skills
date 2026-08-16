---
id: be-patterns-type-safety-audit
title: audit.md
slug: /be/patterns/type-safety/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, mức neo và mức thực thi thật của luật type-safety.
---

# audit.md

> Version: `2.00` · Module: `type-safety`

Audit này kiểm tra ba việc, theo đúng thứ tự đó: luật có **phân định** được một trường hợp về đúng một mã
không, mỗi mã có **neo** được vào code thật không, và tầng ghi trong `Tầng giữ` có **đúng với thực
tế trên đĩa** không.

## Verdict

Chấp nhận, kèm ba findings về khoảng cách giữa luật và mức thực thi thật.

Sáu mã giữ nguyên số và nguyên nghĩa của bản phẳng. Sáu mã đều neo được. Nhưng bảng `Tầng giữ` nói
"bốn enforced" ở mức **canon**, còn ở mức **repository đang chạy** con số nhỏ hơn — và chênh lệch
đó là finding, không phải là chỗ để làm tròn lên.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `TYPE-1` vs `TYPE-2` | Loại trừ được: `any` thú nhận không kiểm tra, double cast tuyên bố một kiểu mà không kiểm tra |
| `TYPE-1` vs `TYPE-3` | Loại trừ được: mất kiểm tra vs mất một cái tên để import |
| `TYPE-2` vs `TYPE-6` | Loại trừ được bằng **làn**, không bằng dòng: spec và test tree nằm ngoài phạm vi `TYPE-2` |
| `TYPE-2` vs cast đơn | Loại trừ được: chỉ **cặp** cast đáp xuống một kiểu cụ thể mới thuộc mã này |
| `TYPE-3` vs tham số positional | Loại trừ được: mã chỉ nói về dạng đã destructure |
| `TYPE-4` vs `TYPE-5` | Loại trừ được khi đã nêu mỗi nhánh có mang dữ liệu riêng hay không |
| `TYPE-4` vs `declare enum` | Loại trừ được: ambient mô tả thứ đã tồn tại, không phát sinh gì |
| `TYPE-5` vs nhiều boolean độc lập | Loại trừ được khi đã nêu các cờ mô tả một tình huống hay nhiều |
| `TYPE-5` vs kiểu transport | Loại trừ được khi đã nêu hình dạng này đi trên dây hay ở lại trong bộ nhớ |
| Thiếu dữ kiện | Hỏi đúng một câu về **nguồn gốc giá trị** hoặc **làn của file**; hai câu đó giải quyết gần hết |

Không có cặp mã nào cần nhiều hơn một câu hỏi để tách. Chỗ mơ hồ còn lại nằm ở những yêu cầu bỏ sót
nguồn gốc của giá trị — và đó là dữ kiện `## Inputs` đã đòi sẵn.

## Findings

- **Sáu mã giữ nguyên số.** `TYPE-1`…`TYPE-6` mang đúng nghĩa của bản phẳng. Không mã nào bị đánh số
  lại, không mã nào bị gộp, không mã nào được thêm.

- **`TYPE-2` có rule ở canon nhưng KHÔNG được bật ở repository.** `no-double-cast` được
  `sources/be/type-safety.mjs` xuất ra và có mặt trong `recommended`, nhưng `eslint.config.mjs` của
  repository không liệt kê nó, và plugin cục bộ cũng không có bản sao nào của nó. Nghĩa là hôm nay,
  trên đĩa, `TYPE-2` **không có gì canh**. Số đo an ủi phần nào: quét cả `src`, mọi file chứa
  `as unknown as` đều là spec, e2e hoặc harness — nghĩa là nợ hiện tại bằng không và việc bật rule
  lên là một thay đổi config, không phải một đợt sửa code. Nhưng "nợ bằng không" là một phép đo tại
  một thời điểm, còn rule là thứ giữ nó ở không.

- **`TYPE-3` và `TYPE-4` đang chạy bằng bản sao cục bộ, không phải bản canon.** Cả hai rule tồn tại
  ở hai nơi dưới cùng một namespace, và plugin cục bộ được đăng ký **sau** nên nó thắng ở mọi tên
  trùng. Chính comment trong config nói rằng bản canon của `no-inline-param-type` **chặt hơn** bản
  cục bộ. Vậy `Tầng giữ` ghi `enforced` là đúng về sự tồn tại của rule, nhưng rule đang thi hành
  không phải rule mà bảng đang trỏ tới.

- **Số hiệu trong config không khớp số hiệu trong luật.** Config gọi `no-inline-param-type` là
  "type-safety §4" trong khi luật đánh nó là `TYPE-3`, và gán nhãn "type-safety §3" cho
  `require-enum-member-jsdoc` — một rule không do file này xuất bản. Đây chính là lý do các mã bị
  đóng băng: một trích dẫn đã tồn tại thì không được đổi số dưới chân người đã trích.

- **Một rule không mang mã nào.** `recommended` xuất bản `@typescript-eslint/array-type` ở dạng
  generic, nhưng bản phẳng không có mã nào cho cách viết mảng, và bản này cũng không thêm — vì thêm
  mã là bịa. Rule đó cũng không được bật trong config repository. Nó đang lơ lửng: một mức thực thi
  không có luật đứng sau.

- **`TYPE-1` được giữ bởi một rule tiêu chuẩn, và đó là quyết định có chủ ý.** File luật nói rõ lý
  do: viết lại một rule mà mọi repo TypeScript đều đã có là chi phí bảo trì không đổi lấy gì. Bảng
  `Tầng giữ` ghi `enforced` và **nêu tên** rule, đúng yêu cầu của tầng — nhưng cũng ghi rõ rule ấy
  được *đặt tên trong* file này chứ không *viết trong* file này.

- **Mọi mã đều neo được.** Không mã nào phải ghi `chưa neo được`. Neo mạnh nhất là `TYPE-4`: có một
  helper nhận **chính enum làm đối số**, nên `const enum` không chỉ bất tiện mà là bất khả thi — đây
  là dạng bằng chứng tốt nhất cho một luật, vì nó không cần ai đồng ý.

- **Neo của `TYPE-5` mang cả luật lẫn ngoại lệ trong một file.** Kết quả nội bộ là union phân biệt,
  class transport bên cạnh có mọi field optional. Một người đọc vội sẽ gọi đó là mâu thuẫn; nó là
  ranh giới của ngoại lệ, và việc hai thứ nằm cạnh nhau khiến ranh giới ấy kiểm chứng được.

## Decisions

- Giữ đúng sáu mã: `TYPE-1`, `TYPE-2`, `TYPE-3`, `TYPE-4`, `TYPE-5`, `TYPE-6`. Không đánh số lại,
  không thêm, không gộp.
- Giữ nguyên mọi quyết định của bản phẳng, kể cả những quyết định audit này không đồng ý — bất đồng
  đi xuống mục dưới, không đi vào một lần sửa im lặng.
- Ghi `enforced` **chỉ khi** gọi được tên rule; ghi `documented` cho mọi thứ còn lại, kể cả khi điều
  đó làm bảng trông yếu đi.
- Coi lối thoát là thuộc tính của **làn**, không của **dòng**, và ghi rõ rằng bản phẳng và file rule
  nói khác nhau về chỗ khai lối thoát ấy.
- Giữ mọi ví dụ ở dạng TypeScript thường, dáng NestJS, không tên sản phẩm; đường dẫn thật chỉ xuất
  hiện trong `Anchor`.

## Rủi ro còn mở

### Các mã chỉ ở tầng `documented`

- **`TYPE-5` — union phân biệt.** Không có rule nào canh, và **không rule nào canh được**. Để giữ mã
  này, một rule sẽ phải nhìn thấy: (a) hai hoặc nhiều field boolean trong cùng một khai báo, (b)
  rằng chúng mô tả **cùng một** tình huống chứ không phải những câu hỏi độc lập, và (c) rằng tồn tại
  ít nhất một tổ hợp không có thật trong nghiệp vụ. Vế (b) và (c) đòi biết **code có nghĩa là gì**.
  Chính file rule đã nói ra điều này: một rule đoán mò sẽ nổ trên mọi struct có hai cờ, và một rule
  nổ khắp nơi bị tắt trong tuần đầu — kết cục tệ hơn không có rule.

  Có một xấp xỉ **hẹp** đáng cân nhắc, và audit này không đề xuất nó, chỉ ghi lại: một rule chỉ nổ
  khi có từ ba boolean trở lên trong một interface **cộng với** ít nhất một field optional không
  phải boolean — hình dạng `isPending/isGraded/isFailed + score?`. Nó vẫn đoán, nhưng đoán ở một
  hình dạng hẹp hơn nhiều. Bật nó lên là một rule change, không phải một lần chọn khác đi.

- **`TYPE-6` — lối thoát khai tại làn.** Không có rule nào canh. Để giữ mã này, một rule sẽ phải
  phân biệt một `eslint-disable` đang **thay thế** cho một khai báo làn còn thiếu với một
  `eslint-disable` thật sự cục bộ — và hai thứ đó là **cùng ba token**. Thứ duy nhất tách chúng là
  tần suất, và tần suất không nằm trong tầm nhìn của một rule chạy trên từng file. Một công cụ
  **quét cả repo** thì làm được: đếm số lần mỗi rule id bị suppress, và báo mọi rule id bị suppress
  từ ba file trở lên như một làn chưa khai báo. Đó là một công cụ, không phải một lint rule, và nó
  chưa tồn tại.

### Khoảng trống bên trong những mã đang ghi `enforced`

- **`TYPE-1` được canh có một nửa.** `no-explicit-any` giữ vế "không `any`". Vế thứ hai — "thu hẹp
  từ `unknown`" — **không có gì canh**. `const candidate = raw as Record<string, unknown>` rồi đọc
  thẳng `candidate.event` là một cast đơn, hợp lệ với mọi rule đang bật, và vẫn là một giả định
  không được kiểm. Một rule muốn giữ vế này phải nhìn thấy rằng giữa cast và lần đọc đầu tiên
  **không có** một `typeof`, `instanceof` hay type predicate nào — tức là phải theo dõi luồng dữ
  liệu, chứ không chỉ hình dạng cú pháp.

- **`TYPE-2` bị lách bằng hai câu lệnh.** Rule chỉ nhìn **một** biểu thức: cast ngoài mà toán hạng
  của nó là một cast tới `unknown`. Tách ra thành `const widened: unknown = raw` rồi
  `widened as EnrollmentEntity` là đúng cùng một hành vi và rule không thấy. Một rule muốn bịt lỗ
  này phải lần được biến cục bộ về khai báo của nó — làm được, nhưng là một rule khác hẳn về độ phức
  tạp, và chi phí đó chưa được đề xuất.

- **`TYPE-3` không đi tới vị trí kiểu.** Rule thăm `FunctionDeclaration`, `FunctionExpression` và
  `ArrowFunctionExpression`. Một chữ ký method trong `interface`, một overload `declare`, hay một
  `TSFunctionType` viết trong một type alias đều mang kiểu inline mà rule không duyệt tới. Đó là một
  khoảng trống **hẹp và mở rộng được**: thêm `TSMethodSignature` và `TSFunctionType` vào visitor là
  đủ, và audit này ghi lại như một đề xuất chờ đo nợ.

- **`TYPE-3` cố tình bỏ qua tham số positional.** Đây **không** phải khoảng trống mà là ranh giới đã
  chốt, ghi ở đây để không có ai "sửa" nó trong một lần dọn dẹp.

### Bất đồng được giữ nguyên, không sửa im lặng

- **Lối thoát của `TYPE-6` được khai ở đâu.** Bản phẳng viết rằng lối thoát "được viết vào config
  thay vì rắc thành suppression từng dòng". File rule làm ngược lại và nói rõ lý do: lối thoát nằm
  **trong rule** chứ không trong một glob của config, vì việc dựng một giá trị sai cố ý là thuộc
  tính của **làn**, không phải của cách một repository sắp xếp thư mục. Bản này giữ **cả hai** câu
  chữ: `INDEX.md` phát biểu mã ở dạng trung lập ("khai một lần, tại làn nó áp dụng"), và bất đồng
  được ghi ở đây. Audit này nghiêng về cách file rule làm, nhưng nghiêng không phải là sửa.

- **`TYPE-2` không được bật ở repository.** Ghi lại như finding, không tự bật. Bật một rule là thay
  đổi cổng của một repository và thuộc về một task có đo nợ, không thuộc về một lần viết lại luật.

- **Hai nguồn plugin dưới một namespace.** Bản canon và bản cục bộ cùng xuất
  `no-inline-param-type` và `no-const-enum`; bản cục bộ đăng ký sau nên thắng. Việc đảo thứ tự là
  bước adoption, và nó có findings đi kèm — cũng thuộc về một task riêng.

## Re-audit Triggers

- `no-double-cast` được bật hoặc vẫn tiếp tục không được bật sau một lần sync lint.
- Một bản sao cục bộ của một rule canon bị xoá, hoặc thứ tự đăng ký plugin bị đảo.
- Xuất hiện một `as unknown as` trong code sản phẩm — tức là số đo "nợ bằng không" đã hết hạn.
- Xuất hiện một `eslint-disable` cho một rule của module này ở từ ba file trở lên.
- Có đề xuất thêm, bớt hoặc đánh số lại một mã `TYPE-<n>`.
- `@typescript-eslint/array-type` được bật, hoặc bị gỡ khỏi `recommended` — cả hai đều buộc phải
  trả lời câu hỏi nó thuộc mã nào.
- Một anchor trong `INDEX.md` không còn tồn tại ở đường dẫn đã ghi.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
