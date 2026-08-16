# ranh giới nhà cung cấp

## Định nghĩa

Quyền sở hữu của nhà cung cấp là một danh sách đóng:

-`leaves/`nguyên thủy khép kín của riêng mình;
-`ModalShell`, `DrawerShell`, Và`DropdownShell`cơ chế nhà cung cấp khép kín của riêng mình và duy nhất chưa được giải thích`children`khe cắm;
-`SurfaceCard`, `SurfaceAccordionCard`, `SurfaceListCard`, Và`SurfaceFormCard`trình bao bọc của nhà cung cấp riêng dự án
  hợp đồng nội dung đã gõ vào cơ thể nhà cung cấp.

Mọi thứ khác đều do những chủ sở hữu đó sáng tác. Một nhà cung cấp bên ngoài cây thành phần có thể chịu trách nhiệm về thư viện
lên cho ứng dụng; đó không phải là một thành phần đạt tới một widget.

Điều giữ luật này là[`sources/fe/vendor-boundary.mjs`](../../../sources/fe/vendor-boundary.mjs).

Implementation anchors in `starci-academy-fe`: `src/components/leaves/Button/index.tsx`,
`src/components/shells/ModalShell/index.tsx`, Và`src/components/branches/SurfaceListCard/index.tsx`.

## Quy tắc

**VENDOR-1 · Mỗi nhà cung cấp nguyên thủy đều có một chủ sở hữu được đặt tên.**

**VENDOR-2 · `shells/` chỉ dành cho ModalShell, DrawerShell và DropdownShell.** Tệp thứ tư không trở nên hợp lệ
được thực hiện hợp pháp bằng cách nhập khẩu nhà cung cấp.

**VENDOR-3 · Các nhánh bề mặt giữ nội thất được đánh máy.** Thẻ nhập hoặc Accordion không cấp
phản ứng`children`; nội dung của họ vẫn còn`contract + render`.

**VENDOR-4 · Không có `CardShell`.** `Card > Card.Content` là cú pháp wrapper, không phải một policy mechanics độc lập
chính sách. Nhánh bề mặt được đặt tên sở hữu nó trực tiếp.

**VENDOR-5 · Thư viện Glyph có ranh giới riêng.**

**VENDOR-6 · ModalShell sở hữu một thân cuộn không có phần bên trong.**`Modal.Body`là cuộn giấy của nhà cung cấp
cơ chế cho cùng một hộp thoại chứ không phải bề mặt nội dung thứ hai. Nó gói gọn những điều chưa được giải thích`children`với`p-0`: hợp đồng được gắn sở hữu bố cục, trong khi Shell tiếp tục cuộn mà không cần thêm
phần chèn thứ hai.

**VENDOR-7 · Trường nhà sửa biến thể đầu vào có bề mặt giới hạn.** HeroUI của nó`Input`công dụng`secondary`; người gọi không nhận được vị trí xuất hiện và bề mặt trường mặc định không thể trả về
bên trong hộp thoại hoặc thẻ.

**VENDOR-8 · Lớp phủ không thể gắn trực tiếp nhánh bề mặt được đặt tên.** Lớp phủ đã là
đối tượng bị giới hạn.`SurfaceCard`, `SurfaceAccordionCard`, `SurfaceListCard`, Và`SurfaceFormCard`thuộc về mặt đất của trang,
không ở bên trong`overlays/**`.

**VENDOR-9 · Nhãn trường chỉ có văn bản.** Loại đầu vào không cấp phép cho email, khóa hoặc khóa trang trí
biểu tượng mã trước nhãn. Một glyph chỉ xuất hiện khi nó sở hữu một hành động riêng biệt, chẳng hạn như mật khẩu
khả năng hiển thị và sau đó hành động—không phải nhãn—sẽ sở hữu nó.

**VENDOR-10 · TextLink là HeroUI Link.** Ngữ nghĩa điều hướng, xử lý bàn phím, lấy tiêu điểm và di chuột
thuộc về nhà cung cấp nguyên thủy. Một nút thô có chữ viết tay`hover:underline`lớp học không phải là một
liên kết và không được bắt chước một.

**VENDOR-11 · Cơ chế thả xuống và ý nghĩa tài khoản có chủ sở hữu khác nhau.** Nhấn tài khoản
biểu tượng hiển thị tóm tắt về khách cùng với các lựa chọn Đăng nhập và Đăng ký; nó không nhảy trực tiếp vào một
chế độ xác thực.`DropdownShell`một mình nhập HeroUI Dropdown, chấp nhận dữ liệu mục/phần đã nhập cộng với một
bộ điều phối hành động và mở rộng chúng thành cơ chế kích hoạt/popover/menu/phần/mục.`AccountMenu`là một khối trên lớp vỏ đó vì nó sở hữu câu khách, các hành động nhóm và xác thực;
nó không được nhập các phần Phần hoặc Hạng mục và lắp ráp giải phẫu của nhà cung cấp.`ShellNav`soạn khối;
nó không giả mạo điều khiển bằng hành động biểu tượng trực tiếp.

**VENDOR-12 · Phép chiếu xác thực có một máy chủ không có sẵn.**`ModalShell`cung cấp cuộn không có nội dung
cơ thể,`AuthenticationPanel`sở hữu`centred-page-column`, Và`SignInOverlay`dự án nó với`ContractContent`. Gói lại hình chiếu trong`Tree`sao chép máy chủ hợp đồng; thêm`py-*`, `pt-*`, hoặc`pb-*`ĐẾN`centred-page-column`tạo lại dải đệm thứ hai.

**VENDOR-13 · Bộ điều khiển phức hợp HeroUI giữ nguyên cấu trúc cần thiết.** Hộp kiểm chưa hoàn tất
tại`Checkbox.Root`: `Checkbox.Content`kết thúc tốt đẹp`Checkbox.Control`(bao bọc`Checkbox.Indicator`) và nhãn nhìn thấy được. Kiểm soát và Nội dung như anh chị em có thể vẽ một dấu tích, nhưng
để lại các từ hiển thị bên ngoài mục tiêu nhấn của hộp kiểm. Truyền văn bản nhãn trực tiếp tới
root có thể giữ nguyên tên có thể truy cập trong khi không vẽ hộp nào cả, do đó cả hình ảnh và tương tác đều không
lỗi có thể ẩn đằng sau một điều khiển có thể truy vấn ngữ nghĩa.

**VENDOR-14 · Điều hướng StarCi nội bộ là một hành động, không bao giờ là href.** Các thành phần thuần túy báo cáo một
id hoặc`on.press`; chủ sở hữu được kết nối giữ đường dẫn và cuộc gọi`router.push`. Điều này áp dụng ngay cả khi
điều khiển là một liên kết trực quan và ngữ nghĩa, bao gồm thương hiệu, thanh điều hướng, tab và bản sao hợp pháp.`href`được dành riêng cho các điểm đến bên ngoài StarCi. Các lá chỉ dành cho nội bộ như`NavLink`,
`QuickActionRow`, `SeeMoreLink`và nhãn hộp kiểm kết hợp không được để lộ`href`lĩnh vực nào cả.

## Forbidden

| Không bao giờ | Vì sao bị từ chối | Thay vào đó |
|---|---|---|
| Vendor primitive không có owner được đặt tên | Không ai chịu trách nhiệm về vendor mechanics và boundary bị mở | Đặt primitive vào owner duy nhất của nó |
| Thêm file thứ tư vào `shells/` | Import vendor không tự tạo thêm một owner hợp lệ | Giữ `shells/` ở ModalShell, DrawerShell và DropdownShell |
| Cho `children` vào surface branch | Wrapper trở thành markup không được type và content contract biến mất | Dùng `contract + render` |
| Tạo `CardShell` | Nó biến wrapper syntax thành vocabulary mechanics thứ hai | Để named surface branch sở hữu wrapper |
| Đặt glyph vendor ngoài Icon leaf | Caller tự chọn vendor, family và size, tạo vocabulary thứ hai | Truyền meaning và role cho Icon |
| Thêm inset thứ hai vào auth projection | Một host đã sở hữu padding và layout; dải padding thứ hai làm sai contract | Giữ zero-inset host, `centred-page-column` và `ContractContent` |
| Cho internal navigation dùng `href` | Path và router bị đẩy vào pure component | Pure component báo id hoặc `on.press`; owner gọi `router.push` |

## Ví dụ

```tsx
import { Button as HeroButton } from "@heroui/react" // leaves/Button
import { Modal } from "@heroui/react"                // shells/ModalShell
import { Dropdown } from "@heroui/react"             // shells/DropdownShell
import { Card } from "@heroui/react"                 // branches/SurfaceCard
```

```tsx
// Wrong: an ordinary branch creates a new vendor owner.
import { Modal } from "@heroui/react" // branches/GenericPanel
```
