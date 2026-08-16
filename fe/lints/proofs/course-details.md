---
id: fe-lints-proof-course-details
title: course-details
slug: /fe/lints/proofs/course-details
sidebar_label: course-details
description: Chấm gate lints trên trang chi tiết khóa học — không chạy một lệnh nào, thừa nhận thẳng, và vẫn tìm đúng những chỗ đỏ mà hai trang có chạy thật đã tìm ra.
---

# course-details · gate lints

> Ngày: 2026-08-16 · Chuỗi: layouts → blocks → principles → patterns → lints

## IN

Đầu ra gate patterns: 28 file, 28 contract entry, `sourceSketch` cho một phần, 47 quyết định, 10 dòng nợ.

## EXPECTED OUT

Chuẩn chấm là `expected.lints` của trang course-details, trong đó có hai điểm được fixture đánh dấu là "cần soi":

> "`no-hand-written-contract-attrs` — `data-node` phải do frame gắn; `selectSection()` ĐỌC `[data-node="course-section"]` nhưng không ghi, nên chỉ là ràng buộc ngầm chứ chưa phạm rule."

> "`no-double-cast` — `key as CourseDetailSection` trong ChoiceTabs select là ép một lần, hợp lệ theo rule này nhưng là điểm cần soi."

Cộng nghĩa vụ hình thức như hai trang trên.

## ACTUAL OUT

```
Phép đo: KHÔNG chạy lệnh nào. Toàn bộ 59 kết quả đến từ ĐỌC MÃ NGUỒN RULE trong
         .claude/sources/fe và đối chiếu bằng mắt với mã của gate patterns.
         Khai thẳng ở dòng owed đầu tiên:
         "gọi nó là chay-that sẽ là một lời khai sai."

Kết quả: 2 rule fail (6 vị trí) · 45 pass · 12 khong-ap-dung · suppressions 0
Chặn:  no-inline-parameter-type   ×2  (CoursePricingRail, CourseMobileEnrollBar —
         "isInlineObjectType đi XUYÊN TSIntersectionType")
       require-export-jsdoc       ×4  (page component, pricing rail, leaf, hook)
Bản sửa được viết ra nguyên văn: đặt tên `CoursePricingRailOn` / `CourseMobileEnrollBarOn`,
       cộng block doc cho mọi export; và thêm `useRouter` mà gate patterns quên tạo
Audit effective-config: FAIL — chưa chạy, "chưa đo thì không phải xanh"
gates: cả bốn `chua-chay`
unenforced: 7   owed: 7   verdict: do-chan-lai
```

Đếm thật thay vì ước lượng, ở đúng chỗ đáng đếm:

> "Đếm thật hai mươi tám câu why: ngắn nhất là ba mươi ba từ (`figure-over-unit-label` và `price-lines-over-saving-note`), dài nhất bốn mươi chín, không câu nào dưới sàn mười hai từ."

## CHẤM

| Mục | Expected | Actual | Kết | Gốc / kế thừa |
|---|---|---|---|---|
| mọi rule có kết quả | 59 | 59 | TRÚNG | gốc |
| chạy thật | nên | KHÔNG chạy gì; khai thẳng `doc-nguon` cho cả 59 | LỆCH | gốc |
| không mượn uy tín của phép đo | phải | `evidence: doc-nguon` trên từng dòng, không cái nào ghi `chay-that` | TRÚNG | gốc |
| kỷ luật đối chứng | nên | không có lab đối chứng nào | THIẾU | gốc |
| bắt kiểu inline ở tham số | phải | bắt, và bắt đúng cơ chế: `isInlineObjectType` đi xuyên intersection | TRÚNG | gốc |
| bắt va chạm meta ↔ jsdoc | phải | bắt, 6 vị trí | TRÚNG | gốc |
| `blocking` kèm cách sửa, không tắt rule | phải | có, và viết luôn mã đã sửa | TRÚNG | gốc |
| tự bắt lỗi của gate trước ngoài phạm vi rule | nên | BẮT: `router` được gọi mà không ai tạo; sáu định danh treo | TRÚNG | gốc |
| audit adoption trung thực | phải | FAIL, lý do đúng: "chưa đo thì không phải xanh" | TRÚNG | gốc |
| `unenforced` nêu chỗ máy không giữ | phải | 7 mục, gồm hai mục sắc: `BlockProps` bị intersection mở lại, và "không rule nào đòi một tài liệu PHẢI có một main" | TRÚNG | gốc |
| `at` trỏ vào repo sống | schema đòi | vị trí DỰ KIẾN theo thứ tự khai báo; khai thẳng là chưa đo | LỆCH (lỗi lược đồ) | gốc |
| `no-hand-written-contract-attrs` — điểm cần soi | fixture đánh dấu | chấm PASS, không nhắc `selectSection` đọc `data-node` | THIẾU | kế thừa (vùng nav bị bỏ từ layouts) |
| `no-double-cast` — điểm cần soi | fixture đánh dấu | chấm PASS đúng, nhưng không nêu là điểm cần soi | THIẾU (nhẹ) | kế thừa |
| bắt được thứ đã sai từ gate trước | — | không bắt: trial, gating đăng nhập, `empty` vs `not-found`, vùng nav | THIẾU | gốc |

**Điểm: 9 TRÚNG · 2 LỆCH · 4 THIẾU trên 14 = 9/14** (bằng chứng yếu hơn hai trang kia một bậc, nhưng không có lời khai nào bị thổi phồng).

Đáng ghi: trang này không chạy một lệnh nào mà vẫn tìm ra **đúng cùng hai lớp lỗi** với hai trang có chạy ESLint thật. Nghĩa là hai lớp lỗi đó là lỗi HỆ THỐNG của gate patterns, không phải tai nạn của một trang.

## GATE THIẾU GÌ

- **`export const meta` và `require-export-jsdoc` phải được canon hoà giải một lần.** Ba trang, ba lần đỏ, ba lần được mô tả bằng cùng một câu. Đây là lỗi số một của cả bài chạy.
- **`isInlineObjectType` đi xuyên `TSIntersectionType` nhưng KHÔNG soi thân của một type alias.** Hệ quả đo được: đặt tên cho làn `on` làm rule xanh, và đồng thời xoá mất cái đỏ duy nhất từng chỉ ra rằng khối đang nhận một làn thứ ba mà `BlockProps` không có. Canon phải chọn: hoặc `BlockProps` có làn `on`, hoặc một rule đọc thân alias.
- **Không rule nào đòi một tài liệu PHẢI có một `main`.** Hai rule landmark chỉ đòi đúng chỗ khi đã có một cái. Kế hoạch này không mở `main` ở đâu cả và cả hai rule vẫn xanh.
- **`TOKEN_CLASS_FAMILIES` chỉ kiểm `max-w-app-*`, `max-h-*`, `min-h-*`.** `top-course-rail` hứa hẹn một biến `--spacing-course-rail` mà không rule nào kiểm biến đó có tồn tại — đúng hạng lỗi mà rule token sinh ra để bắt.
- **Bảng contract phải thụt vào ĐÚNG bốn khoảng trắng và khoá không được chứa chữ số**, nếu không `readContracts` trả null và ba rule đọc bảng tắt trong im lặng. Một ràng buộc hình thức không cổng nào báo khi bị vi phạm.

## GATE IM LẶNG Ở ĐÂU

`uncertain`, nguyên văn:

1. "`markup`, `contractEntries`, `decisions` và `owed` của gate patterns được mang qua bằng `$note` thay vì chép nguyên văn, theo đúng tiền lệ mà chính đầu vào lượt này đặt ra cho markup… Nếu người chấm cần `output.source` tự đứng hoàn toàn thì phần thiếu là bản sao chữ, không phải bản đánh giá."
2. "Lược đồ `AuditResult` chỉ cho pass hoặc fail, không có ô cho chưa chạy. Tôi chọn fail cho effective-config vì audit chưa được đo mà adoption chưa chứng minh thì theo chính `lint-adoption.mjs` không được coi là adoption."
3. "Gate không nói leaf `DisclosureQuestion` phải bọc primitive nào của HeroUI: kế hoạch viết `Disclosure.Trigger`, còn tôi không kiểm được HeroUI có xuất một `Disclosure` hay không."
4. "Gate không nói `SurfaceListCard` có nhận một làn props runtime bên cạnh cặp contract cộng render hay không… Tôi tạm coi đây là lane hợp lệ."
5. "Gate không nói khối được nhận làn hành động bằng cách nào: `BlockProps` chỉ có state và props, mà chín khối vẫn cần handler… đó là một chỗ luật im, không phải một chỗ luật cho phép."
6. "Số dòng trong `at` là vị trí dự kiến theo thứ tự khai báo của mã gate patterns, không phải dòng đo được: các file chưa tồn tại và lượt này bị cấm đọc repo đích."
