---
id: fe-patterns-translation-audit
title: audit.md
slug: /fe/patterns/translation/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo vào code thật của luật Translation.
---

# audit.md

> Version: `2.00` · Module: `translation`

Audit này kiểm hai thứ: luật có chọn được **một** mã từ các dữ kiện đã nêu và chỉ từ đó hay không, và
mỗi mã có thật sự được giữ bởi tầng mà nó tự nhận hay không.

## Verdict

Chấp nhận, với một khoảng hở đã được đo và ghi rõ. Sáu mã đóng, phân định được bằng câu hỏi nghiệp vụ,
không phụ thuộc tên sản phẩm nào. Nhưng chỉ **hai trong sáu** mã có rule giữ, và mã dễ bị lạm dụng
nhất — `COPY-6` — vừa không có rule vừa **chưa neo được** vào code thật.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `COPY-1` vs `COPY-2` | Loại trừ được: một bên nói chữ được **chọn** sai chỗ, một bên nói chữ **nằm** sai chỗ |
| `COPY-1` vs `COPY-3` | Loại trừ được khi đã nêu con có phải tra thêm một bước nữa không |
| `COPY-2` vs `COPY-6` | Loại trừ được khi đã nêu có đoạn code nào so khớp với chuỗi đó |
| `COPY-3` vs `COPY-4` | Loại trừ được: `COPY-4` nói hàng đã resolve đi trong `props`, `COPY-3` cấm hàng chưa resolve đi cùng đường |
| `COPY-4` vs `COPY-1` | Loại trừ được khi đã nêu chữ đến bằng `props` hay bằng provider |
| `COPY-5` vs `COPY-6` | Loại trừ được: miễn vì **là nội dung** khác với giữ vì **bị so khớp** |
| `selectedKey` vs `labelKey` | Loại trừ được bằng phép thử "xoá hết từ điển thì cái nào còn render đúng" |
| Thiếu dữ kiện | Mặc định coi chuỗi là copy; chỉ hỏi một câu khi bên yêu cầu nói rõ có bên thứ ba so khớp |

## Findings

- **Hai rule của module chỉ phủ hai mã.** `starci-fe/no-copy-resolution-below-block` giữ `COPY-1`,
  `starci-fe/no-hardcoded-copy-in-vocabulary` giữ `COPY-2`. Bốn mã còn lại chỉ có người đọc giữ.
- **Rule thứ hai là rule đáng giá hơn, đúng như nó tự nhận.** Cấm gọi hàm dịch dưới block gần như
  thừa: luật split đã chặn nửa vẽ với tay ra runtime rồi. Thứ không ai khác bắt được là một literal
  **người đọc nhìn thấy** nằm trong tier lẽ ra phải nhận mọi chữ nó vẽ.
- **Phép thử prose cố tình thô** — có dấu cách và bắt đầu bằng chữ hoa. Chỗ này đã được cân nhắc và
  chọn: một phép thử thô, bắt được copy thật và tha token, đáng tin hơn một phép thử tinh mà không ai
  dám bật ở mức error.
- **Đo trên một cây source thật đang chạy luật này:** không có file nào dưới `leaves/`, `composites/`,
  `branches/`, `shells/` gọi hàm resolve chữ; không có `component.tsx` nào gọi; 35 `index.tsx` của
  block có gọi. Nghĩa là `COPY-1` và `COPY-2` không chỉ có rule, chúng có **kết quả bằng không**.
- **`COPY-6` đang bị dùng sai trên diện rộng, và không có gì bắt được.** Cùng cây source đó có 158
  dòng mang dấu `vn-ok:`, thuộc ba nhóm lý do — tất cả đều là **copy hiển thị**, không dòng nào là
  giá trị chương trình so khớp. Dấu vốn được đặt ra để nói "đây là một quyết định" đang được dùng để
  nói "cho tôi qua cổng ngôn ngữ".
- **`COPY-5` được giữ ổn nhất trong bốn mã `documented`**, không phải nhờ rule của module này mà nhờ
  hình dạng của miễn trừ: nó là một danh sách đường dẫn, nên không file nào tự cãi được cho mình.

## Decisions

- Giữ đúng sáu mã: `COPY-1`…`COPY-6`, nguyên số và nguyên nghĩa. Chúng đang được trích dẫn từ nơi
  khác; đổi số ở đây là làm gãy một trích dẫn đã có người viết ra.
- Không đếm rule của luật hàng xóm vào tầng của module này. `starci-fe/no-second-language-in-source`
  (từ `comments.mjs`) có chạm `COPY-5` và `COPY-6`, nhưng nó bắn theo **ngôn ngữ**, nên nó không bao
  giờ thấy một key tiếng Anh vượt biên và không phân biệt được chuỗi matched với copy đã đánh dấu.
  Ghi nó ra như một chú thích, không tô nó thành `enforced`.
- Giữ `COPY-5` và `COPY-6` **trong** luật thay vì để chúng thành ngoại lệ không tên. Một trường hợp
  không có tên là một trường hợp không ai bị chỉ ra là đã làm sai.
- Giữ mọi ví dụ ở dạng TSX thường, không tên sản phẩm, không component library.
- Luật là **bắt buộc**: không có chuỗi nào ngắn tới mức được miễn khai báo mã.

## Rủi ro còn mở

Bốn mã dưới đây chỉ ở tầng `documented`. Với mỗi mã, câu hỏi là: **một rule sẽ phải nhìn thấy gì** thì
mới giữ được nó.

- **`COPY-3` — key vượt biên.** Một rule *có thể* làm được, và đây là ứng viên rẻ nhất: trong file
  dưới block, báo mọi prop có tên khớp `/(Key|MessageId|I18nKey)$/` mà giá trị là chuỗi có dấu chấm,
  hoặc mọi lời gọi `t(props.x)`. Cái nó **không** nhìn thấy được là key đi trong một mảng hằng số ở
  file khác rồi mới được truyền xuống, vì lúc đó chuỗi và chỗ dùng nằm ở hai file. Rủi ro thật: mảng
  cấu hình trông như dữ liệu và qua review dễ hơn một prop đơn lẻ.
- **`COPY-4` — chữ đi trong `props`.** Nửa mã này *có thể* giữ bằng máy: cấm nửa vẽ đọc context để
  lấy chữ là một phép thử theo tên hàm. Nửa còn lại — "chuỗi này đã được resolve chưa" — thì **không
  rule nào ở mức file thấy được**, vì `label: string` và `labelKey: string` giống hệt nhau trong kiểu.
  Chỉ có một dạng bằng chứng thay thế được: bài test dựng nửa vẽ **không có provider nào**. Đó là lý
  do `component.test.tsx` được neo cho mã này thay cho một rule.
- **`COPY-5` — từ điển là nội dung.** Không rule nào của module này cần tồn tại, vì mã này không cấm,
  nó **miễn**. Thứ giữ nó là danh sách `CONTENT_PATHS` ở luật hàng xóm. Rủi ro còn lại nằm ở chỗ ai đó
  dựng một "từ điển" bằng file `.ts` ngoài thư mục locale rồi đòi được miễn theo tinh thần; miễn trừ
  theo đường dẫn từ chối chuyện đó, nhưng nó từ chối bằng cách **báo lỗi**, không bằng cách giải thích.
- **`COPY-6` — chuỗi chương trình so khớp.** Đây là mã **không rule nào giữ được**, và nên nói thẳng
  lý do thay vì hẹn một rule sau này. Để phán được, rule phải trả lời "có đoạn code nào so sánh với
  chuỗi này không" — một câu hỏi toàn dự án, xuyên file, xuyên cả ranh giới sang server. Rule ở mức
  file không có dữ kiện đó. Thứ duy nhất máy đọc được là **cái dấu**, và cái dấu là do con người viết,
  nên nó chứng minh có người đã gõ chữ `vn-ok:`, không chứng minh chuỗi đó là value.

  Hệ quả đo được đã ghi ở Findings: 158 dòng mang dấu, không dòng nào là chuỗi được so khớp. Cách rẻ
  nhất để lấy lại tín hiệu **không phải** là một rule mới, mà là bắt phần lý do sau `vn-ok:` phải nêu
  **chỗ so khớp** — lúc đó một rule mới có thể kiểm hình dạng của lý do, dù vẫn không kiểm được sự
  thật của nó. Đây là đề xuất rule change, không phải một lần chọn khác đi, nên nó nằm ở đây chứ
  không nằm trong `INDEX.md`.

- **`COPY-6` chưa neo được.** Bảng `Anchor` ghi `chưa neo được` vì trong code thật không tìm được một
  dòng nào vừa mang dấu vừa đúng là giá trị được so khớp. Mã vẫn giữ nguyên: nó mô tả một tình huống
  có thật và một cách hỏng **im lặng**, mà im lặng là lý do nó cần một cái tên. Nhưng cho tới khi có
  một neo dương, phần này của luật vẫn ở mức đề xuất theo đúng thước đo của canon, và audit này nói ra
  điều đó thay vì đi tìm một neo dễ dãi.

## Re-audit Triggers

- Có thêm một rule vào `.claude/sources/fe/translation.mjs`, hoặc một rule hiện có đổi phạm vi.
- Xuất hiện một dòng `vn-ok:` thật sự là giá trị được so khớp — lúc đó `COPY-6` có neo dương và bảng
  `Anchor` phải sửa.
- Số dòng mang dấu `vn-ok:` tăng thêm một nhóm lý do mới.
- Có prop tên `*Key` mới xuất hiện dưới ranh giới block.
- Một tier mới được thêm vào `VOCABULARY_DIRS`, hoặc một tier hiện có bị đổi tên.
- Có đề xuất áp luật ngôn ngữ của source lên một đường dẫn nội dung.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
