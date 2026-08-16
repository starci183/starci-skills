---
id: fe-principles-proofs-index
title: Bằng chứng gate principles
slug: /gates/principles/proofs
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

## Lượt 2 — 2026-08-17

### Bảng điểm

| Trang | Lượt 1 | Lượt 2 | Delta | Mẫu số đo được |
|---|---|---|---|---|
| [dashboard](./dashboard.md) | 9.5/28 · **34%** | 15.5/28 · **55%** | **+21** | 28 → 28 |
| [courses](./courses.md) | 5.5/8 · **69% (ảo)** | 7.5/12 · **63%** | **−6** | 8 → 12 |
| [course-details](./course-details.md) | 11/16 · **69% (ảo)** | `null` · **0%** | **−69** | 16 → 0 |
| **Trung bình hai trang chạy được** | **51.5%** | **59%** | **+7.5** | |
| **Trung bình ba trang** | **57.3%** | **39.3%** | **−18** | |

Hai con số 69% của lượt một là con số ảo và bản ghi lượt một đã nói thẳng: chúng được tính trên mẫu
số đã co lại vì chuỗi mù mang entry qua bằng tham chiếu. Lượt hai mở được bốn mục của trang courses
và **cả bốn đều TRÚNG** — tử số 5.5 lên 7.5 trong khi mẫu số 8 lên 12.

### Phép thử 291 tên khoá — giả thuyết ĐÚNG

Đây là ô vá được thiết kế để trả lời đúng một câu hỏi: *gate principles đặt tên sai vì nó không biết
bảng thật đang có gì?*

| Trục | Lượt 1 | Lượt 2 |
|---|---|---|
| dashboard — tên khoá trùng bảng thật | **5/26 · 19%** | **11/26 · 42%** |
| dashboard — chuỗi lớp trùng từng ký tự | **1/26 · 4%** | **5/26 · 19%** |
| dashboard — khoá bịa ra | 21 | 5 |
| dashboard — tái dùng khoá mà không khai lại | 3 (tình cờ biết tên) | 9 (có chủ ý, có comment) |
| courses — tên khoá trùng bảng thật | 1/2 entry đọc được | **18/21 · 86%** |
| chất lượng entry (why là lý do · không class cấm · không trùng chữ ký · có gộp) | 4/4 | 4/4 |

Lượt một viết `dashboard-mode-main`, `tracked-figure-rows`, `label-with-end-figure`,
`heading-over-body` — bốn tên không có trong bảng, cho bốn thứ bảng đã có. Lượt hai viết đúng
`dashboard-rail-then-main`, `dashboard-rail`, `profile-over-stat-rows`, `stacked-stat-rows`,
`label-row-over-card`, và tái dùng `nav-over-body-page`, `routed-page-main`, `marked-row-list`,
`empty-notice-card`, `title-with-end-action`, `centred-empty-notice` mà không đẻ bản sao nào. Trang
courses trúng mười lăm khoá catalog liền một mạch.

**Ba thứ 291 tên KHÔNG chữa được, và cả ba đều đo được:**

1. **Đúng tên, sai hình dạng con.** `dashboard-rail` đúng tên và đúng chuỗi lớp, nhưng khai một con
   `identity` không lặp thay vì `section repeats restingCount 2` — QuickActions biến mất ở đúng đó.
2. **Đúng tên, dùng sai chỗ.** `empty-notice-card` được tham chiếu đúng rồi nhồi vào `SurfaceListCard`,
   mà nó không phải một joined list. Lỗi biên dịch, không rule nào bắt.
3. **Đúng tên, sai chuỗi lớp ở entry gốc.** Khoá duy nhất của trang courses đọc được chuỗi lớp thì
   sai, và sai đúng kiểu dashboard sai ở lượt một: measure biến mất.

Kết luận cho lượt ba: **từ vựng chữa lỗi ĐẶT TÊN, không chữa lỗi GRAMMAR và không chữa lỗi ĐỘ PHỦ.**

### Gate còn thiếu luật gì

| # | Câu luật lẽ ra đã ngăn được | Trang | Trạng thái |
|---|---|---|---|
| 1 | **Cấp tên khoá chưa đủ — phải cấp cả `children`, `restingCount` và `host` của khoá được tái dùng.** | 2/3 | **mới ở lượt 2**, thay thế câu số 1 của lượt 1 (đã vá, đo được) |
| 2 | **`restingCount` của slot lặp phải khớp cardinality nghiệp vụ.** | 2/3 | chưa vá — main khai 3 cho một mặt 8 section |
| 3 | **Entry gốc phải khai measure.** | 2/3 | dashboard đã vá, courses vẫn hỏng |
| 4 | **Một khoá được tham chiếu phải được kiểm là có tồn tại, bằng CÙNG phép kiểm mà rule khoá-chết dùng.** | 1/3 | **mới ở lượt 2** — hai tên bịa đi qua trong im lặng |
| 5 | **Mỗi thành viên mới của union class phải có lý do riêng; khai lại một thành viên đã có làm diff nói dối.** | 1/3 | tụt — lượt 1 đạt với 3 thành viên, lượt 2 thêm 6 và biện minh 1 |
| 6 | **Chuỗi lớp của một danh sách nối là một bộ đóng.** | 1/3 | không còn đo được ở lượt 2 (khoá được tái dùng thay vì viết lại) |
| 7 | **`contract.mjs` nhận `classes` và `classNames`; kiểu đóng chỉ nhận `classNames`; `tokens.mjs` chỉ đọc `classes`.** | 2/3 | chưa vá, và lượt 2 chứng minh nó nặng hơn tưởng: bảng không biên dịch mà lint vẫn xanh |
| 8 | (Đã hết) Trước khi đặt khoá mới phải nhận bảng khoá hiện có | — | **VÁ XONG, đo được: 19% → 42%** |

### Gate im lặng ở đâu

> "`no-unknown-contract-key` chỉ đọc thuộc tính `contract` tĩnh trên phần tử đúng tên `Tree`… năm cái
> tên đi qua `SurfaceListCard`, `SurfaceCard`, `defineContractComponent` và `restingSlotCount`, tức
> bốn trong năm hình dạng mà `no-dead-contract-key` lại TÍNH LÀ tham chiếu — **hai rule bất đồng về
> thế nào là gọi tên một khoá**."

Phát hiện canon mới của lượt hai, và nó thuộc về gate principles: nếu hai rule không đồng ý "gọi tên
một khoá" nghĩa là gì, thì một khoá bịa ra có thể vừa không-lạ vừa không-chết.

Câu im lặng cũ vẫn nguyên: **lược đồ gate principles không diễn đạt được ba trong bốn hình dạng slot
mà bảng thật đang dùng** — slot `$content`, slot nhận MỘT TRONG nhiều khoá, slot do một composite lấp.
Union ba-khoá của slot `main` rơi ở cả hai lượt, ở đúng chỗ đó.
