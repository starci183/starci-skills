---
id: fe-blocks-proof-course-details
title: course-details
slug: /gates/blocks/proofs/course-details
sidebar_label: course-details
description: Chấm gate blocks trên trang chi tiết khóa học — bộ khối trúng gần trọn vẹn về ngữ nghĩa, nhưng ba luật thương mại mà nghiệp vụ nói thẳng thì không khối nào nhận.
---

# course-details · gate blocks

> Ngày: 2026-08-16 · Chuỗi: layouts → blocks → principles → patterns → lints

## IN

Đầu ra gate layouts, không có nguyên văn. Phần đọc lại được: cột đọc + cột cam kết sticky + dải ghim đáy, bốn state màn hình. Cộng câu nghiệp vụ (`.claude/fe/gates/layouts/proofs/course-details.md` § IN).

## EXPECTED OUT

| Khối / vùng | Tên thật | Chi tiết đáng chấm | Neo |
|---|---|---|---|
| nhận diện | `course-hero-heading` do PAGE vẽ | title level 1 + tagline; rating ĐÃ chuyển sang ribbon | `contracts/index.ts` |
| ribbon bằng chứng | `course-signal-board` do PAGE vẽ | đúng **6** ô: learners, modules, hours, contents, challenges, rating; mọi ô là CHỮ, không ô nào badge | `CourseDetailPage/component.tsx` |
| lời hứa | `CourseValuePropositionList` | `marked-row-list`, resting 5, dùng chung với thẻ catalog | `blocks/courses/CourseValuePropositionList` |
| điều kiện | `CoursePrerequisiteList` | host `ol` (có thứ tự), state `required`\|`none`, mark là SỐ chứ không phải tick | `blocks/courses/CoursePrerequisiteList` |
| chương trình | `CourseModuleList` (định nghĩa cục bộ trong page) | host `ol`, mỗi hàng tự quyết disclosure; `levelLabel` là BADGE, `previewLabel` là chữ | `component.tsx` |
| đánh giá | `CourseReviewBlock` | bọc bằng `course-section` vì KHÔNG phải SurfaceListCard; state `rated`\|`unrated`; trung bình lấy từ projection chứ không tính từ nodes | `blocks/courses/CourseReviewBlock` |
| hỏi đáp | `CourseFaqList` (cục bộ) | tự thay một hàng rỗng khi faqs rỗng | `component.tsx` |
| cột cam kết | `CoursePricingRail` | 5 state; `selectedIntent` purchase\|**trial** là useState CỤC BỘ — thứ duy nhất block tự quyết | `blocks/courses/CoursePricingRail/component.tsx` |
| dải đáy | `CourseMobileEnrollBar` | 2 state; `price` là ĐÚNG chuỗi rail vẽ, truyền vào chứ không tự tính | `blocks/courses/CourseMobileEnrollBar` |

Luật thương mại giải ở nửa nối: `ctaLabel` = continue nếu đã ghi danh, ngược lại enrol (kể cả khách); `trialLabel` ẩn khi đã ghi danh; `cartLabel` ẩn khi đã ghi danh HOẶC `payable === 0`; `scarcityLabel` ẩn khi không có đợt mở.

## ACTUAL OUT

```
CourseIdentityHeader        (component.tsx + test)
CourseTrustStatRow          — sáu ô chỉ số, thuần chữ
CourseValuePropList         — danh sách lời hứa, slot optional (vắng thì trang bỏ khỏi cây)
CoursePrerequisiteList      — dãy CÓ THỨ TỰ (ol), giữ nguyên cả ở trạng thái nghỉ
CourseCurriculumOutline     — nhóm lồng + trạng thái rỗng thật
CourseReviewList            — có trạng thái rỗng nói thành lời
CourseFaqList               — mở gập là tiết lộ CỤC BỘ của hàng, là props chứ không phải state
CoursePricingRail           — MỘT khối một thang state, tự vẽ bề mặt bị chặn chiều cao
CourseMobileEnrollBar       — contract RIÊNG mang tập con ba trường, dùng chung handler với cột
Leaf mới: DisclosureQuestion (câu hỏi CHÍNH LÀ điều khiển; aria-expanded, min-h-11, focus ring)
Hook: use-query-course-detail-swr (key = [course-detail, slug, viewerKey], null khi chưa biết viewer)
Rail data: coverUrl, amount, originalAmount, discountLabel, savingsLabel, phaseLabel,
           remainingLabel, phases[], enrolledLabel, whyThisPriceLabel, commitLabel, cartLabel
Rail actions: onCommit, onAddToCart, onOpenPriceDetail
```

## CHẤM

| Mục | Expected | Actual | Kết | Gốc / kế thừa |
|---|---|---|---|---|
| khối nhận diện | `course-hero-heading` (page vẽ) | `CourseIdentityHeader` (khối riêng) | KHÁC MÀ ĐƯỢC | gốc |
| ribbon 6 ô | 6, thuần chữ | 6, thuần chữ | TRÚNG | gốc |
| lời hứa | `CourseValuePropositionList` | `CourseValuePropList` | TRÚNG (lệch tên) | gốc |
| điều kiện có thứ tự | host `ol` | host `ol`, giữ cả lúc nghỉ | TRÚNG | gốc |
| điều kiện: mark là số, không tick | có | không đọc được | không đo được | — |
| chương trình học | `ol`, hàng tự quyết disclosure | `CourseCurriculumOutline`, nhóm lồng | TRÚNG | gốc |
| bài cho xem thử | `previewLabel` chữ, `levelLabel` badge | không đọc được | không đo được | — |
| đánh giá | `CourseReviewBlock` + `course-section` | `CourseReviewList` | TRÚNG (lệch tên) | gốc |
| trung bình từ projection, không từ nodes | có | không đọc được | không đo được | — |
| hỏi đáp mở gập | disclosure cục bộ theo hàng | y hệt, cộng leaf sở hữu primitive | TRÚNG | gốc |
| cột cam kết là MỘT khối một thang state | có | có, nói thẳng | TRÚNG | gốc |
| ý định mua / **học thử** | `selectedIntent` purchase\|trial, useState cục bộ | KHÔNG có trial | THIẾU | gốc |
| dải đáy tập con + dùng chung handler | có | có, twin chứng minh chung handler | TRÚNG | gốc |
| giá riêng về chậm, không hiện số tạm | có | có, twin chứng minh | TRÚNG | gốc |
| `cartLabel` ẩn khi miễn phí hoặc đã sở hữu | có | `cartLabel` optional nhưng không có luật ẩn | THIẾU | gốc |
| `ctaLabel` đổi theo đã-sở-hữu | continue \| enrol | chỉ `commitLabel` | THIẾU | gốc |
| chưa đăng nhập phải đăng nhập trước | có | không tồn tại | THIẾU | gốc |
| `scarcityLabel` ẩn khi không có đợt mở | có | `remainingLabel` optional | TRÚNG (một phần) | gốc |
| bậc giá các đợt sau | `pricing-phase-disclosure` | `phases[]` | TRÚNG | gốc |
| khóa cache mang danh tính người xem | có | `[course-detail, slug, viewerKey]`, null khi chưa biết | TRÚNG | gốc |

**Điểm best-of-set: không đo được.** **Điểm recommended: 12/17 mục đo được** (11 TRÚNG + 1 KHÁC MÀ ĐƯỢC, 0 LỆCH, 4 THIẾU + 1 TRÚNG một phần).

Đây là trang mạnh nhất của gate blocks, và lý do đáng ghi: tên khối ở đây là tên do NGHIỆP VỤ đặt ("điều kiện nên có trước khi bắt đầu", "chương trình học", "câu hỏi thường gặp"), nên gate đoán trúng mà không cần đọc repo. Chỗ rơi đều là những chỗ nghiệp vụ nói bằng ĐIỀU KIỆN chứ không bằng danh từ.

## GATE THIẾU GÌ

- **Mọi mệnh đề điều kiện trong câu nghiệp vụ phải trở thành một dòng "trường này ẩn khi …" gắn vào đúng khối.** Ba mệnh đề bị bỏ nguyên: "khóa miễn phí hay khóa đã sở hữu thì không còn chuyện thêm vào giỏ", "vào học tiếp nếu đã sở hữu", "chưa đăng nhập thì phải đăng nhập trước". Cả ba đều là một câu, và cả ba đều mất.
- **Một danh sách hành động do nghiệp vụ liệt kê phải được đếm.** Nghiệp vụ nói ba việc: mua, học thử, để dành. Kế hoạch có hai. Không gate nào đếm lại.
- **Khi một trường là optional, gate phải nói ĐIỀU KIỆN vắng mặt chứ không chỉ đánh dấu dấu hỏi.** `cartLabel?` và `remainingLabel?` đúng hình dạng nhưng không mang luật nào, nên nửa nối sẽ tự bịa điều kiện lúc viết.

## GATE IM LẶNG Ở ĐÂU

Từ `uncertain` của gate lints trang này:

> "Gate không nói khối được nhận làn hành động bằng cách nào: BlockProps chỉ có state và props, mà chín khối vẫn cần handler. Tôi tạm giữ cách của gate patterns là intersection với một kiểu ĐƯỢC ĐẶT TÊN… nhưng đó là một chỗ luật im, không phải một chỗ luật cho phép."

Chín khối, chín lần phải tự chế cách nhận hành động. Đây là chỗ im lặng đắt nhất của cả ba trang: nó không sai ở đâu cả, nên không gate nào chặn, nhưng nó khiến hàng rào hai-slot của `BlockProps` mất hiệu lực trên toàn trang.

## Lượt 2 — 2026-08-17

### IN (lượt 2)

Không có. Phần tử thứ ba của chuỗi mù là `null`.

### ACTUAL OUT (lượt 2)

**Không có đầu ra.**

### CHẤM (lượt 2)

| Mục | Expected | L1 | L2 | Kết L2 | Δ |
|---|---|---|---|---|---|
| cả 17 mục của bảng lượt một | — | 12/17 = 71% | không có đầu ra | **THIẾU toàn bộ** | −71 |

**Điểm best-of-set: không đo được.** **Điểm recommended: 0/17 = 0%.** **Δ: −71 điểm phần trăm.**

Trang này là trang **mạnh nhất của gate blocks ở lượt một** — 11 TRÚNG, 1 KHÁC MÀ ĐƯỢC, 0 LỆCH.
Rail giá, thanh ghim đáy, năm section, `selectedIntent` là thứ duy nhất khối tự quyết: tất cả đều
trúng. Lượt hai mất trắng, và mất vì một lý do không liên quan gì đến chất lượng suy luận.

Đó là điều đáng ghi nhất: **ô điểm cao nhất của cả bảng là ô dễ mất nhất**, vì nó không được bảo vệ
bởi bất cứ thứ gì ngoài việc chuỗi chạy trọn.

### GATE THIẾU GÌ (lượt 2)

- **Một bước gãy phải trả về đối tượng "không chạy được", không phải `null`.** Xem cùng mục ở
  `layouts/proofs/course-details.md`; đây là một câu luật của chuỗi chứ không của riêng gate blocks.
- **Điểm của một trang phải mang theo bằng chứng của lượt trước khi lượt này không có bằng chứng.**
  Nếu không, một trang từng đạt 71% và một trang chưa bao giờ được chạy trông y hệt nhau trong bảng.

### GATE IM LẶNG Ở ĐÂU (lượt 2)

Không có `uncertain`. Không có câu hỏi nào được nêu, vì không có ai chạy để mà nghi ngờ.
