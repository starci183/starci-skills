---
id: fe-layouts-laws-l10-region-width-belongs-to-its-owner-vi
title: vi.md
slug: /fe/layouts/laws/l10-region-width-belongs-to-its-owner/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng mã L10-N nhận diện bằng nghiệp vụ, và vì sao hai layout owner cùng hình dạng vẫn là hai chủ khác nhau.
---

# vi.md

> Phiên bản: `1.00` · Mô-đun: `l10-region-width-belongs-to-its-owner` · Luật: [`INDEX.md`](./INDEX.md)

# Ai xếp hàng ngang, người đó viết chiều rộng

Khi hai vùng đứng cạnh nhau, có đúng một contract biết vì sao chúng đứng cạnh nhau: cái contract xếp
chúng thành một hàng. Nó biết bên nào phải giữ số đo cố định, bên nào phải co giãn, và nó biết điều
đó vì nó cầm cả hai. Một vùng con thì không biết. Nó chỉ thấy phần của mình, nên nếu nó tự đòi
`w-80` thì nó đang đoán về một cái hàng mà nó không nhìn thấy.

Luật này nghe hiển nhiên cho tới lúc có hai chủ cùng hình dạng. Trang chi tiết khoá học và trang đọc
nội dung đều là một cột chính cạnh một rail `w-72`. Một lần nới rail từ `w-72` lên `w-80`, người sửa
sửa nhầm `content-reader-frame` thay vì `main-then-rail`, và bản vá trông hoàn toàn hợp lý cho tới
khi live proof mở trang học lên. Cùng hình dạng không phải cùng chủ, và đó là toàn bộ nội dung của
L10.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Chủ hàng phát ra gì |
|---|---|---|
| `L10-1` | Một hàng gồm một rail cố định và một mặt chính co giãn | số đo cố định kèm `shrink-0` cho rail, `min-w-0` kèm `grow` cho mặt chính |
| `L10-2` | Trong hàng có con optional, con lặp, hoặc một leaf bị vendor bọc | vẫn số đo đó, nhưng nhắm vào `data-node` hoặc `data-component` kèm `data-variant` |
| `L10-3` | Số đo ngoài cùng của trang và việc căn giữa | `mx-auto` cùng đúng một `max-w-*`, đặt ở contract của trang |
| `L10-4` | Đang sửa chiều rộng, mà có chủ thứ hai cùng hình dạng | chỉ chủ được gọi tên; các chủ còn lại phải chứng minh là không đổi |
| `L10-5` | Chủ hàng không phát chiều rộng nào | **không gì cả** — vùng con tự khai số đo và trở thành chủ của số đo đó |
| `L10-6` | Số đo thuộc về một hàng bên trong block | **không gì cả** — L10 không phán chuyện này |

## `L10-1` — chủ phát, vùng nhận

Tình huống thường gặp nhất: hai vùng đứng cạnh nhau, một bên là rail giữ số đo cố định, bên kia là
nội dung chính ăn hết phần còn lại. Dashboard làm mẫu sạch nhất. `dashboard-rail-then-main` viết
`md:[&>*:first-child]:w-72` cùng `shrink-0` cho rail, `md:[&>*:last-child]:min-w-0` cùng `grow` cho
cột chính, rồi thôi. Vùng con `dashboard-rail` khai đúng bốn class là `flex w-full flex-col gap-6`.
Nó nói rằng nó lấp đầy trục được giao, không nói nó rộng bao nhiêu.

Câu tự hỏi khi phân vân: *nếu tôi mở file của vùng này ra một mình, tôi có biết bên cạnh nó là cái
gì không?* Nếu không biết thì nó không đủ dữ kiện để quyết chiều rộng, và số đo phải nằm ở chủ hàng.

Số đo cố định luôn đi kèm `shrink-0`. Bình luận trong chính registry ghi lại lần đo: một cột lẽ ra
288px bị co còn 273px trong viewport 934px, vì thiếu đúng cái class từ chối co lại. Một con số không
được bảo vệ chỉ là một lời đề nghị.

## `L10-2` — nhắm vào danh tính, không nhắm vào vị trí

`*:first-child` và `*:last-child` chỉ đúng khi mọi con trong hàng đều bắt buộc và không lặp. Bỏ một
con optional vào hàng thì đứa cuối cùng đổi người tuỳ dữ liệu, và selector viết theo hình dạng hôm
đó sẽ tìm thấy đứa khác vào hôm sau.

Global Search gặp chuyện này ở một dạng còn khó thấy hơn. React Aria chèn sibling ẩn quanh ListBox,
nên `first-child` trong DOM thật không phải là vùng mình định nhắm. Bản sửa bỏ hết selector theo vị
trí và chuyển sang `[data-node=global-search-result-region]` cùng
`[data-component=SelectionList][data-variant=scopes]`. Cái này kiểm được, vì mỗi branch node phát ra
`data-node` chính bằng khoá contract của nó.

Có trường hợp không nhắm được bằng `data-node`, đó là khi con là một leaf. Learn shell xử lý bằng
cách phát mặc định cho tất cả bằng `[&>*]:min-w-0` và `[&>*]:grow`, rồi lật riêng cột spine bằng
`grow-0` và `w-72` theo danh tính. Mặc định cho số đông, ngoại lệ có tên.

## `L10-3` — số đo của trang nằm ở trang

Khung bên ngoài lo chiều cao, chiều xếp và việc nó là sibling của phần được route. Số đo đọc được thì
nằm ở contract của trang: `dashboard-rail-then-main` và `main-then-rail` cầm `max-w-6xl`,
`content-reader-frame` cầm `max-w-app-xl`, `course-personal-project-task-page` cầm `max-w-app-lg`.
`routed-page-main` nói thẳng ra điều đó trong `why` của nó, rằng nó nhận chiều cao mà navbar để lại
chứ không tự quyết một số đo, vì trang bên trong đã giữ quyết định ấy rồi.

Ngay phía trên nó, `nav-over-body-page` lại viết trong `why` rằng số đo được đặt ở đây. Class của nó
không có `max-w` nào. Hai câu `why` nằm cách nhau sáu dòng và mâu thuẫn nhau; câu ở
`nav-over-body-page` là câu cũ. Việc này đã được ghi vào [`audit.md`](./audit.md) thay vì sửa lén.

## `L10-4` — sửa đúng chủ, và chứng minh các chủ còn lại

Đây là mã đắt nhất, vì nó không nói về lúc dựng mà nói về lúc sửa. Khi một yêu cầu tới dưới dạng
"rail hơi chật", việc đầu tiên không phải là tìm class `w-72`, mà là liệt kê mọi contract đang giữ
một số đo rail. Repo sống có bảy: `learn-shell-frame`, `personal-project-workspace-frame`,
`dashboard-rail-then-main`, `content-reader-frame` ở cả hai đầu, `main-then-rail`,
`global-search-body` ở cả cột scope lẫn cột ngữ cảnh, và `profile-identity-rail` tự khai. Nới một
trong số đó vì trang khác chật là sửa nhầm người.

Bản vá đúng đã hoàn nguyên sibling về `w-72` và chỉ nới `main-then-rail` lên `w-80`. Repo sống hôm
nay vẫn giữ nguyên kết quả ấy, nên bằng chứng đọc được trực tiếp từ mã chứ không chỉ từ hồ sơ.

Quy tắc rút ra ngắn thôi: đơn sửa chiều rộng phải gọi tên chủ được sửa, và gọi tên cả những chủ cùng
hình dạng mà nó không sửa.

## `L10-5` — chủ im lặng thì vùng tự khai

Có đúng một chỗ trong repo sống làm chuyện này. `profile-rail-then-main` không phát chiều rộng cho
con nào cả, và `profile-identity-rail` tự khai `w-full shrink-0 @app-md:w-72`. Đây không phải vi
phạm, vì không có ai khác đang giữ số đo. Quyền sở hữu chuyển hẳn sang vùng con, kèm theo mọi nghĩa
vụ của một chủ, trong đó có nghĩa vụ là chỗ duy nhất viết số đo ấy.

Chỗ này cũng là nơi duy nhất dùng ngưỡng `@app-md` thay vì `md:`. Khác biệt thật chứ không phải khác
cách viết: `md:` hỏi viewport, còn `@app-md` hỏi chính vùng profile, và
`profile-rail-container` bật `@container` để câu hỏi đó có nghĩa. Khi khai một số đo, khai luôn nó
đang đo cái gì.

## `L10-6` — hàng trong block không thuộc kệ này

Một hàng catalogue cố định ảnh ở `w-36`, một hàng xếp hạng cố định số thứ tự ở `w-5`, một khối ý định
mua cho mọi nút `[&>*]:w-full`. Cả ba đều là quyết định chiều rộng, cả ba đều đúng, và không cái nào
thuộc L10. Chúng nói về thứ tự đọc bên trong một khối chứ không nói về việc hai vùng chia nhau một
trang.

Ranh giới kiểm được: nếu hai thứ đứng cạnh nhau là hai *vùng* mà `LayoutPlan` có gọi tên, thì L10
phán. Nếu chúng là các phần bên trong một khối, câu trả lời nằm ở kệ `blocks` và ở các principle về
kích thước.

## Vì sao luật này trượt

Đọc lại sáu dòng từ chối, ba cách trượt lặp lại.

- **Tìm class trước, tìm chủ sau.** Người sửa mở grep, thấy `w-72`, sửa cái gặp đầu tiên. Bốn chỗ
  đang giữ class ấy và chỉ một chỗ được yêu cầu đổi.
- **Tin vào vị trí con.** `first-child` đọc rất tự nhiên trên cây contract, nhưng cây contract không
  phải DOM. Vendor chèn node, và một con optional biến mất theo dữ liệu.
- **Lấy phán quyết của một điều khiển đem áp cho một vùng.** Thanh chọn năm trên dashboard từng được
  bắt kéo dài hết dòng, rồi bị lật về số đo nội tại. Đó là chuyện thứ bậc của một điều khiển và nó
  thuộc [`l4`](../l4-tab-switches-panel-route-switches-page/INDEX.md), không phải chuyện chiều rộng
  của một vùng.
