---
id: be-patterns-cqrs-audit
title: audit.md
slug: /be/patterns/cqrs/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo của luật CQRS.
---

# audit.md

> Version: `2.00` · Module: `cqrs`

Audit này kiểm hai việc: luật có chọn được **một vị trí file duy nhất** từ dữ kiện đã nêu hay
không, và mỗi mã đang được giữ ở **tầng nào** — chứ không phải tầng nào ta muốn nó được giữ.

## Verdict

Chấp nhận. Bảy mã giữ nguyên số và nguyên nghĩa, cả bảy đều neo được vào code thật; bảng tầng giữ
nói thẳng rằng bốn mã hiện chỉ có người đọc giữ.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `CQRS-1` vs `CQRS-7` | Loại trừ được: "được phép nằm" khác "bắt buộc phải nằm" |
| `CQRS-1` vs `CQRS-4` | Loại trừ được: một bên hỏi file nằm đâu, một bên hỏi file chứa gì |
| `CQRS-2` vs `CQRS-4` | Loại trừ được khi đã nêu ai đọc chỗ đó và ai gọi được chỗ đó |
| `CQRS-3` | Không cần phân định: hoặc có `execute` trên handler, hoặc không |
| `CQRS-4` vs `CQRS-5` | Loại trừ được khi đã nêu ai đưa ra quyết định từ chối |
| `CQRS-5` vs `CQRS-6` | Loại trừ được khi đã nêu câu trả lời của người gọi có phụ thuộc hay không |
| `CQRS-6` vs `CQRS-2` | Loại trừ được bằng đúng một câu hỏi: có ai đang chờ không |
| Thiếu dữ kiện về cửa | Mặc định coi là có cửa thứ hai; CLI và bộ test đã là cửa thứ hai |

## Findings

- Ba mã có rule giữ: `CQRS-2` (`message-carries-params-only`), `CQRS-3`
  (`handler-overrides-process`), `CQRS-7` (`handler-has-twin-spec`). Bốn mã còn lại — `CQRS-1`,
  `CQRS-4`, `CQRS-5`, `CQRS-6` — chỉ có người đọc giữ.
- Đây **không** phải một lỗ hổng cần lấp bằng mọi giá. Bốn mã ấy đều là phán đoán: công việc nằm ở
  đâu, service mỏng tới mức nào, một `null` mang nghĩa gì, người gọi có chờ hay không. Một rule đoán
  mấy thứ đó sẽ báo sai trên code đúng đủ nhiều để cả đội học cách tắt nó — và một rule bị tắt giữ ít
  hơn một rule không tồn tại, vì nó còn tạo cảm giác đã được giữ.
- `CQRS-3` là mã đáng có rule nhất, và lý do đáng ghi lại: handler override `execute` vẫn compile,
  vẫn chạy, không có gì đỏ. File ấy chỉ sai vào đúng cái ngày một mối quan tâm cắt ngang được thêm
  vào base và bỏ sót nó trong im lặng. Đó đúng là hạng sai lầm mà rule sinh ra để bắt: vô hình ở chỗ
  gọi, đắt về sau.
- Một nửa của `CQRS-3` thật ra ở tầng `unrepresentable`: base khai `process` là `abstract`, nên lớp
  con cụ thể thiếu `process` không compile. Nửa còn lại — override `execute` — hoàn toàn viết được,
  và đó chính là nửa cần rule.
- `CQRS-7` có rule nhưng **mặc định tắt**, vì nó cần danh sách file trong thư mục truyền vào như một
  option. Rule cố tình đọc **tên file** chứ không `stat` đĩa: một rule mà kết quả đổi theo working
  tree là một rule không ai tái lập được.
- `handler-overrides-process` cố ý **không** báo khi lớp có superclass. Đo trên source thật, báo bất
  kể superclass cho ra mười lần báo sai và ba lần báo đúng; giữ nguyên cách đo hẹp là một quyết định
  có bằng chứng, không phải một lần nhân nhượng.
- `message-carries-params-only` cố ý bỏ qua class có decorator, vì một framework CLI dùng chung hậu
  tố `.command.ts` cho một class có `run` — đó là cửa, không phải message.

## Decisions

- Giữ đúng bảy mã: `CQRS-1` … `CQRS-7`, nguyên số, nguyên nghĩa. Mã bị trích dẫn từ file luật khác và
  từ task record, nên đánh số lại là làm hỏng một trích dẫn đã có người viết ra.
- Không thêm mã mới trong lần chuyển này. Module vào với bảy mã và ra với bảy mã.
- Ghi bảng **Tầng giữ** vào `INDEX.md` và ghi trung thực: bốn dòng `documented` là hiện trạng, không
  phải chỗ trống cần che.
- Ghi bảng **Anchor**: mỗi mã trỏ vào một file thật và nói rõ nhìn cái gì ở đó. Luật không chỉ được
  vào code thật là đề xuất, không phải luật.
- Giữ mọi ví dụ ở dạng TypeScript thường, không tên sản phẩm, không tên repository. Path repository
  chỉ xuất hiện trong bảng Anchor, và ở đó chúng là bằng chứng chứ không phải minh hoạ.
- Giữ nguyên chính sách ra mắt rule: `warn` kèm số nợ, giảm số nợ về không, rồi mới `error`.

## Rủi ro còn mở

- **`CQRS-1` chỉ `documented`.** Một rule giữ được nó sẽ phải thấy **danh sách file trong thư mục**
  và tên thao tác suy ra từ tên thư mục, rồi báo mọi file không khớp `<thao-tác>.<vai-trò>.ts`. Về
  nguyên tắc làm được, và làm được theo đúng cách `handler-has-twin-spec` đang làm: nhận listing như
  một option thay vì đọc đĩa. Chưa làm, nên hiện chỉ có người đọc giữ.
- **`CQRS-4` chỉ `documented`, và có lẽ mãi mãi.** Một rule sẽ phải thấy được "câu lệnh này là nghiệp
  vụ" — phân biệt được một lần `await` vào repository với một lần `await` vào bus. Đo thô thì làm
  được (service chỉ được import bus và type), nhưng một service hợp lệ vẫn có thể import một mapper
  vô hại, và ranh giới giữa "map" với "quyết định" không phải thứ parser thấy.
- **`CQRS-5` chỉ `documented`.** Rule sẽ phải biết `null` nào có nghĩa "không tìm thấy và đó là thất
  bại" và `null` nào có nghĩa "không có, và không có là bình thường". Cùng một câu `return null`, hai
  nghĩa, và cái phân biệt chúng nằm ở domain chứ không nằm trong file. Không rule nào giữ được nếu
  kiểu trả về chưa nói ra sự khác biệt ấy.
- **`CQRS-6` chỉ `documented`, và đây là mã khó nhất.** Bằng chứng vi phạm nằm ở **người gọi**, không
  nằm ở chỗ publish: một `eventBus.publish` hoàn toàn đúng đắn trở thành sai chỉ vì ba dòng sau đó có
  người đi dò lại database. Một rule muốn giữ nó phải đọc được cả hàm chứa lời publish và nhận ra
  hình dáng "publish rồi poll" — làm được ở mức heuristic, và một heuristic ở đây sẽ báo sai đúng vào
  những chỗ khó nhất.
- **`CQRS-7` được đánh `enforced` nhưng thực tế thường là `documented`.** Rule mặc định `off`. Một
  repository không nối listing vào thì mã này không có gì giữ, và bảng Tầng giữ nói điều đó ra thay
  vì để người đọc tự phát hiện.
- **Ngoại lệ "type transport trong thư mục thao tác" mâu thuẫn với cách đọc chặt của `CQRS-1`.** Luật
  phẳng nói: file trong thư mục thao tác mà không mang tên thao tác là thứ vừa được phát minh ra ở chỗ
  không ai tìm. Source tham chiếu thì mang một thư mục con chứa type request/response không mang tên
  thao tác. Ở đây **giữ nguyên luật** và ghi mâu thuẫn ra: hoặc luật cần một câu nói rõ về thư mục con
  theo vai trò, hoặc source cần đổi. Đây là một finding chờ giải quyết, không phải một lần sửa lén.
- **Không mã nào ở tầng `unrepresentable` trọn vẹn.** Có thể làm được nhiều hơn — ví dụ một kiểu trả
  về đóng khiến "thất bại mã hoá thành giá trị" không viết được, hoặc một base khiến `execute` không
  override nổi. Chưa đề xuất trong phiên bản này; nếu đề xuất, đó là một rule change và phải đi qua
  `changelog.md`.

## Re-audit Triggers

- Có đề xuất thêm hoặc bỏ một mã `CQRS-<n>`.
- Có rule mới trong `sources/be/cqrs.mjs`, hoặc một rule đổi mức giữa `off`, `warn` và `error`.
- Base handler đổi hình dáng template method (`execute` gọi `process`).
- Một handler xuất hiện với `execute` được khai báo mà không ai báo đỏ.
- Một thư mục thao tác lại mọc file dùng chung, hoặc một thao tác lại bị xẻ làm hai cây.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
- Một anchor trong `INDEX.md` trỏ vào path không còn tồn tại.
