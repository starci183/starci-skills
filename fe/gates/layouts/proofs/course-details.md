---
id: fe-layouts-proof-course-details
title: course-details
slug: /gates/layouts/proofs/course-details
sidebar_label: course-details
description: Chấm gate layouts trên trang chi tiết khóa học — ba vùng chính trúng gần hết, vùng điều hướng phần và tập trạng thái không-tồn-tại thì mất.
---

# course-details · gate layouts

> Ngày: 2026-08-16 · Chuỗi: layouts → blocks → principles → patterns → lints

## IN

```
Người dùng là học viên đã chọn xong một khóa học cụ thể và đang cân nhắc có bỏ tiền ra hay
không; họ có thể chưa đăng nhập, đã đăng nhập nhưng chưa mua, hoặc đã sở hữu khóa. Họ cần đủ
bằng chứng để quyết định: tên và một câu mô tả khóa, số học viên đã tham gia, số chương, số bài,
tổng số giờ đọc, số bài luyện tập, điểm đánh giá trung bình cùng nhận xét của người học trước,
những gì khóa cam kết mang lại, điều kiện nên có trước khi bắt đầu (theo thứ tự), toàn bộ chương
trình học kèm vài bài cho xem thử, và các câu hỏi thường gặp. Song song với việc đọc, họ phải
luôn thấy được ảnh khóa, giá phải trả, giá gốc và mức giảm nếu đang khuyến mãi, số tiền tiết
kiệm, đợt bán đang mở cùng số suất còn lại, giá của các đợt sau nếu chờ, và một lối để xem giải
thích cách tính giá. Từ trang này họ chỉ được làm một việc dứt khoát là mua khóa — hoặc vào học
tiếp nếu đã sở hữu — bên cạnh đó có thể học thử phần xem trước hoặc để dành vào giỏ hàng; chưa
đăng nhập thì phải đăng nhập trước khi làm bất cứ việc nào trong ba việc đó, và khóa miễn phí
hay khóa đã sở hữu thì không còn chuyện thêm vào giỏ. Giá riêng theo ưu đãi của từng người do
máy chủ tính và về chậm hơn phần còn lại nên tuyệt đối không được hiện một con số tạm rồi đổi;
khóa không tồn tại phải nói thẳng là không có và không mời thử lại, còn tải hỏng thì phải cho
thử lại.
```

## EXPECTED OUT

| Mục | Kỳ vọng | Neo |
|---|---|---|
| archetype | `decide-and-detail`, DECIDE-1..5 | `.claude/fe/layers/decide-and-detail/INDEX.md` |
| root | `course-detail-page`, `flex min-w-0 flex-col gap-4` | `contracts/index.ts` |
| vùng 1 navigation | `course-section-navigation`, host `nav`, `sticky top-16 z-50 -mt-px … border-b` — BẮT BUỘC | như trên |
| vùng 2 body | `main-then-rail` — main co giãn, rail `md:w-80 md:sticky md:top-course-rail` ở MÉP SAU | như trên |
| vùng 3 action | `course-mobile-action-bar`, `sticky bottom-0 md:hidden` — optional, chỉ khi có rail | như trên |
| measure | `mx-auto w-full max-w-6xl px-6 pb-6` nằm trên `main-then-rail`, KHÔNG trên root | như trên |
| DECIDE-5 | `md:hidden` và `md:sticky` là hai nửa bù nhau — không bề rộng nào hiện cả hai | `CourseMobileEnrollBar` |
| 4 state | pending · ready · **not-found** · failed | `CourseDetailPage/index.tsx` |
| not-found ≠ failed | not-found short-circuit, KHÔNG dựng page, KHÔNG có nút thử lại; failed CÓ retry | như trên |
| railState riêng | ready · price-pending · adding · trialing · checking-out — độc lập với state màn hình | `CoursePricingRail` |
| giá riêng | khi `price-pending`: giá nghỉ, còn original/discount/note BỎ HẲN | như trên |
| overlay | `CoursePriceOverlay` là anh em của page, ngoài cây contract | `index.tsx` |
| landmark | `routed-page-main` host `main` mở ở `courses/layout.tsx` | như trên |

## ACTUAL OUT

Một phương án đi qua; ba phương án còn lại không có trong chuỗi mù. Tái dựng từ gate lints:

```
reading-column-rail-and-fixed-commit-bar          (root, 28 entry tổng)
  cột đọc  -> CourseIdentityHeader, CourseTrustStatRow, CourseValuePropList,
              CoursePrerequisiteList, CourseCurriculumOutline, CourseReviewList, CourseFaqList
  rail     -> ScrollViewport boundary="pricing-rail"
              contract scroll-body-over-pinned-actions -> CoursePricingRail
  commit   -> fixed-commit-bar -> CourseMobileEnrollBar
state = "pending" | "ready" | "empty" | "failed"
globals.css: --max-height-rail (cho max-h-rail)
```

## CHẤM

| Mục | Expected | Actual | Kết | Gốc / kế thừa |
|---|---|---|---|---|
| archetype decide-and-detail | có | cột đọc + rail cam kết + dải đáy | TRÚNG | gốc |
| rail ở mép sau | rail sau main | rail sau cột đọc | TRÚNG | gốc |
| rail sticky, có viewport cuộn riêng | `pricing-rail-scroll-viewport` | `scroll-body-over-pinned-actions` + `max-h-rail` | TRÚNG | gốc |
| DECIDE-5 hai nửa bù nhau | `md:hidden` ↔ `md:sticky` | `fixed-commit-bar` là bản riêng, dùng chung handler | TRÚNG | gốc |
| dải đáy là contract RIÊNG mang tập con | có | có, ba trường amount/original/commit | TRÚNG | gốc |
| vùng navigation theo phần | `course-section-navigation` host `nav` sticky, 4 tab | không tồn tại | THIẾU | gốc |
| root có ba vùng | navigation + body + action | hai vùng | LỆCH | gốc |
| measure nằm trên body chứ không trên root | có | không đọc được | không đo được | — |
| 4 state | pending/ready/**not-found**/failed | pending/ready/**empty**/failed | LỆCH | gốc |
| not-found không mời thử lại | có | không phân biệt được `empty` với `not-found` | LỆCH | gốc |
| railState riêng 5 mức | có | rail chỉ `pending`/`ready` | LỆCH | gốc |
| price-pending không hiện số tạm | có | có — nói thẳng trong twin | TRÚNG | gốc |
| lối xem cách tính giá | `priceDetailLabel` + overlay | `whyThisPriceLabel` + `onOpenPriceDetail` | TRÚNG | gốc |
| overlay là anh em ngoài cây | có | `setPricedCourseId` tồn tại, vị trí không đọc được | không đo được | — |
| trail breadcrumb | có | không tồn tại | THIẾU | gốc |
| landmark ở layout | có | khai `route-file`, không có layout trong danh sách | LỆCH | gốc |

**Điểm best-of-set: không đo được.** **Điểm recommended: 7/14 mục đo được** (7 TRÚNG, 5 LỆCH, 2 THIẾU).

Đây là trang layouts làm tốt nhất: cơ chế cột-cam-kết-dải-đáy trúng gần như trọn vẹn, kể cả điều khó nhất — hai nửa bù nhau của một breakpoint và luật không-hiện-số-tạm.

## GATE THIẾU GÌ

- **`empty` và `not-found` là hai state khác nhau và phải được đặt tên khác nhau.** Câu nghiệp vụ tách hẳn: "khóa không tồn tại phải nói thẳng là không có và không mời thử lại, còn tải hỏng thì phải cho thử lại". Gộp chúng thành `empty` là xóa mất chính cái phân biệt mà nghiệp vụ vừa nói ra.
- **Một cụm cam kết có nhịp riêng thì có thang state riêng, và thang đó phải được liệt kê tại gate layouts.** Giá riêng về chậm hơn phần còn lại là một câu nghiệp vụ; nó đẻ ra `price-pending` và bốn mức hành động, chứ không đẻ ra một cờ `isLoading` cho cả trang.
- **Nếu cột đọc dài hơn một màn thì phải quyết định có vùng điều hướng theo phần hay không, và quyết định đó thuộc gate layouts.** Gate đã dựng bảy phần xếp dọc mà không hỏi ai một câu nào về việc đi lại giữa chúng.

## GATE IM LẶNG Ở ĐÂU

Từ `uncertain` của gate lints trang này:

> "Gate không nói SurfaceListCard có nhận một làn props runtime bên cạnh cặp contract cộng render hay không… Tôi tạm coi đây là lane hợp lệ."

> "Gate không nói khối được nhận làn hành động bằng cách nào: BlockProps chỉ có state và props, mà chín khối vẫn cần handler… đó là một chỗ luật im, không phải một chỗ luật cho phép."

Cả hai câu là hệ quả của một quyết định layouts không ai ghi: trang này có bao nhiêu chủ hành động, và hành động đi xuống bằng đường nào.

## Lượt 2 — 2026-08-17

### IN (lượt 2)

Không đổi một chữ so với lượt một.

### ACTUAL OUT (lượt 2)

**`null`.**

Phần tử thứ ba của chuỗi mù là giá trị rỗng. Không có đầu ra gate layouts, không có đầu ra của bốn
gate sau, không có `uncertain`, không có một dòng lý do. Chuỗi năm bước cho trang này không trả về
gì cả.

### CHẤM (lượt 2)

| Mục | Expected | L1 | L2 | Kết L2 | Δ |
|---|---|---|---|---|---|
| cả 14 mục của bảng lượt một | — | 7/14 = 50% | không có đầu ra | **THIẾU toàn bộ** | −50 |

**Điểm best-of-set: không đo được** (không có phương án nào).
**Điểm recommended: 0/14 = 0%.** **Δ: −50 điểm phần trăm.**

Đây không phải một điểm kém, đây là một **ô trống**, và hai thứ đó phải được đọc khác nhau. Một
gate trả lời sai thì có thứ để sửa; một gate không trả lời thì không có gì để đọc, và người chấm
không phân biệt được ba khả năng: bước đầu tiên gãy, bước cuối gãy, hay orchestrator rơi mất phần
tử trên đường về.

### GATE THIẾU GÌ (lượt 2)

- **Một bước không chạy được phải trả về một đối tượng nói nó không chạy được, không bao giờ trả về
  `null`.** Đây là câu luật đắt nhất mà lượt hai dạy ra: lược đồ đã được vá để `RuleResult` và
  `AuditResult` có ô `chua-do-duoc`, tức là canon đã thừa nhận nguyên tắc "không đo được là một kết
  quả" ở mức RULE — nhưng chưa thừa nhận nó ở mức BƯỚC. Một phần tử `null` trong chuỗi là đúng thứ
  ô `chua-do-duoc` sinh ra để xoá bỏ, ở một tầng cao hơn một bậc.
- **Chuỗi phải ghi bước nào là bước gãy.** Không có trường đó thì một trang mất trắng năm điểm và
  không ai biết sửa gate nào.
- **Trang này là trang duy nhất có `anchor_drift` được ghi sẵn trong fixture** — bảng Anchor của
  `decide-and-detail/INDEX.md` còn trỏ vào sáu tên component không còn tồn tại. Lượt một đã nêu; lượt
  hai không có cơ hội chạm tới. Món nợ vẫn nguyên.

### GATE IM LẶNG Ở ĐÂU (lượt 2)

Không có `uncertain` nào. Đó chính là điều tệ nhất: một bước gãy im lặng không để lại một câu hỏi
nào, trong khi một bước chạy được để lại bảy. Sự im lặng của lỗi tốn kém hơn sự im lặng của nghi ngờ.
