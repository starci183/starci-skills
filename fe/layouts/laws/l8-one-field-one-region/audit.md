---
id: fe-layouts-laws-l8-one-field-one-region-audit
title: audit.md
slug: /fe/layouts/laws/l8-one-field-one-region/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật L8: chỗ nó phân định được, chỗ repo sống đang tuân, và ba khoản nợ đo được ngay trên ví dụ mạnh nhất của nó.
---

# audit.md

> Phiên bản: `1.00` · Mô-đun: `l8-one-field-one-region`

Phản biện này kiểm xem luật có chọn được đúng một mã từ **quan hệ đã nêu**, và chỉ từ đó.

## Kết luận

Chấp nhận, với ba khoản nợ đã đo được, trong đó khoản thứ hai nằm ngay trên trường hợp mà luật dùng
làm ví dụ sạch nhất của mình.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `L8-1` so với `L8-4` | Loại trừ được khi đã nêu các dữ kiện có so sánh được với nhau hay không |
| `L8-1` so với `L8-3` | Loại trừ được khi đã nêu hai vùng hỏi cùng một câu hay hai câu |
| `L8-5` so với mọi mã | Chạy trước, và loại trừ được bằng câu hỏi xoá vế sau thì vế trước còn hoàn chỉnh không |
| `L8-6` so với vi phạm | Loại trừ được bằng class loại trừ nằm trên chính vùng khai trùng |
| `L8-7` so với vi phạm | Loại trừ được khi hai vùng nêu được hai chủ thể hoặc hai câu hỏi khác nhau |
| Cùng leaf ở hai vùng | Không tự động là vi phạm; phải nêu `subject` trước |
| Thiếu bằng chứng về `coVisibility` | Rơi về `unknown`, và `unknown` không được đọc thành `always-together` |
| `L8` so với `B1` | Không chồng lấn. `L8` nói dữ kiện thuộc vùng nào, `B1` nói vùng đó vẽ mấy cái viền |
| `L8` so với `L10` | Không chồng lấn. `L10` nói chiều rộng một vùng do ai phát, không nói vùng chứa dữ kiện nào |
| `L8-5` so với `fe/principles` | **Chồng lấn thật.** Xem `Nhận định` |

## Repo sống đang ở đâu

**Đang tuân**, ở mọi chỗ đo được bằng registry contract. `snippet` khai đúng một lần, trong
`global-search-context-card` tại `contracts\index.ts:2881-2888`, còn vùng kết quả ở giữa tại
`:2866-2873` không có slot mô tả nào. Slot `trail` khai đúng một lần tại `:2248`. Rating của khoá
học đã rời khỏi khối tiêu đề và `why` tại `:2260` ghi lại lần chuyển đó.

Đo trường giá riêng: `price-discount-line` được năm vùng gọi, tại `:1444`, `:2203`, `:2451`, `:2502`
và `:2584`. Bốn vùng đầu thuộc bốn chủ thể khác nhau, nghĩa là bốn trường khác nhau và mỗi trường vẫn
một nhà. Chỉ cặp `:2451` với `:2584` là cùng một khoá học trên cùng một trang, và cặp đó là `L8-6`
hợp lệ vì `:2582` mang `md:hidden` ngay trên vùng hẹp.

Registry có hai thanh đáy `sticky bottom-0 md:hidden` nhưng chỉ một cái là bản khai trùng. Cái còn
lại tại `:322-328` chứa nav-link chứ không chứa trường nào của rail, và `why` của nó tự phân biệt hai
thứ.

## Nợ đã đo được

- **Chuyển nhà nửa vời.** `course-hero-heading` tại `:2255-2260` đã trả rating về dải sáu ô, nhưng
  vùng con của nó là `course-hero-title-stack` tại `:2262-2268` vẫn lấy rating làm lý do cho chiều
  rộng: *"so a long technical description wraps before it squeezes the rating"*. Không còn slot rating
  nào ở đó. Slot đã đi, lời giải thích thì chưa, nên `why` này là bản cũ và người đọc sau sẽ dựng lại
  sai bố cục từ nó.
- **Một trường có không vùng nào dưới `md`.** `global-search-context-card` tại `:2881-2888` mang
  `hidden ... md:flex` và là nhà duy nhất của `snippet`. Trên màn hẹp trường này không có vùng nào,
  còn luật nói đúng một và không có mã nào phát ra số không. `why` biện hộ bằng chữ *"redundant"*,
  nhưng nếu nó thừa trên điện thoại thì phải giải thích vì sao trên desktop nó không thừa, và lời giải
  thích đó chưa có. Đây là chỗ `L8-6` bị đọc nhầm thành giấy phép bỏ trường.
- **Ví dụ mạnh nhất của luật không kiểm được từ contract.** `course-signal-board` tại `:2270-2279`
  khai sáu ô bằng `repeats: true, restingCount: 6` chứ không đặt tên từng dữ kiện. Registry biết vùng
  có sáu ô nhưng không biết ô nào giữ rating, nên câu khẳng định ở `:2260` không kiểm được ở phía vùng
  nhận. Cùng lúc đó, điểm trung bình của cả tập người học vẫn hiện dưới dạng `rating-stars` trong
  `course-review-summary` tại `:2338-2345`, cùng trang, cùng lúc. Hai chỗ này là hai câu hỏi khác nhau
  hay là một trường ở hai nhà thì đọc contract không phân xử được.

## Nhận định

- Điểm chồng lấn thật với `fe/principles` nằm ở `L8-5`. Luật này quyết có mấy trường, và câu trả lời
  "một" kéo theo một hệ quả nhìn thấy được là cả cụm nằm trên một dòng. Bằng chứng sống lại là một
  chuỗi class, `flex-nowrap` cộng `whitespace-nowrap` tại `:2175-2181`. Ranh giới đúng là `L8` phát ra
  số slot còn `fe/principles` phát ra class, nhưng một người viết kế hoạch rất dễ chép luôn cả class
  vào `LayoutPlan` và tưởng mình đang thi hành `L8`.
- `L8-7` sinh ra từ một lần trò làm sai chứ không phải một lần thầy tự lật, và hai chuyện đó không
  cùng trọng lượng. Phán quyết tại
  `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:440` ghi rõ trò nhận sai vì đã
  loại breadcrumb khỏi concept, nên luật đứng trên một lần sửa lỗi chứ không trên hai phán quyết trái
  chiều. Nếu sau này thầy phán ngược, `L8-7` phải chuyển thành *criterion* giống `L5` và `L11`, và
  bản hiện tại không được đọc như đã lường trước chuyện đó.
- Điểm yếu còn lại giống hệt `B1`: "hai vùng hỏi hai câu khác nhau" vẫn là một phán đoán của người,
  không phải một phép đo. Gate chỉ bắt được phần hình thức, tức có nêu `subject` và `coVisibility` hay
  không. Chưa có cách nào chặn một câu hỏi bịa ra cho đủ thủ tục, và `Nợ` thứ ba ở trên là ví dụ cho
  thấy chuyện đó xảy ra ngay trong registry.
- Navbar chính lặp lại `Trang chủ / Khóa học / Liên hệ` phía trên tabs của trang chi tiết. Đây là vi
  phạm đã đo được nhưng nó thuộc `L3` chứ không thuộc `L8`, vì hai hàng đó cùng một vai trò và luật
  này không có gì để nói thêm.
- Chưa đo bằng ảnh chụp. Mọi câu về việc hai vùng có cùng hiện hay không, về `md:hidden` thật sự cắt ở
  đâu, và về `snippet` biến mất trên điện thoại trong tài liệu này suy từ contract và từ phán quyết
  cũ, không từ một lần render dưới cùng route, viewport, theme và persona.
