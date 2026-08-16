---
id: fe-layouts-laws-l9-sticky-offset-is-page-local-vi
title: vi.md
slug: /fe/layouts/laws/l9-sticky-offset-is-page-local/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng mã L9-N nhận diện bằng chrome của trang đang đứng, và vì sao một con số offset dùng chung là một lời khẳng định sai về trang thứ hai.
---

# vi.md

> Phiên bản: `1.00` · Mô-đun: `l9-sticky-offset-is-page-local` · Luật: [`INDEX.md`](./INDEX.md)

# Ghim ở đâu là chuyện của trang, không phải chuyện của sản phẩm

Một con số offset trông như một lựa chọn khoảng cách, nhưng nó không phải. Nó là một câu khẳng định:
*phần chrome đứng trên vùng này cao đúng chừng đó*. Câu đó đúng hay sai tuỳ vào trang, vì trang chi
tiết khoá học xếp hai hàng navbar dính nhau còn trang học chỉ có một hàng. Lấy con số của trang một
hàng đem sang trang hai hàng thì cái rail chui tọt lên dưới hàng thứ hai, và thứ đầu tiên mất đi
chính là cái giá mà rail sinh ra để nói.

Đây là luật dễ viết đúng nhất trong kệ và cũng dễ hỏng nhất khi copy. Cả hai token đều đang sống
trong `globals.css` cạnh nhau, chỉ cách bốn dòng, nên chọn nhầm không phải vì thiếu thông tin mà vì
người viết nhìn thấy `top-rail` trước và thấy nó chạy được.

Nửa thứ hai của luật là cái hay bị bỏ. Ghim và trần chiều cao là một quyết định chứ không phải hai.
Bình luận trong `globals.css:50-54` nói thẳng cơ chế: đổi ghim mà không đổi trần thì cái rail hoặc
bị cắt mất đầu, hoặc dài quá màn hình và hành động cuối cùng của nó không với tới được trong lúc nó
đang đứng yên.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Layout phát ra gì |
|---|---|---|
| `L9-1` | Dải chrome của cụm route tự ghim trên đầu tài liệu | `sticky top-0`, không có gì để trừ |
| `L9-2` | Hàng chrome thứ hai ghim ngay dưới hàng thứ nhất | `sticky top-16` kèm `-mt-px`, offset đúng bằng chiều cao hàng trên |
| `L9-3` | Một vùng của trang ghim dưới chrome **một hàng** | `top-rail` đi kèm `max-h-rail` |
| `L9-4` | Một vùng của trang ghim dưới chrome **hai hàng** | `top-course-rail` đi kèm trần của rail giá |
| `L9-5` | Vùng không ghim gì cả | **không offset, không trần**, và khung nói ra điều đó |
| `L9-6` | Vùng ghim vào cạnh **đáy** khi màn hình hẹp | `sticky bottom-0`, không trừ gì |
| `L9-7` | Chưa ai đo chrome của trang này thành token | **từ chối**, báo nợ token thay vì viết một con số |

## `L9-1` — chrome tự ghim

Tình huống: dải navbar của cụm route. Nó là thứ trên cùng nên nó không trừ ai, `sticky top-0` và hết.
`double-navbar` gom hàng thương hiệu và hàng tab vào một container duy nhất, nên hai hàng đó là một
landmark ghim chứ không phải hai thanh rời cùng ghim.

Chỗ hay nhầm: đọc `double-navbar` là hai vùng ghim. Không phải. Nó là một vùng ghim chứa hai hàng, và
đó là lý do cả cụm chỉ có một đường kẻ dưới.

## `L9-2` — hàng chrome thứ hai

Tình huống: trang chi tiết khoá học không nhét được tab của nó vào `double-navbar`, vì tab đó thuộc
về một tài liệu khoá học chứ không thuộc về cụm route. Nó dựng landmark `nav` riêng và dán lên navbar
bằng `sticky top-16`.

Hai con số phải khớp nhau và cả hai đều đo được. `top-16` là 4rem, đúng bằng `h-16` mà hàng chính tự
khai ở `contracts/index.ts:1700`. Không có chỗ nào đoán.

Còn `-mt-px` là phần hay bị bỏ quên. Nó kéo hàng dưới lên một pixel để mặt đục của hàng dưới phủ lên
đúng nét kẻ đáy của hàng trên, nhờ đó người đọc thấy một đường phân cách dưới cả khối hai hàng chứ
không thấy hai đường sát nhau. Thầy đã bắt lỗi này ở dạng khác: chrome tab phải nhìn thấy nguyên vẹn
khi cuộn, theo đúng cách Dashboard làm.

## `L9-3` — ghim dưới chrome một hàng

Tình huống: trang học và trang đọc nội dung. Chỉ có một hàng navbar, nên rail nghỉ tại
`--spacing-rail` là 5.5rem, tức 4rem navbar cộng 1.5rem thở đúng bằng nhịp trang dùng ở chỗ khác.

Trần đi kèm là `--max-height-rail`, `calc(100dvh - 7rem)`, và 7rem đó là 5.5rem phía trên cộng thêm
1.5rem phía dưới. Nói cách khác trần đối xứng với ghim. Đây là công thức của mã này và nó không tự
suy ra được sang mã kế tiếp.

`content-reader-frame` cho thấy một trang có thể có hai vùng cùng ghim. Cột đầu và cột cuối cùng dùng
`top-rail`, cùng dùng `max-h-rail`, và điều đó không mâu thuẫn vì chúng đứng dưới cùng một chrome.
Một trang, một chrome, một offset, còn bao nhiêu vùng dùng chung offset đó là chuyện khác.

## `L9-4` — ghim dưới chrome hai hàng

Tình huống: chỉ có một chỗ trong toàn bộ repo, là rail giá của trang chi tiết khoá học.
`--spacing-course-rail` là 6.1rem, gồm 4rem hàng chính cộng 2.1rem hàng tab sau khi đã trừ một pixel
chồng lấn.

Trần ở đây **không** đối xứng như `L9-3`. Nó là `(100dvh - 6.1rem) * 0.8`, và con số 80% là một phán
quyết sản phẩm chứ không phải hệ quả của phép tính nào. Bản đầu tiên viết `80dvh` phẳng và bị bác vì
`80dvh` không trừ navbar; bản sau trừ chrome trước rồi mới lấy 80% phần còn lại.

Chỗ mã này khác mọi mã khác: người giữ trần không phải khung. Khung viết ghim ở `main-then-rail`, còn
trần nằm trong một luật CSS bắt theo `data-scroll-inside="pricing-rail"`. Vì thế khi lập kế hoạch cho
vùng này, phải gọi tên cả hai chủ, nếu không nửa thứ hai sẽ rơi mất.

## `L9-5` — không ghim, và đó là một quyết định

Tình huống: rail của Dashboard và rail của trang hồ sơ. Cả hai đều là cột cố định 288px đứng cạnh cột
chính, và cả hai không mang một class sticky nào.

Đây là mã dễ đọc nhầm nhất. "Không có offset" không có nghĩa là "chưa ai ghim nó". Dashboard viết
hẳn lý do vào `why` của chính nó, rằng rail đứng cạnh main mà không trở thành card và cũng không
thành một viewport ghim riêng. Thêm offset vào đó không phải là cải thiện, mà là cãi lại một phán
quyết đã ghi.

Trang hồ sơ cho thấy một biến thể đáng nhớ. Nó có dải tab riêng nằm trên body, nhìn thì giống chrome
hai hàng, nhưng dải đó **không** sticky nên nó cuộn đi mất. Với luật này, trang hồ sơ đếm là một
hàng, và vùng dưới nó là `L9-5`. Đếm chrome bằng cái nhìn thấy lúc trang đứng yên sẽ ra kết quả sai.

## `L9-6` — ghim vào cạnh đáy

Tình huống: dưới breakpoint của rail, `learn-mobile-tab-bar` và `course-mobile-action-bar` ghim vào
đáy màn hình vì ngón tay đã ở đó. Chúng mang `md:hidden` nên không bao giờ cùng hiện với rail.

Không có gì để trừ, vì chrome nằm phía trên còn thanh này nằm phía dưới. Đây là lý do mã này tồn tại
riêng thay vì bị gộp vào `L9-5`: nó có ghim, chỉ là không có offset.

## `L9-7` — chưa đo thì đừng viết số

Tình huống: một trang có chrome mà chưa ai đo thành token. Đúng một việc được phép làm là báo nợ.

Hai hình dạng đã bị bác đích danh, `max-h-[80vh]` viết tại block và `80dvh` không trừ navbar. Cả hai
đều chạy được và cả hai đều sai, nên "nó hiển thị đúng trên máy tôi" không phải bằng chứng ở đây.

## Vì sao luật bị bác năm lần

Đọc lại hai hồ sơ, ba cách hiểu sai lặp lại:

- **Coi offset là khoảng cách.** Sai. Nó là chiều cao chrome của trang này, nên nó không mang sang
  trang khác được dù hai trang trông giống nhau.
- **Coi ghim và trần là hai việc.** Sai. Chọn ghim mà chưa chọn trần thì vùng đó chỉ mới quyết một
  nửa, và nửa còn lại hỏng ở chỗ người đọc phát hiện muộn nhất.
- **Coi một giá trị viết thẳng là tương đương token.** Sai. Token có đúng một định nghĩa nên sửa một
  chỗ là xong; con số viết thẳng thì lần sau ai đó lại viết một con số khác.
