---
id: fe-patterns-vendor-boundary-vi
title: vi.md
slug: /fe/patterns/vendor-boundary/vi
sidebar_label: vi.md
sidebar_position: 1
description: Các tình huống VENDOR-N, nhận diện bằng quyền sở hữu chứ không bằng cảm giác tiện tay.
---

# vi.md

> Version: `2.00` · Module: `vendor-boundary`

# Vendor boundary

Vendor boundary trả lời đúng **một** câu hỏi: *file này có được phép import thư viện component
không?* Câu trả lời không phụ thuộc vào việc import ấy có tiện không, có ngắn không, có "chỉ một lần
thôi" không. Nó phụ thuộc vào **file đang nằm ở tầng nào**.

Danh sách chủ sở hữu là **danh sách đóng**:

- `leaves/` — sở hữu primitive đóng;
- ba covering shell `ModalShell`, `DrawerShell`, `DropdownShell` — sở hữu cơ chế vendor và giữ những
  slot `children` không được diễn giải duy nhất; cộng framework shell `RouteShell`, sở hữu cùng loại
  slot cho một route segment mà **không** import vendor nào;
- bốn surface branch có tên `SurfaceCard`, `SurfaceAccordionCard`, `SurfaceListCard`,
  `SurfaceFormCard` — sở hữu vendor wrapper mà chúng chiếu một content contract có kiểu vào trong.

Mọi file còn lại **compose** các chủ sở hữu đó.

**Luật này soi theo hai chiều, và chiều thứ hai mới là lý do nó là một chính sách chứ không phải một
cái lỗ.** Chiều ra ngoài: một component import thư viện từ thư mục sai là để nhầm chỗ — nửa này ai
cũng thấy. Chiều vào trong: một file nằm trong thư mục wrapper mà **không wrap gì cả** là một
component thường đang giữ một đặc quyền nó không cần. Thiếu nửa này, thư mục wrapper trở thành chỗ để
những thứ khó xếp. Thứ đầu tiên được đưa vào luôn là thứ khó xếp nhất.

**Đây là luật bắt buộc.** Mọi file trong cây component hoặc là chủ sở hữu trong danh sách đóng, hoặc
là người compose. Không có trạng thái thứ ba, và câu "nó chỉ cần đúng một widget nhỏ" chính là câu mở
ra chủ sở hữu thứ tư.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Tầng giữ |
|---|---|---|
| `VENDOR-1` | Một primitive vendor có đúng một chủ sở hữu có tên | `enforced` |
| `VENDOR-2` | `shells/` đóng, và covering shell rỗng cũng là lỗi | `enforced` |
| `VENDOR-3` | Surface branch giữ ruột có kiểu: `contract + render` | `documented` |
| `VENDOR-4` | Không có `CardShell` — branch có tên tự sở hữu wrapper | `enforced` |
| `VENDOR-5` | Thư viện glyph có ranh giới riêng, của module khác | `documented` |
| `VENDOR-6` | `ModalShell` có đúng một scroll body zero-inset | `enforced` |
| `VENDOR-7` | Field nhà cố định variant input trên mặt bounded | `documented` |
| `VENDOR-8` | Overlay đã là vật bounded, không mount surface branch | `enforced` |
| `VENDOR-9` | Label của field chỉ có chữ | `documented` |
| `VENDOR-10` | `TextLink` là Link của vendor, không phải link vẽ tay | `enforced` |
| `VENDOR-11` | Cơ chế dropdown và ý nghĩa tài khoản là hai chủ khác nhau | `enforced` |
| `VENDOR-12` | Auth projection có đúng một host zero-inset | `enforced` |
| `VENDOR-13` | Compound control giữ đủ giải phẫu bắt buộc | `enforced` |
| `VENDOR-14` | Điều hướng nội bộ là một hành động, không bao giờ là `href` | `enforced` |

---

## `VENDOR-1` — mỗi primitive vendor có một chủ sở hữu có tên

**Tình huống.** Một component cần một thứ mà thư viện đã có: nút, dialog, dropdown, card. Câu hỏi
không phải "thư viện có cái đó không", mà "**file này** có phải chỗ sở hữu cái đó không".

**Dấu hiệu nhận biết**

- Dòng import thư viện xuất hiện trong một file không nằm trong danh sách đóng.
- Component đang ở tầng block, composite, layout hoặc page mà lại nói chuyện trực tiếp với vendor.
- Lý do được nêu là *tiện*, *nhanh*, *chỉ chỗ này thôi*.

**Tự hỏi.** Nếu ngày mai thư viện đổi API, ai là người phải sửa? Nếu câu trả lời không phải một file
duy nhất có tên, thì import này đang ở sai chỗ.

**Ranh giới**

- ↔ `VENDOR-2`: `VENDOR-1` hỏi *file này có được import không*; `VENDOR-2` hỏi *thư mục shell có
  đúng bốn thành viên không*. Một file mới trong `shells/` vi phạm `VENDOR-2` kể cả khi nó import
  vendor một cách hợp lệ.
- ↔ `VENDOR-5`: nếu package đang import là thư viện **glyph**, đây không phải `VENDOR-1`. Ranh giới
  đó thuộc module icon.

**Tình huống nghiệp vụ hay gặp.** Một block cần tooltip · một layout cần progress bar · một page cần
skeleton · một composite cần badge · một overlay cần divider vendor · một branch mới muốn "chỉ mượn"
một wrapper.

---

## `VENDOR-2` — `shells/` đóng, và shell rỗng cũng sai

**Tình huống.** Có thứ cần một slot `children` thật — một khối markup đã dựng sẵn, truyền thẳng vào
cơ chế vendor. Chỉ shell được phép nhận slot đó, và số shell là bốn.

**Dấu hiệu nhận biết**

- Có đề xuất tạo file thứ năm trong `shells/`, thường tên là `SomethingShell`.
- Có một file trong `shells/` không import vendor nào và cũng không phải framework shell.
- Lý do được nêu là "nó cần một children slot tuỳ ý" — chính câu đó **không** tạo ra shell mới.

**Tự hỏi.** File này đang sở hữu một **cơ chế** (dialog, drawer, popover, route segment) hay chỉ đang
sở hữu **nội dung**? Sở hữu nội dung thì nó là branch, và branch dùng `contract + render`.

**Ranh giới**

- ↔ `VENDOR-1`: xem trên.
- ↔ `VENDOR-4`: một `CardShell` vi phạm cả hai — `VENDOR-2` vì nó là thành viên thứ năm, `VENDOR-4`
  vì cái nó định sở hữu vốn không phải một cơ chế.
- **Ngoại lệ đóng:** `RouteShell` thoả `VENDOR-2` mà không import vendor, vì cơ chế nó sở hữu là của
  **framework**. Bắt nó import một primitive để "cho giống" là dạy người ta thêm nhiễu.

**Tình huống nghiệp vụ hay gặp.** Đề xuất `SheetShell` cho bottom sheet · `PopoverShell` cho tooltip
lớn · `CardShell` cho mặt card · một `TabsShell` vì tabs "cũng có children" · một file cũ được chuyển
vào `shells/` cho gọn.

---

## `VENDOR-3` — surface branch giữ ruột có kiểu

**Tình huống.** Một branch được phép nhập wrapper vendor (Card, Accordion). Nó lập tức trở thành
chỗ hấp dẫn để nhận luôn `children`, vì wrapper vendor vốn nhận `children`.

**Dấu hiệu nhận biết**

- Data type của branch mọc thêm `children`.
- Tham số component được destructure ra `children`.
- Lý lẽ được nêu: "vendor cho phép mà".

**Tự hỏi.** Quyền import wrapper đến từ đâu? Nó đến từ việc branch này **chiếu một contract có kiểu**
vào thân vendor. Bỏ contract đi thì quyền ấy cũng không còn lý do tồn tại.

**Ranh giới**

- ↔ `VENDOR-2`: chỉ shell mới có slot `children` không diễn giải. Surface branch có wrapper nhưng
  **không** có slot đó.
- ↔ `VENDOR-4`: `VENDOR-3` nói về **ruột**; `VENDOR-4` nói về **ai giữ wrapper**.

**Tình huống nghiệp vụ hay gặp.** Card cần "chèn nhanh một đoạn tuỳ ý" · accordion muốn nhận sẵn một
danh sách đã render · form card nhận luôn một `<form>` dựng ở nơi khác · list card nhận mảng node
thay vì mảng dữ liệu.

---

## `VENDOR-4` — không có `CardShell`

**Tình huống.** `Card > Card.Content` trông giống một cơ chế: có wrapper, có phần thân. Nhìn hình
dáng, nó gợi ý một shell. Nhìn **quyền sở hữu**, nó chỉ là cú pháp bọc.

**Dấu hiệu nhận biết**

- Xuất hiện một file tên `CardShell`, hoặc một branch trung gian chỉ để bọc `Card`.
- Có hai lớp cùng nhận là "mặt card": một lớp bọc và một lớp nội dung.

**Tự hỏi.** Lớp này có sở hữu **hành vi** nào không — mở, đóng, focus trap, portal, cuộn? Nếu không,
nó không phải shell; nó là cú pháp.

**Ranh giới**

- ↔ `VENDOR-2`: `VENDOR-2` cấm thành viên thứ năm nói chung; `VENDOR-4` nói riêng vì sai lầm này lặp
  lại nhiều nhất và có vẻ ngoài hợp lý nhất.
- ↔ `VENDOR-3`: một `CardShell` gần như luôn kéo theo một slot `children`, tức là kéo theo cả
  `VENDOR-3`.

**Tình huống nghiệp vụ hay gặp.** "Tách phần bọc card ra cho dùng lại" · "làm một shell để chỗ nào
cần card cũng gọi được" · một layer trung gian sinh ra vì hai màn hình cần card khác nhau một chút.

---

## `VENDOR-5` — thư viện glyph có ranh giới riêng

**Tình huống.** Icon cũng là vendor, cũng là import, cũng nằm trong cây component. Nhưng luật này
**không** giữ nó, và đó là quyết định có chủ ý.

**Dấu hiệu nhận biết**

- Một import từ package glyph, không phải package component.
- Có lập luận rằng "vendor boundary đã lo rồi".

**Tự hỏi.** Rule nào đọc được dòng import này? Nếu câu trả lời là "cái rule ở kia chắc cũng bắt", thì
chưa ai bắt cả.

**Ranh giới**

- ↔ `VENDOR-1`: một rule đặt tên một vendor thì bảo vệ **một** vendor. Khoảng trống giữa hai rule như
  vậy là chỗ một glyph từng được import thẳng, ở một kích thước không tồn tại ở đâu khác, và không có
  gì báo.

**Tình huống nghiệp vụ hay gặp.** Caret của một dropdown tự chế · icon trạng thái trong một block ·
mũi tên trong nút "xem thêm" · logo mạng xã hội ở footer.

---

## `VENDOR-6` — `ModalShell` có một scroll body zero-inset

**Tình huống.** Dialog cần vùng cuộn. Thân vendor **là** vùng cuộn đó. Nó không phải mặt nội dung thứ
hai, và nó không được thêm inset của riêng mình.

**Dấu hiệu nhận biết**

- Thân vendor biến mất và shell tự dựng một `div` cuộn.
- Thân vendor mang padding, trong khi contract bên trong cũng có padding — nội dung bị đẩy vào hai
  lần.
- Trong dialog xuất hiện hai lớp cùng trông như "mặt".

**Tự hỏi.** Ai sở hữu layout của nội dung này — shell hay contract đang được mount? Nếu là contract,
thân vendor phải là zero-inset.

**Ranh giới**

- ↔ `VENDOR-12`: `VENDOR-6` nói về **shell**; `VENDOR-12` nói về **màn auth** dùng shell đó. Sửa
  đúng một trong hai mà bỏ cái còn lại thì dải padding thứ hai vẫn quay lại.
- ↔ `VENDOR-8`: `VENDOR-8` cấm mount thêm một mặt bounded; `VENDOR-6` cấm shell tự tạo mặt thứ hai.

**Tình huống nghiệp vụ hay gặp.** Dialog xác nhận · dialog form dài phải cuộn · dialog đăng nhập ·
dialog xem trước có ảnh · dialog nhiều bước.

---

## `VENDOR-7` — Field nhà cố định variant input

**Tình huống.** Field nhà luôn đứng trong một mặt đã bounded: trong dialog, trong card, trong form
card. Variant mặc định của input vẽ ra một mặt cạnh tranh với mặt đang chứa nó.

**Dấu hiệu nhận biết**

- Data type của field mọc thêm một prop kiểu `variant`, `appearance`, `surface`.
- Có một chỗ gọi field truyền variant khác để "cho hợp màn này".
- Input trong dialog trông nổi hơn chính dialog.

**Tự hỏi.** Người gọi có đang được trao một lựa chọn thẩm mỹ mà họ không có dữ kiện để quyết không?
Nếu có, đó là một slot phải đóng lại.

**Ranh giới**

- ↔ `VENDOR-9`: `VENDOR-7` nói về **mặt** của ô nhập; `VENDOR-9` nói về **label** của nó. Hai chỗ
  khác nhau, hai kiểu trang trí khác nhau.
- ↔ `VENDOR-3`: `VENDOR-7` không phải chuyện ruột hay contract; nó là chuyện một giá trị bị cố định
  ở chủ sở hữu.

**Tình huống nghiệp vụ hay gặp.** Form đăng nhập trong dialog · form thanh toán trong card · ô tìm
kiếm trong panel · form hồ sơ trong tab · form lọc trong drawer.

---

## `VENDOR-8` — overlay đã là vật bounded

**Tình huống.** Overlay tự nó đã là một mặt có viền, có nền, có bóng. Mount một surface branch vào
trong là bọc một mặt bằng một mặt.

**Dấu hiệu nhận biết**

- File trong `overlays/` import một trong bốn surface branch có tên.
- Trong dialog nhìn thấy hai đường viền lồng nhau.
- Lý do được nêu: "cần nhóm mấy dòng này lại cho gọn".

**Tự hỏi.** Nếu bỏ card bên trong đi, người đọc có mất thông tin gì không? Nếu chỉ mất đường viền,
thì cái cần là heading và khoảng cách, không phải một mặt nữa.

**Ranh giới**

- ↔ `VENDOR-6`: `VENDOR-6` là mặt thứ hai do **shell** tạo ra; `VENDOR-8` là mặt thứ hai do **nội
  dung** mang vào.
- ↔ `VENDOR-3`: `VENDOR-8` không cấm surface branch tồn tại — chúng hợp lệ trên nền trang. Nó cấm
  đúng một vị trí.

**Tình huống nghiệp vụ hay gặp.** Dialog cài đặt gom từng nhóm vào card · drawer bộ lọc bọc mỗi nhóm
một card · dialog xác nhận đặt tóm tắt vào card · dialog nhiều bước bọc từng bước.

---

## `VENDOR-9` — label của field chỉ có chữ

**Tình huống.** Ô email "nên có" icon phong bì, ô mật khẩu "nên có" ổ khoá, ô mã "nên có" một dấu
sao. Cả ba đều suy ra từ **kiểu input**, và cả ba đều không nói thêm điều gì mà chữ chưa nói.

**Dấu hiệu nhận biết**

- Có một map từ `kind` sang tên icon.
- Glyph nằm **bên trong** thẻ label, trước chữ.
- Glyph không bấm được, không có nhãn, không có hành động.

**Tự hỏi.** Glyph này có **hành động riêng** không? Nếu không bấm được thì nó chỉ đang lặp lại chữ
bên cạnh.

**Ranh giới**

- ↔ `VENDOR-7`: xem trên.
- **Ngoại lệ đóng:** một glyph sở hữu hành động riêng — ví dụ hiện/ẩn mật khẩu — thì hợp lệ, và chủ
  sở hữu là **hành động** đó, không phải label.

**Tình huống nghiệp vụ hay gặp.** Form đăng nhập · form đăng ký · form thanh toán · form hồ sơ · form
đổi mật khẩu · ô nhập mã OTP.

---

## `VENDOR-10` — `TextLink` là Link của vendor

**Tình huống.** Một chữ trông như link. Vẽ nó bằng `button` cộng `hover:underline` mất khoảng năm
giây và mất toàn bộ hành vi: focus ring, thứ tự bàn phím, trạng thái visited, hành vi cảm ứng.

**Dấu hiệu nhận biết**

- Trong leaf có `<button>` mà lại đang đóng vai link.
- Có `className` chứa `hover:` hoặc `underline` viết tay.
- Không có import `Link` từ vendor.

**Tự hỏi.** Ai sở hữu trạng thái tương tác của chữ này? Nếu câu trả lời là "class tôi tự viết", thì
mọi trạng thái không được viết ra đều đang thiếu.

**Ranh giới**

- ↔ `VENDOR-14`: `VENDOR-10` nói về **cái gì vẽ ra link**; `VENDOR-14` nói về **link đi đâu**. Một
  chữ có thể đúng `VENDOR-10` (dùng Link của vendor) mà vẫn sai `VENDOR-14` (gắn `href` nội bộ).
- ↔ `VENDOR-1`: `VENDOR-10` là một trường hợp riêng có tên, vì nó là chỗ hay bị bỏ qua nhất.

**Tình huống nghiệp vụ hay gặp.** "Quên mật khẩu?" · "Điều khoản dịch vụ" · "Xem tất cả" · link trong
một dòng trợ giúp · link trong toast · link trong empty state.

---

## `VENDOR-11` — cơ chế dropdown và ý nghĩa tài khoản là hai chủ

**Tình huống.** Một icon tài khoản mở ra một menu. Trong đó có **hai** thứ hoàn toàn khác nhau: cơ
chế popover của vendor, và ý nghĩa sản phẩm (khách là ai, có những lựa chọn nào).

**Dấu hiệu nhận biết**

- Block sản phẩm import vendor trực tiếp.
- Block sản phẩm import các mảnh `Section`, `Item` của shell rồi tự ráp giải phẫu.
- Nav gắn thẳng hành động vào icon tài khoản, bỏ qua menu.
- Bấm vào tài khoản là nhảy thẳng vào một chế độ auth, không đi qua bản tóm tắt khách.

**Tự hỏi.** Câu nào trong file này là **cơ chế** (mở, đóng, đặt vị trí, điều hướng bàn phím) và câu
nào là **ý nghĩa** (khách là ai, chọn được gì)? Hai loại câu đó phải ở hai file.

**Ranh giới**

- ↔ `VENDOR-2`: shell được phép nhập vendor; đây là chuyện block **không** được.
- ↔ `VENDOR-14`: lựa chọn trong menu báo hành động, không mang `href`.

**Tình huống nghiệp vụ hay gặp.** Menu tài khoản khi chưa đăng nhập · menu tài khoản khi đã đăng nhập
· menu ngôn ngữ · menu "thêm" trên một row · menu thao tác hàng loạt.

---

## `VENDOR-12` — auth projection có một host zero-inset

**Tình huống.** Màn auth đi qua ba lớp: shell cấp vùng cuộn, panel sở hữu cột nội dung, overlay chiếu
panel ấy ra. Mỗi lớp đều **có thể** thêm padding dọc. Chỉ một lớp được phép.

**Dấu hiệu nhận biết**

- Overlay mở thêm một `Tree` quanh thứ đã có host.
- Cột nội dung mọc thêm `py-*`, `pt-*`, `pb-*`.
- Nội dung auth bị đẩy xuống, khoảng trắng trên và dưới không bằng nhau.

**Tự hỏi.** Đếm xem có bao nhiêu lớp đang khai báo inset dọc trên cùng một trục. Nếu nhiều hơn một,
dải padding thứ hai đã hình thành.

**Ranh giới**

- ↔ `VENDOR-6`: `VENDOR-6` giữ **shell** zero-inset; `VENDOR-12` giữ **màn dùng shell đó** không
  thêm inset. Cần cả hai.
- ↔ `VENDOR-8`: `VENDOR-8` cấm mount một mặt; `VENDOR-12` cấm nhân đôi một **host**.

**Tình huống nghiệp vụ hay gặp.** Dialog đăng nhập · dialog đăng ký · dialog quên mật khẩu · dialog
xác thực hai lớp · panel auth nhúng trong một trang.

---

## `VENDOR-13` — compound control giữ đủ giải phẫu

**Tình huống.** Compound control của vendor có nhiều mảnh, và **thứ tự lồng** mới là cái làm nó hoạt
động. Ráp sai vẫn ra một thứ trông gần đúng, và đó là chỗ nguy hiểm.

**Dấu hiệu nhận biết**

- `Control` và `Content` là anh em thay vì lồng nhau.
- Chữ hiển thị nằm ngoài vùng bấm — bấm vào chữ không toggle.
- Chữ được truyền thẳng vào root: có accessible name nhưng **không vẽ ra ô** nào.

**Tự hỏi.** Có hai kiểu hỏng ở đây: hỏng **hình** và hỏng **tương tác**. Một test truy vấn theo
semantic có thể xanh trong cả hai. Đã kiểm bằng gì?

**Ranh giới**

- ↔ `VENDOR-1`: `VENDOR-1` nói *ai được import*; `VENDOR-13` nói *chủ sở hữu ấy phải ráp cho đúng*.
  Import đúng chỗ vẫn ráp sai được.
- ↔ `VENDOR-9`: cả hai đều là "trông có vẻ ổn nhưng thiếu", nhưng `VENDOR-9` là thừa trang trí, còn
  `VENDOR-13` là thiếu cấu trúc.

**Tình huống nghiệp vụ hay gặp.** Checkbox điều khoản · checkbox ghi nhớ đăng nhập · checkbox chọn
hàng loạt trong bảng · radio trong quiz · switch trong cài đặt.

---

## `VENDOR-14` — điều hướng nội bộ là một hành động

**Tình huống.** Một control đưa người dùng sang chỗ khác **trong** ứng dụng. Component thuần báo một
id hoặc một `on.press`; chủ sở hữu đã kết nối giữ đường dẫn và gọi router.

**Dấu hiệu nhận biết**

- Một `href` bắt đầu bằng `/`, hoặc trỏ về chính host công khai của ứng dụng.
- Một leaf chỉ dùng nội bộ lại **khai báo** trường `href` trong data type.
- Một object dữ liệu có `href` hoặc `externalHref` mang giá trị nội bộ.

**Tự hỏi.** Component này có biết đường đi không? Nó **không nên** biết. Biết đường đi là việc của
lớp đã kết nối.

**Ranh giới**

- ↔ `VENDOR-10`: xem trên. Đúng `VENDOR-10` không miễn `VENDOR-14`.
- **Ngoại lệ đóng:** đích **ngoài** ứng dụng là `href` thật. Ép một URL ngoài đi qua router là lỗi
  ngược lại.
- Luật áp cả khi control **trông và mang ngữ nghĩa** là một link: brand, navbar, tabs, dòng pháp lý.

**Tình huống nghiệp vụ hay gặp.** Logo về trang chủ · mục navbar · tab đổi màn · "Xem tất cả" · dòng
điều khoản dưới form đăng ký · breadcrumb · thẻ khoá học bấm được · nút quay lại.

---

## Luật

1. Danh sách chủ sở hữu là **đóng**: `leaves/`, bốn shell, bốn surface branch có tên. Thêm vào là một
   rule change, không phải một quyết định tại chỗ.
2. Soi **hai chiều**: non-owner import vendor là lỗi; owner không import gì cũng là lỗi đó nhìn từ
   phía kia.
3. Wrapper không nới ruột. Sở hữu `Card` cho một wrapper, **không** cho một lỗ `children`.
4. Một primitive vendor được bung ra ở **một** chỗ. Người gọi truyền dữ liệu có kiểu, không ráp lại
   giải phẫu vendor.
5. Thân vendor và contract không cùng đòi inset.
6. Cơ chế vendor và ý nghĩa sản phẩm là **hai chủ sở hữu**, kể cả khi chúng vẽ ra một control.
7. Compound control chỉ hoàn chỉnh ở đúng thứ tự lồng bắt buộc. Accessible name truy vấn được **không**
   phải bằng chứng nó đã vẽ ra thứ gì.
8. Điều hướng nội bộ là hành động; `href` dành cho đích ngoài ứng dụng.
9. Mỗi package vendor được đúng **một** module rule bảo vệ. Package không module nào gọi tên là
   package không được bảo vệ.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp
vào.

- **Ngoài cây component.** `VENDOR-1` không áp cho provider dựng thư viện cho cả ứng dụng. Cấu hình
  một lần khác với việc một component với tay lấy widget.
- **File test.** File `.test.` / `.spec.` được miễn nửa soi-vào-trong của `VENDOR-1`/`VENDOR-2`. Một
  test mount primitive không phải một component thường đang đòi tầng.
- **Framework shell.** `RouteShell` thoả `VENDOR-2` mà không import vendor, vì cơ chế nó sở hữu là
  của framework: route segment layout được trao page dưới dạng `children`, không tầng nào dưới shell
  được nhận slot ấy, và một server component không chuyển đổi được vì hàm không serialise qua ranh
  giới đó.
- **Đích ngoài ứng dụng.** `VENDOR-14` không áp cho URL ngoài. Đó là `href` thật.
- **Glyph có hành động riêng.** `VENDOR-9` chấp nhận một glyph sở hữu hành động của chính nó, ví dụ
  hiện/ẩn mật khẩu. Chủ sở hữu là hành động, không bao giờ là label.
- **Glyph package.** `VENDOR-5` là một ngoại lệ được ghi thành mã: luật này cố ý **không** giữ thư
  viện glyph, và cái giá của việc đó được ghi trong `audit.md`.
