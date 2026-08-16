---
id: fe-layouts-laws-l3-section-tabs-are-navbar-second-row-vi
title: vi.md
slug: /gates/layouts/laws/l3-section-tabs-are-navbar-second-row/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng mã L3-N nhận diện bằng cách hàng tabs cư xử khi người đọc cuộn, và vì sao một seam chỉ sạch khi đã đo hai giá trị border thật.
---

# vi.md

> Phiên bản: `1.00` · Mô-đun: `l3-section-tabs-are-navbar-second-row` · Luật: [`INDEX.md`](./INDEX.md)

# Hàng tabs là tầng hai của navbar

Khi một trang có bốn mục thuộc cùng một tài liệu, cái hàng chọn giữa bốn mục đó không phải nội dung
của trang. Nó là chrome, và chrome của cụm route đã có sẵn một chỗ: ngay dưới hàng navbar chính, dính
vào đó, cuộn theo đó. Người đọc thấy đúng một đường kẻ dưới cả cụm hai hàng chứ không thấy hai đường.

Luật này ràng buộc **kết quả nhìn thấy**, không ràng buộc cái hộp nào chứa nó. Repo sống đang sản
xuất cùng một kết quả bằng hai cơ chế khác nhau và cả hai đều hợp lệ. Cái bị bác là hàng tabs trôi
trong body, hàng tabs biến mất khi cuộn, và hàng tabs rộng bằng cột chữ thay vì rộng bằng navbar.

Có bốn thứ kiểm được trên một lần render thật. Hai hàng dính nhau, không khoảng hở nào ở bất kỳ vị
trí cuộn nào. Hàng tabs còn nằm trên màn hình khi body chạy bên dưới. Đúng một nét kẻ đóng cả cụm.
Và hàng tabs chạy hết chiều ngang của navbar chứ không dừng ở mép cột nội dung.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Trang phát ra gì |
|---|---|---|
| `L3-1` | Layout của cụm nhìn thấy được tập mục của trang | slot `bottom` của navbar, có nội dung — một landmark, một nét kẻ, không có seam nào phải dựng |
| `L3-2` | Chỉ trang mới biết tập mục của nó, navbar không với tới | một `nav` của riêng trang, dán bằng `sticky top-16 -mt-px border-b` |
| `L3-3` | Cụm không có trang nào sở hữu mục | `double-navbar` **không có** slot `bottom` — một hàng, và đó là câu trả lời đã phân loại |
| `L3-4` | Hàng tabs mọc trong body như một khối nội dung | **bị bác** — nó cuộn mất và nó lấy chiều rộng của cột chữ |
| `L3-5` | Có thứ xuất hiện ở cả hai hàng sau khi chúng đã dính | gọi tên **cái token** bị lặp rồi hỏi bỏ token nào; không tự suy ra là bỏ cả một hàng |
| `L3-6` | Có người báo seam đã follow reference rồi | lời báo đó vô hiệu cho tới khi đọc được hai giá trị border thật trên route |
| `L3-7` | Điều khiển vẽ lại một biểu đồ chứ không đổi vùng nội dung | **không phải hàng thứ hai** — mô-đun này không xử, `L4` xử |

## `L3-1` — navbar tự mang hàng tabs của nó

Tình huống: dashboard. Layout của cụm đọc pathname là biết ngay tập tab, không cần hỏi gì thêm và
không cần chờ dữ liệu nào. Nó điền thẳng vào slot thứ hai của navbar.

Đây là trường hợp rẻ nhất và nên là mặc định khi có thể chọn. Hai hàng nằm trong cùng một container
`sticky`, nên chúng dính nhau vì cùng một cái hộp chứ không vì ai đó căn chỉnh khéo. Cái `border-b`
duy nhất do container phát, nên không có cách nào để lỡ tay vẽ hai nét.

Câu tự hỏi: *layout của cụm có gọi tên được tập mục này mà không cần dữ liệu của trang không?* Trả
lời được thì đây là `L3-1`.

## `L3-2` — trang tự dựng `nav`, rồi dán lên

Tình huống: trang chi tiết khoá học. Bốn mục thuộc về khoá học chứ không thuộc về cụm `courses`, nên
layout đứng trên không thể biết trước. Trang tự dựng một landmark `nav`, ghim ở đúng chiều cao của
navbar, rồi kéo lên một pixel để nuốt nét kẻ của hàng trên.

Cơ chế khác nhưng bốn tiêu chí phải đạt y hệt `L3-1`. Cái được phép khác là số landmark, không phải
độ hở của seam. Contract của nó tự nhận điều đó khi phải viện đến chuyện chồng lên đúng một pixel để
giải thích vì sao kết quả bằng với Dashboard.

Chi phí có thật: tài liệu có hai landmark điều hướng ở chỗ Dashboard chỉ có một. Chi phí đó được ghi
vào [`audit.md`](./audit.md), không được nói tránh đi.

## `L3-3` — không có hàng thứ hai

Tình huống: năm trong sáu cụm sản phẩm. Slot thứ hai của navbar khai `optional: true`, và một trang
không sở hữu mục thì bỏ trống slot đó.

Đây là mã dễ đọc nhầm nhất trên kệ này. "Navbar chỉ có một hàng" không có nghĩa là ai đó quên làm
tabs. Nó có nghĩa là trang đã được phân loại và kết luận là không sở hữu mục nào. Một trang mà các
"mục" của nó thật ra là những route riêng thì không rơi vào `L3-1` hay `L3-2`, nó rơi vào `L3-3`, và
chuyện đi lại giữa các route đó là việc của điều hướng.

## `L3-4` — tabs trôi trong body

Tình huống: hàng tabs được đặt làm phần tử đầu tiên của vùng nội dung. Trông ở trạng thái nghỉ thì
gần giống, nhưng hai chỗ hỏng ngay khi người đọc động vào trang.

Thứ nhất, nó cuộn mất. Phán quyết gốc nói thẳng rằng reference giữ toàn bộ tab chrome nhìn thấy khi
cuộn, nên một hàng tabs biến mất ở màn hình thứ hai là hỏng dù nó nằm đúng chỗ ở màn hình thứ nhất.
Thứ hai, nó lấy chiều rộng của cột chữ. Cột chữ bị chặn ở một measure để đọc được, còn chrome thì
chạy hết chiều ngang, nên đặt tabs trong body là vô tình bắt nó ngắn lại.

Lần bị bác đầu tiên trong hồ sơ đúng là chuyện này, và câu của thầy hỏi tại sao bên phải không render
kiểu như bên trái.

## `L3-5` — bỏ token nào, không phải bỏ hàng nào

Tình huống: hai hàng đã dính, và có thứ nói hai lần.

Đây là chỗ thầy tự lật, nên nó phải viết thành tiêu chí chứ không thành giá trị mặc định. Vòng đầu
thầy nói với tabs này thì bỏ mấy cái nội dung ở navbar trên đi, và người làm hiểu là gỡ ba route link
khỏi hàng chính. Vòng sau thầy lật: nhầm, không phải bỏ nội dung mà là bỏ icon. Kết quả sống hôm nay
là hàng chính vẫn giữ đủ route và hàng tabs còn lại chữ trơn.

Cách đọc đúng: cái bị từ chối là **sự lặp của một token**, và token đó có thể là điểm đến, có thể là
bộ icon, có thể là nhãn. Suy ra "vậy thì bỏ hàng trên" là bước nhảy mà chính thầy đã chặn. Gọi tên
token trước, hỏi sau, rồi mới sửa.

Có một chi tiết nữa đáng nhớ ở đây. Bộ icon trên hàng tabs từng được yêu cầu thêm vào, ở một hồ sơ
trước, vì thiếu so với reference. Đúng bộ icon đó về sau bị gỡ. Một token đi vào rồi đi ra không phải
là mâu thuẫn, nó là bằng chứng rằng câu hỏi "lặp cái gì" chỉ trả lời được khi biết hàng bên kia đang
mang gì.

## `L3-6` — seam chỉ sạch khi đã đo

Tình huống: có người nói seam đã follow Dashboard rồi, và dẫn một proof cũ ra làm chứng.

Phán quyết đã bác đúng nước đi đó. Proof cũ chỉ xác nhận tabs đã sát navbar; nó không xác nhận seam
sạch, và người đọc vẫn nhìn thấy divider. Hai chuyện đó khác nhau: sát nhau là chuyện khoảng cách,
còn sạch là chuyện có mấy nét kẻ chồng lên nhau ở chỗ giáp.

Nên một lời khai về seam chỉ có giá khi kèm hai giá trị border đọc được trên route thật, dưới cùng
một viewport, cùng theme, cùng locale và cùng persona. Chưa đo thì viết thẳng là chưa đo.

## `L3-7` — không phải việc của luật này

Tình huống: một điều khiển rộng, trông như một dải tab, nhưng bấm vào thì chỉ có một biểu đồ vẽ lại
với tham số khác. Vùng nội dung của trang không đổi.

Cái đó không bao giờ leo lên hàng thứ hai, dù nó rộng đến đâu và dù vendor gọi nó là tab. Nó thuộc
`L4`, và ranh giới nằm ở một câu hỏi: sau khi bấm, **vùng** nội dung đổi hay **một hình** được vẽ
lại.

## Vì sao luật bị bác bảy lần

Đọc lại hai hồ sơ, ba cách hiểu sai lặp đi lặp lại.

- **Hiểu "dính vào navbar" thành chuyện vị trí lúc nghỉ.** Sai, vì ba trong bảy lần bác đều xảy ra
  lúc cuộn hoặc lúc nhìn kỹ chỗ giáp. Bản đúng của luật là bốn tiêu chí kiểm được trên một lần render
  chứ không phải một ảnh chụp đầu trang.
- **Hiểu "không lặp" thành "bỏ bớt một hàng".** Sai, và chính thầy đã lật lại. Cái bị từ chối là một
  token nói hai lần, nên phải gọi tên token rồi hỏi.
- **Hiểu proof cũ là chứng cứ cho câu hỏi mới.** Sai. Một proof trả lời đúng câu hỏi của nó, và
  "tabs đã sát navbar" không trả lời được "seam có sạch không".
