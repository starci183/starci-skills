---
id: fe-layouts-laws-l8-one-field-one-region-vi
title: vi.md
slug: /gates/layouts/laws/l8-one-field-one-region/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng mã L8-N nhận diện bằng câu hỏi mà vùng đang trả lời, và vì sao phải đếm xem có mấy trường trước khi hỏi nó ở đâu.
---

# vi.md

> Phiên bản: `1.00` · Mô-đun: `l8-one-field-one-region` · Luật: [`INDEX.md`](./INDEX.md)

# Một trường, một vùng

Mỗi vùng trên trang tồn tại để trả lời một câu hỏi. Rail giá trả lời *mua cái này hết bao nhiêu và
bấm vào đâu*, dải sáu ô trả lời *khoá này so với khoá khác thì thế nào*, cột phải của Global Search
trả lời *cái tôi vừa chọn là cái gì*. Một dữ kiện thuộc về vùng nào là chuyện đã được quyết bởi câu
hỏi đó chứ không phải bởi chỗ nào còn trống, và câu hỏi ấy nằm sẵn trong `why` của chính vùng.

Chuyện hay hỏng nhất không phải đặt sai chỗ, mà là đặt trước khi đếm. Trên rail giá, phần tiết kiệm
được và cái link giải thích nó từng bị vẽ thành hai sibling xếp dọc. Thầy bác, vì hai phần đó là một
ý, và tách chúng ra không chuyển thông tin đi đâu cả mà chỉ đẻ thêm một dữ kiện thứ hai vốn không
tồn tại. Nên `L8-5` chạy trước, và nó hỏi có mấy trường chứ chưa hỏi trường ở đâu.

Luật cho phép đúng hai trường hợp một dữ kiện xuất hiện ở hai vùng. Cả hai đều hẹp, đều có tên, và
không cái nào là cánh cửa mở.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Kế hoạch phát ra gì |
|---|---|---|
| `L8-1` | Một dữ kiện, và đúng một vùng đang trả lời câu hỏi mà nó thuộc về | vùng đó khai slot, không vùng nào khác khai |
| `L8-2` | Câu hỏi mà dữ kiện trả lời đã đổi | slot chuyển đi nguyên vẹn, vùng cũ ghi lại lần chuyển trong `why` |
| `L8-3` | Hai vùng cùng hiện về một chủ thể, mỗi vùng hỏi một câu khác nhau | vùng để lướt giữ danh tính, vùng chi tiết giữ phần mô tả |
| `L8-4` | Nhiều dữ kiện so sánh được với nhau về cùng một chủ thể | một vùng bằng chứng, mỗi ô một dữ kiện, không phải mỗi dữ kiện một vùng |
| `L8-5` | Hai phần của cùng một ý | **một** slot, giữ trên một dòng, không có slot thứ hai ở đâu cả |
| `L8-6` | Hai vùng cùng khai dữ kiện nhưng ở hai breakpoint loại trừ nhau | cả hai cùng khai, vùng hẹp mang class loại trừ |
| `L8-7` | Hai vùng cùng hiện, cùng một loại điều khiển, khác vai trò | cả hai ở lại, mỗi `why` gọi tên vai trò của mình |

## `L8-1` — một dữ kiện, một vùng

Tình huống thường nhất và cũng là tình huống ít ai dừng lại để kiểm. Hỏi đúng một câu trước khi đặt:
*vùng này đang trả lời câu hỏi nào, và dữ kiện của tôi có phải là câu trả lời cho đúng câu đó không?*
Nếu phải mở ngoặc thêm một lý do phụ để nối dữ kiện với vùng, thì lý do phụ ấy chính là chỗ luật đang
bị bẻ.

Ranh giới với `L8-4`: `L8-1` nói về một dữ kiện đứng riêng; khi có nhiều dữ kiện đồng hạng cùng nói
về một chủ thể thì chúng không chia nhau nhiều vùng mà cùng vào một vùng bằng chứng.

## `L8-2` — dữ kiện chuyển nhà

Câu hỏi mà một vùng trả lời có thể đổi, và khi nó đổi thì dữ kiện phải đi theo. Điểm sống trong repo
là rating của khoá học. Nó từng đứng trong khối tiêu đề của trang chi tiết, rồi chuyển hẳn sang dải
sáu ô cùng với các dữ kiện so sánh được khác, và `why` của khối tiêu đề ghi lại đúng lần chuyển đó.

Hai điều kiện phải đúng cùng lúc. Slot phải đi nguyên vẹn chứ không để lại một bản "tạm giữ", vì hai
bản thì không ai biết bản nào đang đúng. Và vùng vừa mất dữ kiện phải sửa `why` của chính nó trong
cùng một lần thay đổi, bởi người đọc sau này lấy bố cục từ `why` chứ không lấy từ diff.

Điều kiện thứ hai đang bị vi phạm ở ngay chỗ mạnh nhất của luật này, và chi tiết nằm trong
[`audit.md`](./audit.md).

## `L8-3` — hai vùng, hai câu hỏi

Tình huống: một danh sách để lướt nằm cạnh một khung chi tiết, cùng nói về cùng một chủ thể. Global
Search là ví dụ sạch nhất. Vùng kết quả ở giữa khai `list` và `notice`, tuyệt đối không có slot mô
tả; phần `snippet` sống trong khung context bên phải. Cùng một dữ kiện, đúng một nhà.

Thầy phán đúng câu này khi bản dựng đem brief nhét vào từng hàng của danh sách: không render briefs ở
list, nhưng bên phải phải có details. Lý do nằm ở việc danh sách đang phục vụ mắt lướt, còn khung
phải đang phục vụ mắt đọc, và một đoạn văn trong hàng để lướt là thứ người ta bỏ qua đầu tiên.

## `L8-4` — nhiều dữ kiện, một vùng bằng chứng

Tình huống: năm hay sáu con số cùng nói về một khoá học. Bản dựng cũ cho mỗi con số một thẻ rời và
để rating đứng riêng thêm một chỗ nữa. Thầy bác, và yêu cầu một card chia sáu ô. Những thứ so sánh
được với nhau phải nằm trong cùng một khung thì mắt mới so được, còn tách ra thành sáu vùng thì mỗi
con số trở thành một tuyên bố độc lập.

Đây cũng là điểm nối với [`b1-one-surface-owner`](../../../blocks/laws/b1-one-surface-owner/INDEX.md).
`L8` quyết dữ kiện thuộc vùng nào, còn vùng đó vẽ mấy cái viền là chuyện của `B1`. Hai luật đồng ý
với nhau ở ví dụ này nhưng không được đọc thay cho nhau.

## `L8-5` — đếm trước, đặt sau

Tình huống: hai thứ trông như hai dữ kiện nhưng thật ra là một ý nói làm hai vế. Phần tiết kiệm được
và cái link mở ra cách tính ra nó là một ý duy nhất, nên chúng chia nhau một dòng không xuống hàng,
và cả cụm chỉ chiếm một slot.

Câu tự hỏi: *nếu xoá vế sau đi, vế trước có còn là một câu trả lời hoàn chỉnh không?* Nếu không thì
đó là một trường, không phải hai.

Mã này chạy trước mọi mã còn lại. Một kế hoạch đặt dữ kiện vào vùng mà chưa đếm thì chưa đặt được gì,
vì thứ nó vừa đặt chưa chắc đã là một trường.

## `L8-6` — hai vùng loại trừ nhau theo breakpoint

Tình huống: giá của khoá học được rail bên phải khai, và được thanh hành động dưới đáy màn hình khai
lần nữa. Đây không phải hai bản sao, vì thanh đáy mang `md:hidden` ngay trên chính nó, nên hai vùng
không bao giờ cùng xuất hiện trong một lần render.

Chỗ dễ làm ẩu là đặt class loại trừ lên một wrapper ở tầng trên. Khi đó người đọc nhìn vào vùng khai
trùng mà không thấy bằng chứng loại trừ ở đó, và phải leo lên hai tầng mới biết luật có bị phá hay
không. Luật buộc class nằm trên chính vùng hẹp, đúng chỗ bản sao xuất hiện.

## `L8-7` — hai vai trò, một loại điều khiển

Tình huống: breadcrumb nằm trong phần thân và tabs mục lục nằm sát navbar, cả hai đều là điều hướng,
cả hai cùng hiện. Chúng ở lại cả hai vì trả lời hai câu khác nhau. Breadcrumb nói người đọc đến từ
đâu, tabs nói trong tài liệu này còn đi được tới đâu.

Đây là mã sinh ra từ một lần trò làm sai. Bản dựng xoá breadcrumb với lý do tabs đã thay thế nó, thầy
hỏi thẳng vì sao bên trái không có breadcrumbs, và trò nhận là đã loại nó khỏi concept. Lý do giữ lại
là vai trò, không phải chỗ trống.

Ranh giới cần canh: hai vùng dùng chung một loại điều khiển mà cùng một vai trò thì đây không phải
`L8-7`, mà là một vi phạm được viết thêm chữ "vai trò" lên trên.

## Ba cách một trường bị đặt nhầm nhà

- **Đặt theo chỗ trống.** Vùng nào còn khoảng thì nhét vào đó. Cách kiểm là đọc `why` của vùng: nếu
  câu hỏi trong `why` không nhắc gì tới dữ kiện, thì dữ kiện đang ở nhờ.
- **Chuyển nhà nửa vời.** Slot mới mở ra nhưng slot cũ vẫn còn, hoặc slot cũ đã đóng mà `why` cũ vẫn
  kể về dữ kiện như một hàng xóm. Bản thứ hai là cái đang xảy ra thật trong repo sống.
- **Nhìn leaf mà tưởng là trường.** `rating-stars` xuất hiện ở phần tổng kết đánh giá và ở từng hàng
  review, nhưng cái trước là điểm trung bình của cả tập người học còn cái sau là điểm một người cụ
  thể đã cho. Registry tự nói ra điều đó trong `why` của `course-review-author-line`. Hai trường, mỗi
  trường một nhà, và cả hai đều chỉ là `L8-1`.
