---
id: be-patterns-observability-audit
title: audit.md
slug: /be/patterns/observability/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, mức được giữ và mức neo được của luật Observability.
---

# audit.md

> Version: `2.00` · Module: `observability`

Audit này kiểm tra hai việc: luật có chọn được một quyết định chỉ từ **dữ kiện đã nêu** hay không, và
mỗi mã có **neo được vào code thật** hay không.

## Verdict

Chấp nhận, kèm hai điểm lệch đã đo được và được ghi lại nguyên trạng. Tám mã giữ nguyên số và nguyên nghĩa. Không
mã nào bị đổi tên, không mã nào bị gộp, không mã mới nào được thêm.

Các điểm lệch được ghi vào Findings và Rủi ro còn mở, **không** được âm thầm sửa trong luật. Luật nói `catch` ghi
danh tính; code hiện tại ghi câu chữ. Cái sai là code, và audit này nói ra chỗ đó thay vì hạ luật
xuống cho khớp.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `-1` vs `-2` | Loại trừ được: `-1` hỏi đi qua đâu, `-2` hỏi mang tên gì |
| `-1` vs `-6` | Loại trừ được khi đã nêu có request/job hay không |
| `-2` vs `-3` | Loại trừ được: dữ liệu nằm trong tên là `-2`, nằm cạnh tên là `-3` |
| `-3` vs `-5` | Loại trừ được khi đã nêu call site nằm trong `catch` hay không |
| `-4` vs `-2` | Loại trừ được khi đã nêu nhánh có kết cục khác nhau được hay không |
| `-4` vs `-3` | Loại trừ được: sai chỗ đặt khác với đúng chỗ mà thiếu bằng chứng |
| `-7` vs `-8` | Loại trừ được: mở rộng phạm vi tín hiệu khác với thêm một tiến trình chở nó |
| Thiếu dữ kiện | Hỏi đúng một câu phân định rồi dừng; không đoán vòng đời của call site |

## Findings

- **Hai trong tám mã được giữ bằng máy.** `-1` và `-2` có rule; sáu mã còn lại chỉ có người đọc. Bảng
  `Tầng giữ` trong `INDEX.md` viết đúng con số đó thay vì làm tròn lên, vì sáu dòng `documented` mới
  là thứ nói cho ta biết luật sẽ vỡ ở đâu trước.
- **`-2` được giữ hai tầng ở neo.** Rule bắt chuỗi ở đối số đầu, và chữ ký
  `log<TName extends WinstonLog>(name: TName, …)` làm chuỗi không viết ra được. Tầng kiểu mạnh hơn,
  nhưng nó là tài sản của **một** house service; rule mới là thứ đi theo luật sang repository khác.
  Vì thế hàng của `-2` ghi `enforced` và nói thêm về tầng kiểu, chứ không ghi `unrepresentable`.
- **`-5` neo được, và neo cho thấy luật đang bị bỏ.** Các worker ghi `error: error.message` vào
  `JobExecutedFailed`, và kiểu `JobExecutedMessage.error?: string` mời gọi đúng hành vi đó. Đây là
  lệch thật giữa source và trust, không phải một cách đọc khác của luật.
- **`-6` neo được, và neo cho thấy lối ra đang lấy sai cách.** Bốn entry point đứng một mình lấy lối
  ra bằng `eslint-disable-next-line` trên từng dòng, trong khi luật nói khai **một lần theo path** và
  `sources/be/observability.mjs` đã export sẵn danh sách glob cho đúng việc đó.
- **Tên rule ở repo tiêu thụ chưa phải tên canon.** Config đang bật một rule cùng hình dạng dưới tên
  `no-nest-logger`; tên canon là `no-framework-logger`. Mã `-1` vẫn được giữ bằng máy, nhưng bảng
  `Tầng giữ` gọi tên rule của canon, vì đó là thứ đi theo luật.
- **Ví dụ trong luật phẳng gọi `.info(...)` / `.error(...)`; house service ở neo chỉ phơi ra `log(...)`,
  mức được lấy từ config của từng sự kiện.** Cả hai vẫn nằm trong phạm vi rule. Ghi lại vì đây là chỗ
  người đọc dễ tưởng một trong hai bên sai, trong khi quyết định thật của luật là về **đối số đầu
  tiên**, không phải về tên method.
- **`-4` có một vùng mờ đã đo được.** Họ sự kiện `*StepExecuted` ở neo vừa chứa kết cục thật (bỏ qua,
  hỏng) vừa chứa dấu chân đi ngang. Luật đã có ranh giới cho việc này; source thì chưa áp đều.
- **Tập tên sự kiện đã lớn (~128 thành viên).** Vẫn là tập đóng, và vẫn liệt kê được. Nhưng một tập
  đóng cỡ này chỉ còn đóng trên danh nghĩa nếu không ai xem lại nó — theo dõi, không đổi luật.

## Decisions

- Giữ đúng tám mã: `OBSERVABILITY-1` … `OBSERVABILITY-8`, nguyên số, nguyên nghĩa, vì chúng đang được
  trích dẫn chéo từ file luật khác và từ các bản ghi công việc cũ.
- Giữ nguyên quyết định "một service duy nhất", "tên là thành viên enum", "dữ liệu đi cạnh tên",
  "log quyết định", "thất bại ghi danh tính", "lối ra khai theo path", "Minimal rồi mới Full", "mỗi
  tiến trình telemetry trả giá vòng đời của nó".
- Giữ lối ra `-6` ở dạng **một danh sách path duy nhất**, export từ nguồn để config và gate đọc cùng
  một chỗ.
- Ghi mọi bất đồng vào Rủi ro còn mở, không sửa lặng vào luật.
- Giữ mọi ví dụ ở dạng TypeScript/NestJS thường, không tên sản phẩm, không tên repository. Hai định
  danh `winstonService` và `WinstonLog` được giữ vì rule khoá theo chúng.

## Rủi ro còn mở

Sáu mã chỉ được giữ bằng người đọc. Với mỗi mã: một rule sẽ phải **nhìn thấy** cái gì mới giữ được nó
— hoặc vì sao không rule nào giữ nổi.

- **`OBSERVABILITY-3` — dữ liệu đi cạnh tên.** Một rule *có thể* thấy: lời gọi log trên receiver house
  service có ít hơn hai đối số, hoặc đối số thứ hai không phải object/identifier. Cái nó **không**
  thấy được là các trường có đúng là bằng chứng của sự kiện hay không — `{}` hợp lệ về cú pháp và vô
  dụng về nghiệp vụ. Giữ được nửa dưới, không giữ được nửa trên.
- **`OBSERVABILITY-4` — log quyết định.** Không rule nào giữ nổi. Phân biệt "đây là một nhánh đã được
  chọn" với "đây là dấu chân đi ngang" cần biết đoạn code đó **để làm gì**, và không parser nào biết.
  Thứ duy nhất máy làm được là chặn theo danh sách tên (`*Entered`, `*Started`), và đó là một heuristic
  theo cách đặt tên: nó bắt nhầm những sự kiện bắt đầu thật sự có nghĩa và bỏ lọt mọi dấu chân được
  đặt tên khéo.
- **`OBSERVABILITY-5` — thất bại ghi danh tính.** Đây là mã `documented` gần với `enforced` nhất. Một
  rule sẽ phải thấy: bên trong `CatchClause`, một lời gọi log trên house service có property được gán
  từ `<err>.message`, `String(<err>)`, hoặc một template literal chứa `<err>` — với `<err>` là tham số
  của chính `catch` đó. Cái nó **không** kiểm được là trường `code` có thật sự là danh tính của
  exception hay chỉ là một chuỗi nào đó. Đề xuất rule, không phải đổi luật.
- **`OBSERVABILITY-6` — lối ra khai theo path.** Bản thân lối ra là **config**, nên rule không giữ nó.
  Nhưng cái ngược lại thì máy thấy được: một comment `eslint-disable` gọi tên rule logging, nằm **ngoài**
  `standaloneProgramGlobs`, là bằng chứng lối ra đang bị lấy theo dòng. Một gate đọc cùng danh sách
  glob đó và đếm số comment như thế sẽ giữ được mã này mà không cần rule mới.
- **`OBSERVABILITY-7` — Minimal rồi mới Full.** Không rule nào giữ nổi: ranh giới phase nằm trong một
  bản ghi Review, không nằm trong source, và "hoãn có chủ đích" không để lại dấu vết cú pháp nào. Thứ
  máy kiểm được là **hình dạng của brief**: có đủ ba mục *đã có / thêm / hoãn* và một trigger đo được
  hay không. Đó là gate của quy trình, không phải lint.
- **`OBSERVABILITY-8` — vòng đời của tiến trình telemetry.** Không rule TypeScript nào giữ nổi, vì thứ
  được thêm vào thường không phải TypeScript: nó là một service trong manifest triển khai. Một gate
  đọc manifest có thể đòi mỗi tiến trình telemetry khai đủ chủ sở hữu, tài nguyên, cổng, credential,
  lưu trữ, health check, backup và điều kiện gỡ. Ngoài phạm vi lint.

Hai rủi ro nữa, không thuộc tầng giữ:

- **Nửa "khai đủ vòng đời" của `-8` `chưa neo được`.** Không có tiến trình telemetry tại chỗ nào trong
  runtime để trỏ vào; neo hiện tại chỉ chứng minh được nửa "dùng lại đường đã có". Mã này sẽ neo đủ
  vào lần đầu có một tiến trình như thế được đề xuất — và đó cũng đúng là lúc cần nó nhất.
- **Lệch giữa luật và code ở `-5` và `-6` đang mở.** Chúng được ghi ở Findings làm việc phải sửa trong
  source; nếu lần audit sau vẫn còn nguyên, câu hỏi không còn là "sửa chỗ nào" mà là "luật này có
  thật sự được áp không".

## Re-audit Triggers

- Có đề xuất thêm, bỏ hoặc đánh số lại một mã `OBSERVABILITY-<n>`.
- `sources/be/observability.mjs` thêm hoặc bỏ một rule, hoặc đổi tên một rule đang được bảng
  `Tầng giữ` gọi tên.
- Một comment tắt rule logging xuất hiện ngoài `standaloneProgramGlobs`.
- Một call site trong `catch` ghi câu chữ của exception làm khoá group.
- Một tiến trình telemetry mới được đề xuất, hoặc một tiến trình đang có bị gỡ.
- Một bổ sung Phase 2 được duyệt mà không kèm bằng chứng đo được.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
- Tập tên sự kiện lớn thêm một bậc độ lớn, hoặc không còn liệt kê được ở một chỗ.
