---
id: fe-patterns-props-and-slots-vi
title: vi.md
slug: /fe/patterns/props-and-slots/vi
sidebar_label: vi.md
sidebar_position: 1
description: Các tình huống SLOTS-N, nhận diện bằng nghiệp vụ chứ không bằng thói quen viết props.
---

# vi.md

> Version: `2.00` · Module: `props-and-slots`

# Props và slot

Props của một component là **một tập slot có tên, đóng**, và tập đó được viết thành **một type alias
cho mỗi tầng**, không phải lắp lại ở từng file.

Khi hỏi "component này nhận được gì?", câu trả lời không nằm ở trí nhớ của ai cả — nó là thứ duy nhất
biên dịch được.

Chỗ phân biệt quan trọng nhất:

> **Một quy ước thì đúng hôm nay. Một hàng rào thì đúng tháng sau.**

`interface XProps { props: XData; isLoading?: boolean }` là quy ước: đúng lúc viết, và cách một chữ
`extends` là nó mang được `className` của caller. `type XProps = LeafProps<XData>` là hàng rào: alias
**chính là** toàn bộ hình dạng, không có chỗ nào để nhét slot thứ tư, nên người muốn thêm buộc phải
quay lại quyết định mình đang viết tầng nào.

Năm slot tồn tại trong cả hệ thống, và không component nào có đủ năm: `props` là **thứ nó vẽ**, `on`
là **thứ nó làm**, `contract` là **khoá nó render** và `render` là **component cho từng slot mà khoá
đó khai báo**, `isLoading` là **cờ được trao xuống**.

**Đây là luật bắt buộc.** Component nào nhận bất cứ thứ gì đều rơi vào các mã dưới đây. Câu "có mỗi
một prop thôi mà" là chỗ hàng rào bị thay bằng một shape viết tay nhiều nhất — và hai thứ đó giống
hệt nhau đúng vào ngày viết ra.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Tầng giữ |
|---|---|---|
| `SLOTS-1` | Có thứ mang **hành vi** muốn đi chung đường với dữ liệu | Không viết ra được |
| `SLOTS-2` | Khai báo shape dữ liệu của một component | Không viết ra được |
| `SLOTS-3` | Tham số của một component cần một kiểu | Lint bắt |
| `SLOTS-4` | Caller muốn quyết định **phần bên trong** của component | Lint bắt |
| `SLOTS-5` | Có chỗ đang chờ dữ liệu về | Chỉ tài liệu giữ |
| `SLOTS-6` | Caller muốn một chỗ **trông khác đi** | Không viết ra được |
| `SLOTS-7` | Một surface dùng chung phải hiển thị một collection theo domain | Lint bắt |

---

## `SLOTS-1` — slot dữ liệu chỉ chứa DỮ LIỆU

**Tình huống.** Có một thứ mang hành vi — một handler, một component, một factory — và chỗ tiện nhất
để đặt nó là ngay cạnh những giá trị mà nó tác động lên. Luật nói không: dữ liệu là **những gì một
tài liệu JSON chứa được**, và chỉ vậy.

**Dấu hiệu nhận biết**

- Trong `props` xuất hiện một `() =>`, một tên viết hoa đầu, hoặc một biến giữ component.
- Có người lập luận rằng "nó gắn với dữ liệu này nên để chung cho gần".
- Shape được truyền vào đang được **caller** định nghĩa chứ không phải component.

**Tự hỏi.** Nếu serialize toàn bộ `props` ra JSON rồi đọc lại, có mất thứ gì không? Mất — thì thứ mất
đi đó không thuộc `props`.

**Ranh giới**

- ↔ `SLOTS-4`: một handler đi lạc vào `props` là `SLOTS-1`; một **component** đi lạc vào `props` là
  `SLOTS-4` đội lốt `SLOTS-1` — caller đang muốn quyết định phần bên trong mà không khai báo
  `contract`.
- ↔ `SLOTS-2`: `SLOTS-1` nói về **giá trị** được truyền; `SLOTS-2` nói về **cách khai báo** kiểu của
  giá trị đó. Vi phạm `SLOTS-2` là cách phổ biến nhất để một vi phạm `SLOTS-1` lọt qua mà không đỏ.

**Tình huống nghiệp vụ hay gặp.** Row có nút xoá riêng · card có `onRetry` gắn theo từng item · cell
tự vẽ badge · list truyền hàm format tiền · empty state kèm CTA riêng cho từng loại rỗng.

---

## `SLOTS-2` — dữ liệu khai bằng `type`, không bao giờ bằng `interface`

**Tình huống.** Đang khai báo shape dữ liệu cho một component. Hai cách viết trông tương đương, và
chỉ một cách còn giữ được hàng rào của `SLOTS-1`.

Đây **không** phải sở thích code style. TypeScript cấp *implicit index signature* cho type alias và
**không** cấp cho interface, nên một interface **âm thầm** trượt ràng buộc dữ liệu: nó biên dịch được
ngay tại chỗ khai báo, rồi thôi không còn thoả mãn ràng buộc đang giữ hàm ra khỏi `props`.

**Dấu hiệu nhận biết**

- Lỗi biên dịch xuất hiện ở **chỗ dùng** chứ không ở chỗ khai báo, và người đọc kết luận nhầm rằng
  alias tầng đang hỏng.
- Có ai đó vừa "sửa" bằng cách nới ràng buộc của alias tầng thay vì đổi `interface` thành `type`.

**Tự hỏi.** Kiểu dữ liệu này có bao giờ được truyền qua một slot alias không? Có — thì nó phải là
`type`.

**Ranh giới**

- ↔ `SLOTS-1`: alias là **điều kiện cần** để `SLOTS-1` còn hiệu lực. Interface không phá `SLOTS-1`
  một cách ồn ào; nó làm `SLOTS-1` vắng mặt.
- ↔ `SLOTS-3`: `SLOTS-3` đòi kiểu **có tên**; `SLOTS-2` đòi kiểu được khai **bằng đúng công cụ**. Một
  interface có tên vẫn đủ tên cho `SLOTS-3` và vẫn sai ở `SLOTS-2`.

**Tình huống nghiệp vụ hay gặp.** Shape dữ liệu của một card · payload của một row trong bảng · shape
của một item trong danh sách · kiểu dữ liệu dùng lại giữa nhiều leaf.

---

## `SLOTS-3` — hình dạng của tham số phải có TÊN

**Tình huống.** Viết một component và gõ luôn shape vào ngay tại tham số. Nó biên dịch, nó chạy, và
nó là một shape **không có chỗ nào để được đọc từ đó**: không import được, không tham chiếu được từ
twin test, không tìm được bởi người đang hỏi "component này nhận gì?".

Tên là `XProps` cho component `X`, và nó gọi tên **toàn bộ input** trước khi hàm bắt đầu.

**Dấu hiệu nhận biết**

- Dấu `{` mở ra ngay sau dấu `:` của tham số.
- Một intersection được lắp tại chỗ: `Frame & { signOutLabel: string }`. Có tên một nửa vẫn là
  ẩn danh — nửa còn lại không ai gọi tên được.
- Twin test phải chép lại shape thay vì import nó.

**Tự hỏi.** Có thứ gì khác trong repo tham chiếu được tới shape này không?

**Ranh giới**

- ↔ `SLOTS-2`: xem trên.
- ↔ tham số vô hướng: `(value: string)` không phải shape, không thuộc mã này.

**Tình huống nghiệp vụ hay gặp.** Component mới viết nhanh trong lúc dựng màn · page component có
thêm vài chuỗi copy · component được refactor tách ra từ một file lớn · helper render nhận một object
"tạm".

---

## `SLOTS-4` — có `contract` và `render` là ranh giới tầng

**Tình huống.** Đang quyết định component này là **shape đóng** hay **container mở**. Shape đóng
không có cả hai slot; container mở có cả hai. Cả hai chiều đều **nhìn thấy được trong props alias**,
nên một file đã trôi qua ranh giới sẽ lộ ra từ kiểu của nó, không cần đợi review.

Slot không tên là `children`, và cái tên không phải chuyện thẩm mỹ. Một lỗ markup nhận vào thứ **đã
dựng xong** — một `.map`, một ternary, một cây con không ai đặt tên — nên phần bên trong một container
sẽ không bao giờ phát biểu được ở đâu cả. `render` nhận **một component cho mỗi slot có tên**, và đó
là thứ biến ranh giới thành một sự thật do compiler giữ thay vì một thói quen do reviewer giữ.

**Dấu hiệu nhận biết**

- Một shape đóng vừa mọc thêm slot cho caller đổ nội dung vào.
- Một container mà caller **không** đổ nội dung vào được — nó thuộc tầng dưới, dù tên gọi là gì.
- Có người đề nghị "cho nhận markup một lần này thôi".

**Tự hỏi.** Caller có được quyết định phần bên trong không? Có ⇒ khai `contract` + `render`. Không ⇒
component này thuộc tầng đóng, và slot đang bàn không tồn tại.

**Ranh giới**

- ↔ `SLOTS-1`: xem trên.
- ↔ `SLOTS-7`: `SLOTS-4` hỏi **caller có được đổ nội dung không**; `SLOTS-7` hỏi **dữ liệu chạy theo
  đường nào** khi câu trả lời của `SLOTS-4` đã là có.

**Ngoại lệ đóng.** Các shell trao thẳng phần bên trong cho cơ chế của vendor — modal, drawer,
dropdown — được miễn vì chúng **không sắp xếp gì cả** và không có quyền từ chối shape mà vendor khai.
Lint còn miễn thêm chỗ nối route: nơi chuyển đổi thứ mà layout của framework trao xuống. Bảng registry
cũng được miễn, vì ở đó phần "con có tên" chính là thứ đã thay thế lỗ markup — báo lỗi nó là bắt file
đã xoá slot ẩn danh phải thôi mô tả thứ thay thế nó.

**Tình huống nghiệp vụ hay gặp.** Card có phần thân do màn hình quyết định · list surface dùng chung ·
section có nội dung khác nhau theo trang · wrapper layout · modal.

---

## `SLOTS-5` — `isLoading` được NHẬN, không được tự quyết

**Tình huống.** Một component nằm dưới tầng sở hữu request được **báo cho biết** thứ nó vẽ đã về hay
chưa. Nó không tự hỏi. Tầng sở hữu request ghi cờ đó **một lần** khi trao cây xuống, và bản thân tầng
đó không bao giờ nhận cờ — vì props của nó mang một **tình huống nghiệp vụ** thay vì một cờ chờ.

**Dấu hiệu nhận biết**

- Trong một leaf hoặc composite có `useState`, `useEffect` hay một hook fetch quyết định trạng thái
  chờ.
- Hai component cùng một cây đang chờ **lệch nhau**, vì mỗi cái tự trả lời.
- Có `isLoading` nằm trong props của tầng đang sở hữu request.

**Tự hỏi.** Ai gọi request? Nếu không phải file này, thì file này **không có quyền** trả lời câu hỏi
"đã về chưa".

**Ranh giới**

- ↔ `SLOTS-1`: cờ chờ là `boolean`, nên nó qua được `SLOTS-1` một cách hợp lệ. Vấn đề của `SLOTS-5`
  không phải kiểu của cờ mà là **ai viết ra nó**.

**Đây là mã yếu nhất của module.** Không type nào và không rule nào bắt được một component tự tính
trạng thái chờ của mình; chỉ người đọc bắt được. Xem `audit.md`.

**Tình huống nghiệp vụ hay gặp.** Skeleton của card trong dashboard · bảng có phân trang · avatar chờ
hồ sơ · số liệu tổng quan · list gợi ý tải sau nội dung chính.

---

## `SLOTS-6` — không có slot ngoại hình

**Tình huống.** Caller muốn một chỗ trông khác đi: một class, một style, một khoảng cách, một hook
styling cho từng phần bên trong. Không slot nào trong số đó tồn tại.

Người nào chỉnh được diện mạo của một node thì đã trở thành **chủ sở hữu thứ hai** của nó, và component
lúc đó có hai tác giả không bao giờ nói chuyện với nhau. Thứ caller đang cố nói ra là một **variant có
tên**, và nó được quyết định **ở bên trong**.

**Dấu hiệu nhận biết**

- Một prop có tên kết thúc bằng `ClassName`, `Style`, `Gap`, `Spacing`.
- Một object `classNames` mở từng phần bên trong ra cho caller.
- Cùng một component trông khác nhau ở hai màn hình mà không màn nào gọi tên được sự khác nhau đó.

**Tự hỏi.** Caller đang muốn nói điều gì về **nghiệp vụ**? Câu trả lời đó là tên của variant.

**Ranh giới**

- ↔ `SLOTS-1`: một chuỗi class **là** dữ liệu hợp lệ về kiểu, nên `SLOTS-1` không chặn nó. `SLOTS-6`
  chặn vì lý do quyền sở hữu, không phải vì lý do kiểu.
- ↔ `SLOTS-4`: mở ngoại hình ra là mở **diện mạo**; mở `render` ra là mở **cấu trúc**. Hai lỗ khác
  nhau, và lỗ ngoại hình không bao giờ hợp lệ.

**Tình huống nghiệp vụ hay gặp.** Tô đậm dòng của chính mình trong bảng xếp hạng · card nổi bật hơn ở
trang landing · nút nguy hiểm · row đã đọc và chưa đọc · trạng thái được chọn.

---

## `SLOTS-7` — collection đi theo tên domain trong `props`, không đi qua `items`

**Tình huống.** Một surface dùng chung phải hiển thị một collection: task, khoá học, hoá đơn, hay bất
cứ thứ gì thêm vào sau này. Surface đó là **nơi chứa contract**, không phải một mô hình dữ liệu. Vì
component `render` ổn định của nó đã sở hữu shape props theo domain, collection đi dưới **tên thật của
nó** bên trong `props`.

Một slot `items` ở cấp cao nhất tạo ra **làn dữ liệu thứ hai** chạy song song với `props`, và dạy cho
surface dùng chung biết mô hình collection của từng caller. Đến caller thứ ba thì surface đã biết ba
mô hình mà đáng lẽ nó không cần biết cái nào.

**Dấu hiệu nhận biết**

- Cùng một call site truyền dữ liệu chạy qua hai đường: một phần trong `props`, một phần trong
  `items`.
- Có người đang bàn xem "thứ này nên để `props` hay `items`" — câu hỏi đó chỉ tồn tại khi làn thứ hai
  đã tồn tại.

**Tự hỏi.** Nếu ngày mai có thêm một domain nữa dùng surface này, surface có phải học thêm gì không?

**Ranh giới**

- ↔ `SLOTS-4`: xem trên.
- ↔ `SLOTS-1`: cả hai đều nói về `props`. `SLOTS-1` nói **cái gì được vào**; `SLOTS-7` nói **đường nào
  được dùng**.

**Tình huống nghiệp vụ hay gặp.** Card nhiệm vụ hằng ngày · danh sách khoá học đang học · lịch sử
thanh toán · danh sách thông báo · bảng thành viên.

---

## Luật

1. Alias tầng **chính là** hình dạng. Không có slot thứ tư để thêm.
2. Dữ liệu và hành vi đi **hai slot khác nhau**.
3. Mọi shape của tham số đều có tên trong module khai ra nó, và tên đó là `XProps`.
4. `contract` và `render` xuất hiện **cùng nhau** hoặc không xuất hiện.
5. Tầng sở hữu request **ghi** `isLoading` và không bao giờ nhận nó.
6. Ngoại hình được quyết định bên trong, dưới một cái tên.
7. Surface dùng chung không học mô hình collection của bất kỳ caller nào.
8. Một component dùng **một** alias tầng; cần alias khác nghĩa là đã chọn sai tầng.

## Ngoại lệ

Ngoại lệ là **một phần của luật**. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã nó áp dụng vào.

- **Shell đóng (`SLOTS-4`).** Modal, drawer, dropdown trao thẳng phần bên trong cho cơ chế vendor;
  chúng không sắp xếp gì và không từ chối được shape vendor khai. Danh sách này là **bốn file có
  tên** — kể cả chỗ nối route mà lint miễn thêm — không phải một thư mục được miễn.
- **Bảng registry (`SLOTS-4`).** Nơi khai "con có tên" là thứ đã thay thế lỗ markup, không phải một
  lỗ markup.
- **Ngoài các tầng component (`SLOTS-4`).** Một page nhận thứ framework trao cho nó; đó là việc hợp
  lệ duy nhất của page.
- **Hai làn cho `render` (`SLOTS-4`).** Slot có tên đã bind, hoặc một component type ổn định mang
  brand theo khoá. Chọn làn theo việc dữ liệu runtime có **lặp** hay không, không theo sở thích.
- **Tham số vô hướng (`SLOTS-3`).** `(value: string)` không phải shape.
- **Không có ngoại lệ cho `SLOTS-6`.** Một lần "chỉ lần này thôi" là một lần trao quyền sở hữu thứ
  hai, và quyền đó không lấy lại được bằng review.
