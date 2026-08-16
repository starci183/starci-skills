---
id: fe-lints-props-and-slots-vi
title: vi.md
slug: /fe/lints/props-and-slots/vi
sidebar_label: vi.md
sidebar_position: 1
description: Ba rule của luật props và slot, đọc bằng nghiệp vụ, kèm cửa còn mở của từng rule.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `props-and-slots`

Luật này **phần lớn do KIỂU giữ, không phải do rule giữ**. Bộ alias slot chính là hàng rào: thêm slot
thứ năm không phải là bị bắt lỗi khi review, mà là không biên dịch được. Vì vậy mô-đun rule ở đây rất
nhỏ — chỉ còn ba thứ mà kiểu không nhìn thấy:

1. một hình dạng **không có tên**;
2. một shape props **viết tay**, nơi alias không còn chặn được slot thứ tư;
3. một thuộc tính mở thêm **làn dữ liệu thứ hai** ngay tại chỗ gọi.

Danh tính của một rule là **tên nó công bố**. Không có mã số riêng cho rule; tên đó là chuỗi xuất
hiện trong log build, trong comment tắt rule và trong mọi cuộc trao đổi về lần đỏ đó.

## Bảng tra nhanh

| Rule | Mã luật | Bắt gì |
|---|---|---|
| `no-inline-parameter-type` | `SLOTS-3` | Tham số của một hàm khai báo kiểu là object vô danh — viết thẳng, bọc ngoặc, hay nằm trong giao/hợp |
| `no-children-slot` | `SLOTS-4` | Thuộc tính `children` trong file thành phần bị quản, dù khai trong kiểu hay tách ngay tại tham số |
| `no-surface-list-items-slot` | `SLOTS-7` | Thuộc tính JSX `items` đặt lên phần tử gắn với import `SurfaceListCard` |

Bốn mã còn lại của luật — `SLOTS-1`, `SLOTS-2`, `SLOTS-5`, `SLOTS-6` — **không có rule trong mô-đun
này**. Hai mã đầu do hàng rào kiểu giữ; hai mã sau hiện không ai giữ và được ghi ở
[`audit.md`](./audit.md), chứ không được ngầm hiểu là đã có máy canh.

---

## `no-inline-parameter-type`

**Bắt gì?** Một tham số hàm mà kiểu khai báo của nó chứa object vô danh. Bắt cả bốn loại hàm: mũi
tên, biểu thức hàm, khai báo hàm, và chữ ký hàm không thân.

**Giữ mã nào?** `SLOTS-3` — hình dạng của một tham số phải có tên.

**Phát hiện thế nào?** Đọc `param.typeAnnotation.typeAnnotation` rồi hỏi một câu duy nhất: đây có phải
hình dạng vô danh không? `TSTypeLiteral` là có. `TSParenthesizedType` thì đi tiếp vào trong.
`TSIntersectionType` và `TSUnionType` thì duyệt từng thành viên, **một** thành viên vô danh là đủ.
Ngoài ba nhánh đó, không đi đâu nữa. Rule này **không lọc theo tên file** và **không có thông tin
kiểu**.

**Vì sao nên để máy giữ luật này?** Alias chặn được slot thứ tư, nhưng không chặn được một shape
**không có tên**. Một object vô danh đặt tại tham số thoả mãn mọi ràng buộc mà alias áp lên, và vẫn
sai — cái sai không nằm ở chỗ có trường nào, mà ở chỗ **không thứ gì khác trỏ tới nó được**: không
import được, bài kiểm thử song sinh không tham chiếu được, người đi tìm "thành phần này nhận gì"
không tra ra. Trình biên dịch không có ý kiến gì về việc một hình dạng có tìm được hay không. Đó
đúng là khoảng trống mà một rule phải lấp.

**Những chỗ còn lọt.**

- `Readonly<{ … }>`, `Partial<{ … }>`, `Array<{ … }>`, `{ … }[]`: hàm kiểm tra chỉ đi qua type
  literal, ngoặc, giao và hợp. Một `TSTypeReference` mang object vô danh trong đối số kiểu, hay một
  `TSArrayType` bọc ngoài, **không bị nhìn tới**. Đây là cửa dễ vô tình đi qua nhất, vì viết
  `Readonly<…>` là thói quen bình thường.
- Ràng buộc của tham số kiểu: `<T extends { label: string }>(input: T)`. Kiểu tại tham số là một
  tham chiếu tới `T`; hình dạng vô danh nằm ở chỗ rule không bao giờ ghé.
- `TSFunctionType`: một shape props giấu trong kiểu callback không nằm trong danh sách node được
  duyệt.
- Ép kiểu trong thân hàm: `input as { label: string }` nằm ngoài phạm vi hoàn toàn.
- Tham số **không khai kiểu**: không có gì để soi. Kiểu vô danh có thể tới từ ngữ cảnh gán.
- Không có cổng tên file: rule chạy trên **mọi** file trong glob, kể cả file tiện ích, script và
  kiểm thử — rộng hơn hẳn cái tên gợi ra.

---

## `no-children-slot`

**Bắt gì?** Một slot `children` trong file thành phần bị quản — dù nó được khai như một thuộc tính
trong kiểu, hay được tách trực tiếp tại tham số của hàm.

**Giữ mã nào?** `SLOTS-4` — có `contract` và `render` mới là container; `children` thì không.

**Phát hiện thế nào?** Trước hết là một cổng theo tên file, chuẩn hoá dấu gạch chéo:

- file bảng đăng ký hợp đồng: **miễn**;
- bốn thư mục shell `ModalShell`, `DrawerShell`, `DropdownShell`, `RouteShell`: **miễn**;
- còn lại, đường dẫn phải nằm dưới một trong các gốc thành phần, **trừ** gốc `src` trần.

Qua cổng rồi thì rule soi hai node. `TSPropertySignature` có khoá là định danh tên `children` thì
báo. `Property` thì phải có cha là `ObjectPattern` (tức là đang tách cấu trúc, không phải đang dựng
object), và phải **không** có ông là `VariableDeclarator` (tức là tách tại tham số, không phải tách
trong thân hàm), rồi mới báo.

**Vì sao nên để máy giữ luật này?** Đây là chỗ **kiểu bó tay**. Alias từ chối slot thứ tư trên những
alias mà nó định nghĩa, nhưng không có gì cấm một file tự khai shape props bằng tay rồi đặt
`children` vào đó. Thứ mà alias làm cho **không biểu diễn được**, một interface viết tay lại làm cho
thành **chuyện thường**. Và hệ quả không nhỏ: `children` nhận vào phần giao diện **đã dựng xong** —
một `.map`, một biểu thức ba ngôi, một cây con không ai đặt tên — nên bên trong một container chứa gì
sẽ vĩnh viễn không phát biểu được ở đâu cả.

**Những chỗ còn lọt.**

- Kế thừa: `interface CardProps extends PropsWithChildren<CardData> {}`. Trong file không hề có chữ
  ký thuộc tính nào tên `children`, và rule không có thông tin kiểu để lần theo.
- Không tách cấu trúc: `(props: CardProps) => <div>{props.children}</div>`. Không `Property` nào
  chạy; nếu kiểu được import thì cũng không chữ ký nào chạy. Slot vẫn tới, vẫn dùng, file vẫn xanh.
- Tách trong thân hàm: `const { children } = props` được **miễn có chủ ý**. Ghép với một kiểu import
  là file sạch tín hiệu.
- Khoá dạng chuỗi: `{ "children"?: ReactNode }`. Cả hai node đều đòi khoá là định danh.
- Đổi tên: `body`, `content`, `slot`, `inner`. Rule cấm **một chữ**; luật cấm **giao diện đã dựng
  sẵn**. Đổi tên là đi qua sạch sẽ.
- Ngoài gốc thành phần: gốc `src` trần bị bỏ khỏi cổng, nên một cây thành phần đặt chỗ khác thì không
  ai canh.
- Miễn theo thư mục không phải miễn theo danh tính: một thành phần mới đặt nhờ vào thư mục shell hay
  vào file bảng đăng ký sẽ hưởng chung phần miễn mà hàng xóm của nó được cấp.

---

## `no-surface-list-items-slot`

**Bắt gì?** Thuộc tính JSX `items` đặt lên một phần tử mà tên của nó đang gắn với import
`SurfaceListCard`.

**Giữ mã nào?** `SLOTS-7` — một bề mặt danh sách nhận bộ sưu tập nghiệp vụ qua `props` có tên thật,
không qua làn `items` chung chung.

**Phát hiện thế nào?** Ba bước, tất cả đều là so khớp cú pháp:

1. tên file phải chứa `/src/`;
2. gom các ràng buộc tên từ `ImportDeclaration` có nguồn khớp đúng mẫu kết thúc bằng
   `components/branches/SurfaceListCard`, và chỉ giữ specifier có tên nhập đúng là `SurfaceListCard`
   — lưu lại **tên cục bộ**, nên đặt bí danh vẫn bị bắt;
3. tại `JSXOpeningElement`, tên phần tử phải là định danh và phải nằm trong tập ràng buộc; sau đó
   duyệt các thuộc tính, thấy `items` thì báo cả thuộc tính.

**Vì sao nên để máy giữ luật này?** Một bề mặt danh sách dùng chung là **chủ nhà của hợp đồng, không
phải mô hình dữ liệu**. Thêm một slot `items` ở cấp cao nhất là mở làn dữ liệu chạy song song với
`props` và bắt bề mặt dùng chung phải biết bộ sưu tập của từng bên gọi. Kiểu không chặn được, vì
`items` là một prop hợp lệ như mọi prop khác; chỉ có chỗ gọi mới lộ ra là đã có hai làn.

**Những chỗ còn lọt.**

- Trải object: `<SurfaceListCard {...config} />` với `config` mang `items`. Vòng lặp bỏ qua mọi thứ
  không phải `JSXAttribute`. `{...{ items }}` cũng vậy. Một phím là qua.
- Dạng import khác: import mặc định, import namespace, tái xuất qua barrel, nguồn kết thúc bằng
  `/index`, hay import anh em không đánh vần `components/branches/`. Bất kỳ dạng nào cũng khiến tập
  ràng buộc rỗng và rule im lặng **cho cả file**.
- Bọc một lớp: `const ListCard = (p: P) => <SurfaceListCard {...p} />`. File bọc qua được vì làn tới
  bằng trải; file gọi qua được vì `ListCard` không phải tên đang theo dõi.
- Đổi tên làn: `rows`, `entries`, `records`, `data`. Vẫn là làn thứ hai, vẫn qua.
- Không dùng JSX: gọi hàm tạo phần tử trực tiếp thì không có `JSXOpeningElement` nào.
- Phía khai báo không bị canh: nếu chính kiểu props của bề mặt mọc ra `items`, không file nào báo cho
  tới khi có người dùng tới nó — và chỉ khi file đó khớp mẫu import.

---

## Luật

1. Danh tính của rule là **tên công bố**. Không đặt thêm mã số cho rule.
2. Chỉ ghi vào shelf này những rule **có thật** trong nguồn. Rule "đáng lẽ nên có" là đề xuất, ghi ở
   `audit.md`.
3. Mỗi rule ánh xạ đúng **một** mã luật. Rule không giữ mã nào là một phát hiện, không phải chỗ để
   bịa ra ánh xạ.
4. Cả ba rule chạy ở mức `error`. Chúng bắt theo **hình dạng cú pháp**, không theo phán đoán, nên
   không có rủi ro báo nhầm đủ lớn để hạ xuống mức cảnh báo.
5. Không rule nào đọc thông tin kiểu. Mọi thứ nằm ở file khác đều **mờ**.
6. Bảng **cửa còn mở** là bắt buộc. Một rule được báo là "kín" mà không nói rõ cái gì lọt qua chính
   là thất bại mà shelf này sinh ra để chặn.

## Ngoại lệ

Ngoại lệ là **một phần của cách thực thi**, không phải chỗ lách. Mỗi ngoại lệ đều đóng và nói rõ nó
áp cho rule nào.

- **Bảng đăng ký hợp đồng** miễn `no-children-slot`. `children` ở đó không phải cái lỗ nhận giao diện
  dựng sẵn; nó là **ngữ pháp con có tên** thay thế cho cái lỗ ấy. Báo lỗi ở đó tức là bắt chính file
  đã xoá bỏ slot vô danh phải thôi mô tả thứ nó cho phép.
- **Bốn shell** miễn `no-children-slot`. Ba shell đầu chuyển thẳng phần bên trong cho cơ chế của thư
  viện bên dưới và **không sắp xếp gì**; shell còn lại chuyển đổi phần children mà một layout của
  framework trao cho.
- **Mọi thứ ngoài gốc thành phần** nằm ngoài `no-children-slot`. Một trang nhận children là đúng việc
  của trang.
- **Tham số không khai kiểu** nằm ngoài `no-inline-parameter-type`. Tách cấu trúc không khai kiểu là
  câu hỏi khác, thuộc luật khác.
- **Tham số vô hướng có tên** không phải hình dạng không có chỗ đọc ra, nên không bị báo.
