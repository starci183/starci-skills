---
id: fe-principles-proofs-index
title: Bằng chứng gate principles
slug: /fe/principles/proofs
sidebar_label: INDEX
description: Bảng điểm ba trang cho gate principles — chất lượng entry xuất sắc, danh tính khoá gần như trượt hoàn toàn.
---

# Bằng chứng gate principles

> Ngày: 2026-08-16 · Ba trang founder tự tin · Chuỗi: layouts → blocks → principles → patterns → lints

## Bảng điểm

| Trang | Điểm | TRÚNG | KHÁC MÀ ĐƯỢC | LỆCH | THIẾU | Không đo được | Độ phủ bằng chứng |
|---|---|---|---|---|---|---|---|
| [dashboard](./dashboard.md) | **9.5/28 · 34%** | 8 | 3 | 8 | 9 | 0 | **25/25 entry viết ra nguyên văn** |
| [courses](./courses.md) | **5.5/8 mục đo được · 69%** | 5 | 0 | 3 | 0 | 6 | 2/19 entry đọc được |
| [course-details](./course-details.md) | **11/16 mục đo được · 69%** | 11 | 0 | 3 | 2 | 4 | ~5/28 entry đọc được |
| **Trung bình thô** | **57%** | | | | | | |
| **Trung bình theo trang đo đủ** | **34%** | | | | | | |

**Đọc bảng này cho đúng.** Hai con số 69% của courses và course-details là ảo: chuỗi mù mang `contractEntries` qua bằng tham chiếu ("mười tám entry còn lại, không đổi"), nên phần lớn mục không đo được và những mục còn lại là những mục dễ nhất. **Trang duy nhất đo đủ là dashboard, và nó được 34%.** Đó là con số thật của gate này.

Tách theo hai trục thì bức tranh rõ hơn nhiều:

| Trục | dashboard | courses | course-details |
|---|---|---|---|
| **Chất lượng entry** — why là lý do, không class tương tác/sơn/nổi, không trùng chữ ký, có gộp thay vì đẻ | **4/4** | **4/4** | **4/4** |
| **Danh tính khoá** — đúng tên, đúng chuỗi lớp, đúng `restingCount`, đúng host | 5/26 tên · 1/26 chuỗi lớp | không đo được | ~2/28 tên |

Gate principles **viết entry rất giỏi và đặt tên entry rất tệ**. Cả 25 câu `why` của dashboard đều đúng thể loại "bỏ node này đi thì cái gì gãy", cả 28 câu của course-details dài 33–49 từ và không câu nào ghép lại từ chính từ trong khoá. Không một entry nào trong 72 entry của ba trang mang class bị cấm hay trùng chữ ký với entry khác. Rồi gần như không entry nào trùng với bảng thật.

Lý do đo được, và nó là một câu duy nhất: **gate không có bảng khoá hiện có làm đầu vào.** Chính gate đã ghi điều đó thành dòng nợ đầu tiên của nó và không ai giải:

> "Bảng contract sống chưa được đo, nên hai mươi ba khoá tôi đánh `isNew` có thể đã tồn tại dưới một cái tên khác."

## Gate còn thiếu luật gì

| # | Câu luật lẽ ra đã ngăn được | Trang |
|---|---|---|
| 1 | **Trước khi đặt một khoá mới, gate phải nhận vào bảng khoá hiện có, liệt kê mọi khoá cùng chữ ký, và nêu vì sao khoá cũ không đủ. Không có bảng thì gate DỪNG và hỏi, không được đặt tên.** | 3/3 |
| 2 | **Lược đồ của gate phải diễn đạt được cả bốn hình dạng slot mà bảng thật đang dùng**: slot nội dung không tên `$content`, slot nhận MỘT TRONG nhiều khoá, slot nhận một trong hai leaf, slot do một composite lấp. Hiện `children[].contract` chỉ nhận một chuỗi và `slot` chặn ký tự `$`. | 3/3 |
| 3 | **Chính tả field của entry phải chốt một lần trong canon.** `contracts.ts` viết `classNames`, `tokens.mjs` chỉ đọc `classes`, `contract.mjs` đọc cả hai, tài liệu gate nói `classes`. | 3/3 |
| 4 | **Một khoá đã tồn tại và bị KHOÁ vì dùng chung nhiều trang thì không được đẻ bản sao mang tên khác.** | 2/3 (`price-discount-line` ở courses và course-details) |
| 5 | **`restingCount` phải khớp cardinality thật khi cardinality đó cố định.** | 2/3 |
| 6 | **Một entry mở host landmark (`nav`, `aside`, `section`) phải nói được nhãn đọc được của nó đến từ đâu.** | 2/3 |
| 7 | **Khi nhiều entry buộc phải trùng chuỗi lớp, gate phải liệt kê chúng thành một CỤM và nêu vì sao chúng không được gộp.** Bảng thật của courses có đúng ba entry như thế. | 2/3 |
| 8 | **Một entry chỉ mang một hình dạng; canh giữa là một hình dạng khác với bao khối.** | 1/3 (dashboard gộp `empty-notice-card` với `centred-empty-notice`) |
| 9 | **Chuỗi lớp của một danh sách nối là một BỘ ĐÓNG.** Thiếu `overflow-hidden` là góc bo bị hàng đầu đục thủng, và không rule nào bắt. | 1/3 |
| 10 | **Một lưới có số ô CỐ ĐỊNH thì selector viền trong phải viết theo đúng số ô đó, và số ô phải nằm trong `why`.** | 1/3 |
| 11 | **Bảng phải thụt vào ĐÚNG bốn khoảng trắng và khoá không chứa chữ số**, nếu không `readContracts` trả null và ba rule đọc bảng tắt trong im lặng. | 3/3 (ràng buộc hình thức không ai được cho biết) |

## Gate im lặng ở đâu

`uncertain` của gate principles không tồn tại trong chuỗi mù. Chỗ im lặng nghiêm trọng nhất, đọc lại từ dòng nợ:

> "Bốn hình dạng slot mà cây này cần không viết ra được trong `gate.schema.json`… Trường `children[].slot` chặn ký tự đô la, `children[].contract` chỉ nhận một chuỗi, và không có trường `composite` nào, trong khi luật hợp đồng cho phép cả bốn; tôi để trống kiểu thay vì khai một kiểu sai."

**Lược đồ của chính gate không diễn đạt được ba trong bốn hình dạng slot mà bảng contract thật đang dùng.** Union ba khoá của slot `main` trên dashboard rơi mất ngay tại đây, và mọi hệ quả xuống dưới là kế thừa.
