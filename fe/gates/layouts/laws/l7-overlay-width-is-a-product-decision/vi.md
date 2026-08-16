---
id: fe-layouts-laws-l7-overlay-width-is-a-product-decision-vi
title: vi.md
slug: /gates/layouts/laws/l7-overlay-width-is-a-product-decision/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng mã L7-N nhận diện bằng việc người đọc phải làm gì bên trong overlay, và vì sao im lặng không phải là một lời khai.
---

# vi.md

> Phiên bản: `1.00` · Mô-đun: `l7-overlay-width-is-a-product-decision` · Luật: [`INDEX.md`](./INDEX.md)

# Chiều rộng overlay là một quyết định sản phẩm

Khi một panel phủ lên trang, câu hỏi đầu tiên người ta hay tự trả lời hộ là nó nên rộng bao nhiêu, và
câu trả lời quen thuộc nhất là "modal thì hẹp thôi". Thầy đã bác chính câu đó, và bác thêm một lần
nữa ngay dòng dưới bằng cách loại hai direction hẹp với lý do người đọc không đổi nhóm và xem ngữ
cảnh cùng lúc được. Hai dòng ấy nằm cạnh nhau trong cùng một phase của cùng một hồ sơ, nên chúng
không phải hai ý kiến rời rạc mà là một phán quyết đủ hai vế: bỏ cái mặc định, rồi thay nó bằng việc
đọc xem người ta phải làm gì trong đó.

Cần nói rõ một chuyện dễ hiểu nhầm. Bỏ mặc định không có nghĩa là không còn mặc định nào. `ModalShell`
vẫn quy `size` vắng mặt về `md`, nên một plan không khai gì thì vẫn nhận một chiều rộng, chỉ là nhận
mà chưa phán. Trong luật này, chiều rộng không khai là chiều rộng chưa được phán, chứ không phải chiều
rộng an toàn.

Thang chỉ có năm nấc và nó đo được thành số. Bốn nấc đầu là `max-w-xs`, `max-w-sm`, `max-w-md` và
`max-w-lg` của Tailwind, tức `20rem`, `24rem`, `28rem` và `32rem`, còn `cover` thì chiếm hết cả bề
ngang lẫn chiều cao. Biết điều này quan trọng, vì nó cho phép so trực tiếp nấc của shell với bất kỳ
`max-w-*` nào mà một contract bên trong tự khai.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Plan khai gì |
|---|---|---|
| `L7-1` | Mở một overlay trên `ModalShell` | một trong năm giá trị, gọi tên, kèm lý do nói về nội dung |
| `L7-2` | Người đọc trả lời một lời phát biểu, đọc từng điều khiển một | giá trị hẹp nhất mà một cột vẫn còn là một cột; đang chạy là `xs` |
| `L7-3` | Người đọc dò từng dòng, mỗi dòng một nhãn và một con số | đủ rộng để con số không tụt xuống dưới nhãn; đang chạy là `sm` |
| `L7-4` | Người đọc phải làm việc trên nhiều vùng cùng lúc | `cover`, kèm tên những vùng phải cùng nhìn thấy |
| `L7-5` | Lý do nói về loại vật chứ không nói về nội dung | **không phát giá trị nào**, trả câu hỏi về cho thầy |
| `L7-6` | Không khai gì và để shell tự quy | khai `md` ra thành chữ, kèm lý do của nó |
| `L7-7` | Hỏi về chiều rộng của drawer hoặc dropdown | **không biểu diễn được**, ghi vào `owed` |

## `L7-1` — khai một giá trị, và để lý do đứng cạnh nó

Tình huống: plan mở một panel phủ trên `ModalShell`. Thang chỉ có năm nấc và nó thuộc về shell, nên
việc cần làm không phải là nghĩ ra một số đo mà là chọn một trong năm nấc ấy rồi nói vì sao.

Điều kiện thứ hai mới là chỗ luật thật sự làm việc. Lý do phải nằm ngay cạnh giá trị trong mã, không
phải chỉ nằm trong bản ghi thiết kế. Người sửa overlay này sáu tháng nữa sẽ mở file component ra đọc
chứ sẽ không đi tìm hồ sơ, nên một lý do chỉ sống trong hồ sơ là một lý do sẽ mất.

Đo trong repo sống thì bốn overlay dùng `ModalShell` và chúng khai ba giá trị khác nhau, nhưng chỉ
một trong bốn cái ghi lý do tại chỗ. Ba cái còn lại hợp lệ vì chúng đã được phán trong hồ sơ, và ba
cái ấy đồng thời là khoản nợ đo được của mô-đun này.

## `L7-2` — một lời phát biểu, đọc từng điều khiển một

Tình huống: bên trong overlay là một biểu mẫu hoặc một câu hỏi xác nhận, người đọc đi từ trên xuống
và mỗi lần chỉ đối diện một thứ. Ở dạng này chiều rộng thừa không giúp gì, vì mắt phải chạy từ cái
nhãn sang cái ô mà nhãn ấy gọi tên.

`SignInOverlay` là ví dụ sống và nó có một chỗ đáng chú ý. Cái panel bên trong nó, contract
`centred-page-column`, tự mang `max-w-md` và viết lý do vào `why` của mình đúng theo tinh thần trên.
Nhưng contract ấy còn được dùng cho cả route `/authentication`, nơi panel đứng một mình và không có
shell nào bọc. Trong overlay thì shell mở ở `xs`, và năm nấc của shell hoá ra chính là thang
`max-w-*` quen thuộc, nên `xs` là `20rem` còn cái trần của contract là `28rem`. Trần ấy không bao giờ
chạm tới, và thứ người đọc thật sự gặp hẹp hơn hai nấc so với con số mà câu `why` duy nhất đang giải
thích.

Bài học của mã này không phải là `xs` sai. Bài học là khi hai chỗ cùng nói về độ hẹp, plan phải nói rõ
chỗ nào đang thắng.

## `L7-3` — một cột số đọc theo dòng

Tình huống: bên trong overlay là một bảng tính toán, mỗi dòng một nhãn bên trái và một con số bên
phải, và người đọc dò xuống để hiểu tổng cộng bao nhiêu. Ở dạng này chiều rộng có một ngưỡng thật:
hẹp quá thì con số tụt xuống dưới nhãn, và lúc ấy cái cột thôi không còn là cột nữa.

`CoursePriceOverlay` ghi đúng câu đó ngay đầu file, ngay cạnh chỗ nó khai `sm`. Đây là lý do duy nhất
trong bốn overlay được viết tại chỗ ra quyết định, và nó là hình mẫu cho mọi lý do khác, vì nó nói
được cái gì hỏng khi lùi một nấc. Một lý do nói được điều đó là một phép đo. Một lý do không nói được
thì mới chỉ là một lựa chọn.

`CheckoutOverlay` cũng ở `sm` và cũng có một bảng tiền tương tự, nhưng nó không ghi lý do nào. Kết quả
render đúng, phần giải thích thì đang thiếu.

## `L7-4` — làm việc trên nhiều vùng cùng lúc

Tình huống: bên trong overlay có nhiều vùng và người đọc phải chuyển qua lại giữa chúng mà không được
mất vùng nào khỏi màn hình. Đây chính là điều dòng bác thứ hai mô tả khi nó loại hai direction hẹp,
rằng chưa dùng đủ chiều rộng để đổi nhóm và xem ngữ cảnh đồng thời.

`GlobalSearchOverlay` mở ở `cover`, và cái mà `cover` mua được đã hoá thành mã ở contract
`global-search-body`: `why` của nó nói ba thứ gồm danh sách scope, vùng kết quả và phần render của
mục đang chọn phải cùng nhìn thấy trên desktop, còn `classes` đặt ba cột với `w-72` hai bên và `grow`
ở giữa. Khai `cover` thì phải gọi tên được những vùng ấy, vì nếu không gọi tên được thì chưa có gì
chứng minh là cần tới `cover`.

Chiều rộng của từng cột trong ba cột ấy không thuộc mã này. Đó là
[`l10`](../l10-region-width-belongs-to-its-owner/INDEX.md), và hai quyết định được khai tách nhau kể
cả khi cùng một plan viết cả hai.

## `L7-5` — lý do nói về loại vật thì bị từ chối

Tình huống: plan đã có một con số nhưng lý do đi kèm nghe được cho bất kỳ overlay nào. Rằng nó là
modal. Rằng modal bên kia cũng thế. Rằng hẹp trông gọn hơn. Đặc điểm chung của những câu này là chúng
sẽ cho ra cùng một giá trị cho một biểu mẫu đăng nhập và cho một workspace tìm kiếm, tức là chúng
không thật sự đọc nội dung nào cả.

Cách xử lý là từ chối cái lý do chứ không phải sửa cái lý do thành hay hơn. Không phát giá trị nào,
trả câu hỏi về cho thầy, đúng cách [`L5-5`](../l5-every-route-has-a-real-owner/INDEX.md) làm với một
cánh cửa có hai đích.

## `L7-6` — im lặng không phải là một lời khai

Tình huống: plan không nói gì về chiều rộng, và ai đọc cũng hiểu ngầm là "mặc định". Vấn đề là mặc
định ấy có thật, nó là `md`, và hôm nay chưa overlay nào chạm tới. Nghĩa là chọn `md` là chọn đúng
cái giá trị mà shell sẽ tự quy ra, và người đọc plan không có cách nào phân biệt một `md` đã cân nhắc
với một `md` bị bỏ quên.

Cho nên `md` được phép, nhưng phải viết ra thành chữ kèm lý do của nó. Nấc `lg` thì chưa ai dùng bao
giờ, nên với nấc đó plan còn phải nói thêm cái gì hỏng ở `sm` và cái gì bị phí ở `cover`.

## `L7-7` — drawer và dropdown chưa khai được

Tình huống: yêu cầu nói về chiều rộng của một drawer. Hôm nay điều đó không biểu diễn được.
`DrawerShell` không có prop `size` nào cả, thứ duy nhất nó nhận là `placement`, và mặc định là mở từ
cạnh phải. `CartDrawer` gọi shell mà không truyền cả `placement`. `StarCiAiDrawer` có truyền, nhưng
cái nó truyền là cạnh mở suy từ viewport chứ không phải một số đo. `DropdownShell` cũng chỉ có
`placement` và không có gì về bề ngang.

Cách xử lý là ghi vào `owed` và dừng lại. Đừng sơn một class chiều rộng lên contract bên trong drawer
để đi vòng, vì cái class ấy sẽ trở thành chủ sở hữu thứ hai của một số đo mà shell đang giữ, và không
có rule nào nhìn thấy nó.

## Luật

Chiều rộng của một overlay được phán từ việc người đọc phải làm gì bên trong nó, và mọi plan mở overlay
khai giá trị ấy ra bằng tên kèm một lý do đứng ngay cạnh trong mã. Lý do hợp lệ nói về hành vi của nội
dung ở chiều rộng đó, và nó nói được cái gì hỏng khi lùi một nấc. Lý do nói về loại vật thì bị từ chối
và chiều rộng quay về cho thầy phán. Không khai gì cũng là một lựa chọn, và là lựa chọn chưa được phán.
Với drawer và dropdown thì chưa có gì để khai, nên ghi nợ chứ đừng tự đặt ra một thang.

## Ngoại lệ

- **Panel đồng thời là một route.** `L7-2`. `centred-page-column` mang `max-w-md` cho lần dùng ở
  `/authentication`, còn trong overlay thì `xs` của shell hẹp hơn và thắng. Cái trần của contract đúng
  ở chỗ nó sinh ra, nhưng nó không phải câu trả lời cho overlay.
- **Drawer đổi cạnh mở theo viewport.** `L7-7`. `StarCiAiDrawer` mở từ dưới lên khi màn hẹp và từ phải
  vào khi màn rộng. Đó là quyết định về cạnh, không phải quyết định về bề ngang.
- **Overlay cỡ `cover` lấy phần đệm từ shell.** `L7-4` đẩy chuyện này sang
  [`L6-3`](../l6-overlay-is-already-a-surface/INDEX.md) chứ không giữ lại.
- **Giá trị đang chạy mà chưa có lý do tại chỗ.** `L7-1`. Ba trên bốn overlay đang ở tình trạng này.
  Chúng hợp lệ vì đã được phán trong hồ sơ, và chúng là nợ vì hồ sơ không phải chỗ người sửa mã sẽ đọc.
  Ngoại lệ này che cho thứ đã ship và không cấp phép cho việc mới.

## Vì sao luật này hay bị đi vòng

Ba đường trượt lặp lại, và không đường nào trong số đó trông giống một vi phạm lúc đang viết.

Đường thứ nhất là chép giá trị của overlay bên cạnh. Nó cho ra một con số hợp lệ, qua được mọi gate,
và làm mất đúng cái phần mà luật này quan tâm, tức là người đọc phải làm gì trong panel này chứ không
phải trong panel kia.

Đường thứ hai là để lý do ở lại trong hồ sơ thiết kế. Lúc viết thì lý do đang ở ngay trước mặt nên
việc chép nó vào mã trông thừa. Sáu tháng sau thì file component là thứ duy nhất còn được mở ra, và
con số đứng đó một mình.

Đường thứ ba là tin rằng grep đã đo hết. Grep `max-w`, `w-[`, `min-w` và `w-full` trên toàn bộ
`src/components/overlays/**.tsx` chỉ trúng đúng một dòng, và dòng đó là media query chọn cạnh mở của
drawer. Điều đó dễ đọc thành "không overlay nào tự khai chiều rộng", trong khi sự thật là các class
chiều rộng của ruột nằm trong registry contract chứ không nằm trong thư mục overlay, và
`centred-page-column` có một cái trần thật.
