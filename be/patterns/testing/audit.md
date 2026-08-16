---
id: be-patterns-testing-audit
title: audit.md
slug: /be/patterns/testing/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, mức enforce thật và khả năng chống bịa của luật Testing.
---

# audit.md

> Version: `2.00` · Module: `testing`

Audit này kiểm hai thứ: luật có chọn được **một lane và một mã** từ dữ kiện đã nêu hay không, và
bảng `Tầng giữ` có nói **đúng sự thật** về mức enforce hay không. Câu hỏi thứ hai quan trọng ngang
câu hỏi thứ nhất: một module ghi `enforced` cho một mã không có rule đứng sau thì tệ hơn là một
module ghi thẳng `documented`.

## Verdict

Chấp nhận. Mười một mã được giữ nguyên số và nguyên nghĩa từ luật phẳng. Năm mã có lint rule, sáu mã
chỉ có người đọc, và cả mười một mã đều neo được vào code thật.

Điều kiện của lần chấp nhận này: bảng `Tầng giữ` phải giữ đúng tỉ lệ 5/6. Nếu ai đó thêm một rule mà
không sửa bảng, module nói dối về chính mình.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `TESTING-1` vs `TESTING-4` | Loại trừ được khi đã nêu tên trung thực của file và nhánh nó chứa |
| `TESTING-2` vs `TESTING-3` | Loại trừ được: `TESTING-3` là **cửa vào và cách chờ**, `TESTING-2` là **nhìn vào đâu** |
| `TESTING-3` vs lane integration | Loại trừ được bằng hậu tố file; `commandBus.execute` hợp lệ ngoài `*.e2e-spec.ts` |
| `TESTING-4` vs `TESTING-5` | Loại trừ được khi đã trả lời "hỏng thì có việc thứ hai bắt buộc đúng không" |
| `TESTING-5` vs `TESTING-6` | Loại trừ được: thiếu **case** khác thiếu **assertion về kết quả** |
| `TESTING-6` vs ngoại lệ hợp lệ | Loại trừ được ở mức FILE, không ở mức dòng — rule chỉ nổ khi cả file không còn gì khác |
| `TESTING-7` vs `TESTING-8` | Loại trừ được: khai sai lane khác với khai đúng mà rỗng |
| `TESTING-9` vs `TESTING-10` | Loại trừ được bằng chủ thể: quota/parser/persistence, hay chất lượng câu trả lời |
| `TESTING-11` vs fixture của test | Loại trừ được bằng người tiêu thụ: mắt người, hay assertion |
| Thiếu hệ quả | Không đoán. Hỏi đúng một câu: "kết quả hay trạng thái nào đổi khi cái này chạy đúng?" |

Phần mơ hồ còn lại nằm ở những yêu cầu **bỏ sót hệ quả**. Đó là chỗ duy nhất luật này cho phép dừng
lại và hỏi.

## Findings

- **Tỉ lệ enforce là 5/11, và nó được viết ra thay vì được che đi.** Lane của một test là thuộc tính
  của cả file, không phải của một giá trị, nên **không mã nào** đạt tầng `unrepresentable`. Không có
  closed union hay branded type nào làm cho một spec sai hình dạng thành không viết được — spec nào
  cũng là TypeScript hợp lệ dù nó assert hệ quả hay assert phong bì.
- **Hai file e2e đang mang đúng hình dạng mà `TESTING-1` từ chối.** `rewards-queries.e2e-spec.ts` và
  `installment-plan-queries.e2e-spec.ts` là tên nhóm resolver, không phải câu chuyện nghiệp vụ. Đây
  là finding, không phải lý do sửa luật: luật phẳng đã nêu đúng hai cái tên dạng này làm ví dụ phản
  diện, và chúng vẫn còn sống. Ghi ra đây để lần sửa sau có chỗ bắt đầu.
- **Cờ "qua khi rỗng" đang có mặt trên hai script.** Hai lane đó hiện **không** rỗng, nên chưa vi
  phạm `TESTING-8`. Nhưng cờ đó chính là cơ chế mà mã này cảnh báo, nên nó được ghi làm anchor: cái
  đáng theo dõi không phải cờ, mà là số file lane thật sự nhặt được.
- **Rule của `TESTING-3` bắt `.execute()` và `.process()` theo TÊN, không theo kiểu.** Trong lane
  e2e, một helper nội bộ trùng tên cũng bị báo. Đây là over-reach có chủ ý và đã được giữ nguyên: nó
  cho phép rule chạy không cần type information, và cái giá — đổi tên một helper — rẻ hơn nhiều so
  với việc để một flow lách vào bằng cửa sau.
- **`TESTING-9` và `TESTING-10` chạy ngược chiều nhau, và sự bất đối xứng đó là chủ ý.** Trong e2e,
  gọi thật là sai. Trong harness, giả lập là sai. Hai mã không thể gộp, vì gộp lại sẽ mất chính cái
  bất đối xứng làm nên nghĩa của chúng.
- **`TESTING-6` cố ý dừng ở mức file.** Rule đếm assertion trên cả file và chỉ nổ khi *mọi* assertion
  là call matcher. Một phiên bản chặt hơn — nổ theo từng `it` — đã không được chọn, vì nó sẽ cấm luôn
  cái ngoại lệ mà chính luật cho phép.
- **Rule của `TESTING-9` khớp helper model bằng đường dẫn không có tiền tố `tests/`.** Đó không phải
  cẩu thả: file e2e nằm ngay cạnh thư mục helper nên import nó thật sự viết là tương đối, và một
  pattern neo vào đường dẫn tuyệt đối sẽ không bao giờ nhìn thấy.

## Decisions

- **Giữ nguyên mười một mã**, nguyên số và nguyên nghĩa: `TESTING-1` … `TESTING-11`. Chúng được trích
  dẫn từ luật anh em và từ các task record cũ; đánh số lại là làm hỏng một citation đã có người viết
  ra.
- **Không thêm mã thứ mười hai.** Một tình huống thật sự chưa có mã là một rule change ghi vào
  `changelog.md`, không phải một con số thêm vào lúc đang viết.
- **Ghi `documented` là ghi sự thật, không phải thú nhận thất bại.** Sáu mã không có rule vẫn là luật
  đầy đủ; chúng chỉ được giữ bởi người đọc, và bảng nói rõ điều đó.
- **Đặt tên rule bằng khoá đã publish** (`no-call-only-spec`, `e2e-asserts-persisted-state`, …) cộng
  tên export. Một rule được nhắc tới bằng cái tên khác với tên nó publish thì không trích dẫn được
  trong config.
- **Giữ mọi ví dụ ở dạng TypeScript/NestJS tổng quát**, không tên sản phẩm, không tên repository.
  Module private mà luật phẳng nêu tên đã được tổng quát hoá; chỉ những symbol mà **rule thật sự khớp
  theo tên** mới được giữ nguyên, vì đổi chúng sẽ dạy sai.
- **Anchor là điều kiện tồn tại của mã.** Cả mười một mã đều neo được; không mã nào phải ghi
  `chưa neo được`.

## Rủi ro còn mở

Sáu mã dưới đây chỉ ở tầng `documented`. Với mỗi mã: một rule sẽ phải **nhìn thấy gì** mới giữ được
nó, hoặc vì sao không rule nào giữ được.

- **`TESTING-1` — không rule nào giữ được phần cốt lõi.** "File này có đại diện cho một flow nghiệp
  vụ không" là một câu hỏi về **ý nghĩa**, và không có tín hiệu cú pháp nào trả lời được. Cái một
  rule *có thể* nhìn thấy là phần vỏ: một danh sách hậu tố tên file bị cấm (`-queries`, `-mutations`,
  `-resolvers`) trong lane e2e. Nó bắt được đúng hai file đang sống, và bắt trượt mọi file mang tên
  câu chuyện mà thân lại là bộ sưu tập — tức là bắt được ca dễ và bỏ ca khó. Chưa làm, và nếu làm
  phải nói rõ nó chỉ là cái lọc thô.
- **`TESTING-4` — không rule nào giữ được.** "Thất bại này có kéo theo một việc thứ hai bắt buộc đúng
  không" là một mệnh đề về nghiệp vụ. Một rule sẽ phải hiểu rằng `SETTLEMENT_FAILED` kéo theo refund
  còn `empty cart` thì không, và không có gì trong cú pháp phân biệt được hai chuỗi đó.
- **`TESTING-5` — không rule nào giữ được ở mức có ích.** Một rule sẽ phải nhìn thấy **tập nhánh của
  hàm đang được kiểm** rồi so với **tập case trong spec**, tức là cần cả call graph lẫn ánh xạ
  spec↔subject. Coverage tool nhìn được số dòng và số branch đã chạy, nhưng không nhìn được rằng
  branch đã chạy là branch *ở biên*; đó đúng là khoảng cách mà mã này nói tới, nên chính công cụ
  coverage không thể là bằng chứng cho nó.
- **`TESTING-7` — giữ được một phần, chưa viết.** Một rule chỉ cần nhìn thấy **tên file** cộng
  **những gì file import**: một file `*.spec.ts` import world helper của lane flow, hoặc gọi
  `request(app.getHttpServer())`, gần như chắc chắn đang ở nhầm lane. Đây là mã `documented` dễ nâng
  lên `enforced` nhất trong sáu mã, và là đề xuất cụ thể duy nhất audit này đưa ra.
- **`TESTING-8` — không rule ESLint nào giữ được, vì đây không phải câu hỏi về một file.** Nó là câu
  hỏi về **quan hệ giữa config và hệ thống file**: lane này nhặt được bao nhiêu file. Thứ giữ được nó
  là một gate ở CI đếm số file mỗi lane khớp và fail khi con số bằng không — một script, không phải
  một lint rule. Chưa có.
- **`TESTING-11` — không rule nào giữ được phần quan trọng.** "Cohort này có đủ đa dạng để lộ ra lỗi
  của list, count, ranking và join không" là một phán đoán về dữ liệu, không về code. Phần *có thể*
  máy giữ chỉ là phần vỏ: script seed có gọi bước vô hiệu hoá projection hay không, và có nhận tài
  khoản qua tham số thay vì hằng số hay không. Hai thứ đó bắt được ca "vẽ ảnh chụp" và ca "ghim
  identity", nhưng không bắt được ca "một tài khoản trắng" — vốn là ca hay xảy ra nhất.

Ngoài sáu mã trên, hai rủi ro nữa còn để ngỏ:

- **Bảng `Tầng giữ` có thể mục ruỗng trong im lặng.** Thêm một rule vào `sources/be/testing.mjs` mà
  quên sửa bảng thì module nói ít hơn sự thật; sửa bảng mà rule chưa tồn tại thì module nói nhiều hơn
  sự thật, và đó là hướng nguy hiểm hơn. Không có gì tự động kiểm hai bên khớp nhau.
- **`TESTING-2` có một lối thoát bằng disable.** Ngoại lệ yêu cầu nêu tên thứ được quan sát thay thế,
  nhưng **không rule nào đọc được nội dung câu giải thích đó**. Một disable trống rỗng vẫn qua. Đây
  là chỗ mã enforce nhất của module vẫn dựa vào người đọc.

## Re-audit Triggers

- Có rule mới được thêm vào `sources/be/testing.mjs`, hoặc một rule cũ bị gỡ.
- Một mã được đề nghị đổi tầng trong bảng `Tầng giữ`.
- Có đề xuất thêm, bớt hoặc đánh số lại một mã `TESTING-<n>`.
- Một anchor trong `INDEX.md` trỏ vào đường dẫn không còn tồn tại.
- Xuất hiện thêm một file e2e mang tên nhóm resolver, hoặc hai file đang có bị đổi tên.
- Một lane được cấu hình mà số file nó nhặt được bằng không.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
- Lane harness mọc quá hai case cho cùng một capability.
