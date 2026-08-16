---
id: fe-principles-proof-course-details
title: course-details
slug: /gates/principles/proofs/course-details
sidebar_label: course-details
description: Chấm gate principles trên trang chi tiết khóa học — 28 entry, cơ chế cột dính và viewport cuộn trúng, nhưng bốn host ngữ nghĩa và một token offset không khớp bảng thật.
---

# course-details · gate principles

> Ngày: 2026-08-16 · Chuỗi: layouts → blocks → principles → patterns → lints

## IN

Đầu ra gate blocks. Không có nguyên văn. Đọc lại được: chín khối, một leaf mới, một hook, bốn state màn hình.

## EXPECTED OUT

Hơn 20 entry. Những entry quyết định:

```
course-detail-page          host —      flex min-w-0 flex-col gap-4
                            { navigation: course-section-navigation, body: main-then-rail,
                              action: course-mobile-action-bar (optional) }
course-section-navigation   host nav    sticky top-16 z-50 -mt-px flex w-full border-b
                                        border-separator bg-background px-6
main-then-rail              host —      mx-auto w-full max-w-6xl px-6 pb-6 flex flex-col gap-6
                                        md:gap-8 md:flex-row md:items-start
                                        md:[&>*:first-child]:min-w-0 md:[&>*:first-child]:grow
                                        md:[&>*:last-child]:w-80 md:[&>*:last-child]:shrink-0
                                        md:[&>*:last-child]:sticky
                                        md:[&>*:last-child]:top-course-rail
                                        md:[&>*:last-child]:self-start
course-mobile-action-bar    host —      sticky bottom-0 z-40 … border-t bg-background md:hidden
course-hero                 host section
course-signal-board         host —      grid grid-cols-2 [&>*:nth-child(odd)]:border-r
                                        [&>*:nth-child(-n+4)]:border-b   (chuẩn cho ĐÚNG 6 ô)
course-prerequisite-list    host ol     — cố ý KHÔNG dùng marked-row-list
course-module-list          host ol     course-module-row host li
course-faq-list             host ul     course-faq-row host li
course-section              host section (bọc CourseReviewBlock vì nó không là SurfaceListCard)
course-review-row           host section
course-pricing-rail         host aside  relative … [&>[data-component=Badge]:first-child]:absolute
pricing-rail-scroll-viewport            min-h-0 overflow-y-auto overscroll-contain scrollbar
course-price-block · course-price-primary-group · price-discount-line (KHOÁ SẴN) ·
price-note-row · course-pricing-purchase-intent · course-pricing-purchase-copy ·
course-pricing-purchase-actions · course-pricing-exploration-intent
```

Luật hình dạng: `top-course-rail` là token RIÊNG của trang, khai trong union bên cạnh `top-rail`. Không dòng nào trong `component.tsx` chọn thẻ; mọi node là một key và entry sau nó đặt tag.

## ACTUAL OUT

28 entry. Chuỗi mù mang qua bằng tham chiếu; đọc lại được qua báo cáo của gate lints:

```
reading-column-rail-and-fixed-commit-bar   (root)
scroll-body-over-pinned-actions            (viewport cuộn của rail, dùng max-h-rail)
fixed-commit-bar                           (dải ghim đáy)
figure-over-unit-label                     (ô chỉ số; why 33 từ — ngắn nhất trong 28)
price-lines-over-saving-note               (why 33 từ)
+ 23 entry khác
Host được xác nhận: ol (prerequisite), ol/li (module), ul (faq)  → "không file nào mở
  một trong bảy hộp trung tính hay bốn phần tử ngữ nghĩa"
globals.css thêm --max-height-rail cho max-h-rail
why: 28/28 dài 33–49 từ, không câu nào ghép lại từ chính từ trong khoá
Không entry nào khai host `main`
```

## CHẤM

| Mục | Expected | Actual | Kết | Gốc / kế thừa |
|---|---|---|---|---|
| root có ba vùng | navigation + body + action | root chỉ có cột đọc + rail + commit bar | LỆCH | kế thừa (layouts) |
| entry cho vùng điều hướng phần | `course-section-navigation` host `nav` sticky | không tồn tại | THIẾU | kế thừa |
| cột cam kết ở mép sau, sticky từ `md` | `md:[&>*:last-child]:w-80 … sticky … self-start` | có cột dính, bề rộng/breakpoint không đọc được | TRÚNG (một phần) | gốc |
| viewport cuộn riêng trong rail | `pricing-rail-scroll-viewport` `min-h-0 overflow-y-auto overscroll-contain` | `scroll-body-over-pinned-actions` + `max-h-rail` | TRÚNG (lệch tên) | gốc |
| dải ghim đáy `md:hidden` | `course-mobile-action-bar` | `fixed-commit-bar` | TRÚNG (lệch tên) | gốc |
| ribbon 6 ô, lưới 2 cột với viền trong chuẩn cho đúng 6 | `course-signal-board` | `figure-over-unit-label` mô tả MỘT ô, không thấy entry lưới | không đo được | — |
| điều kiện là dãy CÓ THỨ TỰ | host `ol`, cố ý không dùng `marked-row-list` | host `ol`, ghi rõ giữ cả lúc nghỉ | TRÚNG | gốc |
| chương trình là dãy có thứ tự | host `ol` + hàng `li` | host `ol` + `li` | TRÚNG | gốc |
| hỏi đáp là dãy không thứ tự | host `ul` + `li` | host `ul` | TRÚNG | gốc |
| khối đánh giá cần một `section` bọc | `course-section` host `section` | không đọc được | không đo được | — |
| cột cam kết host `aside` | có | không đọc được | không đo được | — |
| token offset của rail | `top-course-rail`, khai trong union | `max-h-rail` + `--max-height-rail`; không thấy `top-*` | LỆCH | gốc |
| biến CSS được khai cùng lúc với class dùng nó | có | có — `globals.css` nằm trong danh sách file | TRÚNG | gốc |
| `price-discount-line` là khoá KHOÁ SẴN dùng chung | có | `price-lines-over-saving-note` là entry MỚI | LỆCH | gốc |
| không entry nào khai host `main` | có | có | TRÚNG | gốc |
| why là lý do, đủ dài | có | 28/28, 33–49 từ | TRÚNG | gốc |
| không class tương tác/sơn/nổi trong entry | có | không có | TRÚNG | gốc |
| không hai entry trùng chữ ký | có | không có trong 28 | TRÚNG | gốc |
| entry cho ý định học thử | `course-pricing-exploration-intent` | không tồn tại | THIẾU | kế thừa (blocks bỏ trial) |

**Điểm: 11 TRÚNG (kể 1 phần) · 3 LỆCH · 2 THIẾU · 4 không đo được trên 19 = 11/16 mục đo được.**

Trang này là điểm sáng của gate principles: bốn host ngữ nghĩa (`ol`, `ol/li`, `ul`, viewport cuộn) trúng, và lý do trúng là nghiệp vụ nói ra thứ tự bằng chữ ("điều kiện nên có trước khi bắt đầu (theo thứ tự)").

## GATE THIẾU GÌ

- **Một khoá đã tồn tại và bị khoá lại vì dùng chung nhiều trang thì không được đẻ bản sao mang tên khác.** `price-discount-line` bị khoá và dùng ở catalog, recommended-course, rail và dải đáy; kế hoạch đẻ `price-lines-over-saving-note`. Không có bảng khoá làm đầu vào thì gate không có cách nào biết.
- **Token offset của một vùng dính là một quyết định phải nêu tên, và tên đó thuộc union.** Kế hoạch khai `--max-height-rail` cho chiều cao nhưng không khai gì cho vị trí dính; bảng thật có `top-course-rail` riêng bên cạnh `top-rail` vì hai trang dính ở hai mốc khác nhau.
- **Một lưới có số ô CỐ ĐỊNH thì các selector viền trong phải được viết theo đúng số ô đó, và số ô đó phải nằm trong why.** `[&>*:nth-child(-n+4)]:border-b` chỉ đúng cho đúng 6 ô 2 cột; thêm hay bớt một ô là hỏng lưới mà không rule nào báo.

## GATE IM LẶNG Ở ĐÂU

Từ `owed` của gate lints trang này:

> "Bảng hợp đồng phải được viết với entry thụt vào ĐÚNG bốn khoảng trắng và khoá không chứa chữ số, nếu không bộ đọc khoá trả về rỗng và ba rule đọc bảng tắt đi trong im lặng."

Một ràng buộc hình thức của gate principles mà chính gate principles không được cho biết, và khi bị vi phạm thì lint xanh trong khi ba rule bảng đã tắt.

> "Mảng `classNames` thật của `price-discount-line` vẫn chưa xác minh được, và biến `--spacing-course-rail` được cho là đã tồn tại mà chưa ai đọc lại."

## Lượt 2 — 2026-08-17

### IN (lượt 2)

Không có. Phần tử thứ ba của chuỗi mù là `null`.

### ACTUAL OUT (lượt 2)

**Không có đầu ra.** Không có `uncertain`, không có `owed`, không có một dòng lý do.

### CHẤM (lượt 2)

| Mục | Expected | L1 | L2 | Kết L2 |
|---|---|---|---|---|
| toàn bộ bảng của lượt một | fixture đóng băng, không sửa | xem điểm lượt một ở trên | không có đầu ra | **THIẾU toàn bộ, 0%** |

Ba trang chạy độc lập; trang này không chạy. Điểm không phải là một số kém, nó là một **ô trống**, và
hai thứ đó phải đọc khác nhau: một gate trả lời sai thì có thứ để sửa; một gate không trả lời thì
người chấm không phân biệt được bước đầu gãy, bước cuối gãy, hay orchestrator rơi mất phần tử.

### GATE THIẾU GÌ (lượt 2)

- **Một bước không chạy được phải trả về đối tượng nói nó không chạy được, không bao giờ trả về
  `null`.** Lượt hai đã vá `RuleResult.result` và `AuditResult.result` để có `chua-do-duoc`, tức canon
  đã chấp nhận nguyên tắc "không đo được là một kết quả" ở mức RULE. Nguyên tắc đó chưa được nâng lên
  mức BƯỚC, và trang này là cái giá của việc chưa nâng.
- **Chuỗi phải ghi rõ bước nào gãy và vì sao.** Không có trường đó thì một trang mất trắng năm ô điểm
  và không ai biết sửa gate nào.

### GATE IM LẶNG Ở ĐÂU (lượt 2)

Không có `uncertain` nào. Một bước chạy được để lại bảy câu hỏi; một bước gãy để lại không câu nào.
Sự im lặng của lỗi tốn kém hơn sự im lặng của nghi ngờ.
