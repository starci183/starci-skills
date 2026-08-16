---
id: fe-lints-vendor-boundary-vi
title: vi.md
slug: /fe/lints/vendor-boundary/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng luật máy giữ ranh giới thư viện ngoài — bắt gì, phát hiện bằng gì, và còn hở chỗ nào.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `vendor-boundary`

Tài liệu này nói về **thứ máy nhìn thấy**, không nói về luật. Luật nằm ở tầng khác. Ở đây mỗi mục là
**tên luật đã công bố**, viết nguyên văn, vì đó chính là chuỗi mà bản build in ra, chuỗi nằm trong
comment tắt luật, và chuỗi mọi người gọi tên khi cãi nhau về một lần báo lỗi.

**Quy ước đọc.** Nguồn ghim thư viện ngoài bằng một tiền tố gói (hằng `VENDOR_PACKAGE_PREFIX`) và ở
vài luật là một định danh mô-đun chính xác — cổng React của gói đó. Trong tài liệu viết là
`<tiền-tố-vendor>` và `@vendor/react`. Thay đúng một chuỗi đó vào là mọi cơ chế mô tả bên dưới chạy
y nguyên.

## Bảng tra nhanh

| Tên luật | Mã luật | Bắt gì |
|---|---|---|
| `vendor-boundary` | `VENDOR-1`, `VENDOR-2` | Import thư viện ngoài ở thư mục không được sở hữu; thư mục vỏ mà không bọc gì; file lạ nằm trong thư mục vỏ |
| `modal-shell-owns-scroll-body` | `VENDOR-6` | Vỏ hộp thoại thiếu thân cuộn của thư viện, hoặc thân cuộn đó tự thêm khoảng đệm |
| `field-input-uses-secondary-variant` | `VENDOR-7` | Ô nhập của nhà không khoá biến thể bề mặt phụ |
| `field-label-is-text-only` | `VENDOR-9` | Có biểu tượng nằm trong nhãn của ô nhập |
| `no-surface-branch-in-overlay` | `VENDOR-8` | Lớp phủ import thẳng một trong bốn nhánh bề mặt |
| `text-link-uses-hero-link` | `VENDOR-10` | Lá liên kết tự vẽ link bằng nút thô hoặc class gạch chân, hoặc không mượn link của thư viện |
| `account-control-owns-dropdown` | `VENDOR-11` | Cơ chế thả xuống và ý nghĩa tài khoản bị gộp sai chủ; nút tài khoản tự mang hành động |
| `auth-overlay-owns-single-content-host` | `VENDOR-12` | Lớp phủ đăng nhập mở hai vật chứa nội dung, hoặc cột giữa tự thêm đệm dọc |
| `checkbox-keeps-compound-anatomy` | `VENDOR-13` | Điều khiển hợp thành mất cấu trúc lồng bắt buộc |
| `no-internal-starci-href` | `VENDOR-14` | Đích đến nội bộ viết thành `href`; hoặc lá chỉ-điều-hướng-nội-bộ khai báo `href` |

Mười luật công bố, mười luật ánh xạ được vào mã. Không luật nào giữ một mã mà văn bản luật không có.

---

## `vendor-boundary`

**Bắt gì?** Ba tình huống, hai chiều. Chiều ra: một file trong cây thành phần import thư viện ngoài
trong khi thư mục của nó không nằm trong danh sách được sở hữu — báo `outside`. Chiều vào: một file
nằm trong thư mục vỏ mà **không** import thư viện nào — báo `emptyShell`; và một file nằm trong thư
mục vỏ nhưng **không** phải một trong các vỏ đã đặt tên — báo `unknownShell`.

Chiều vào mới là lý do luật này là một chính sách chứ không phải một cái lỗ. Chiều ra thì hiển
nhiên. Chiều vào bắt cái khó thấy hơn: một thành phần bình thường ngồi trong thư mục vỏ đang giữ một
quyền miễn trừ mà nó không cần, và không có phép kiểm đó thì thư mục vỏ trở thành **chỗ chứa những
thứ khó xếp**. Thứ đầu tiên xin vào bao giờ cũng là thứ khó xếp.

**Giữ mã nào?** `VENDOR-1` và `VENDOR-2`.

**Phát hiện thế nào?** Đường dẫn được chuẩn hoá về dấu gạch chéo xuôi rồi kiểm bằng chuỗi con và biểu
thức chính quy: có chứa thư mục lá, khớp biểu thức bốn tên vỏ, hoặc khớp biểu thức bốn tên nhánh bề
mặt. Thư viện ngoài nhận ra bằng `ImportDeclaration` với `source.value` **bắt đầu bằng** tiền tố
gói. Ở `Program:exit`, hai biến luận ra từ đường dẫn được đối chiếu với một biến tích luỹ từ import.

**Vì sao nên để máy giữ luật này?** Vì chiều vào không ai tự soi được. Một người đọc diff nhìn thấy
một file mới trong thư mục vỏ sẽ đọc nó như một quyết định kiến trúc, chứ không đếm xem nó có bọc
cái gì không. Ranh giới quyền sở hữu là thứ chỉ hỏng dần: mỗi lần thêm một ngoại lệ hợp lý, và sau
mười lần thì danh sách đóng không còn đóng.

**Những chỗ còn lọt.**
- Chỉ `ImportDeclaration` được thăm. `import()` động, `require()`, và nhất là **re-export**
  (`export { X } from "<vendor>"`) là node khác. Re-export hở hai lần: thư viện vào mà không ai báo,
  và cái vỏ lấy hàng theo đường đó lại bị báo là rỗng.
- Một file barrel đặt trong thư mục lá, re-export cả thư viện, biến mọi import về sau thành một
  đường dẫn nội bộ hợp lệ.
- Quyền sở hữu = **nằm trong thư mục**. Dời một panel xếp nhầm vào thư mục lá là nó thành chủ hợp
  lệ; không có phép kiểm nào hỏi một lá có thật sự là nguyên thể đóng hay không.
- Cả luật phụ thuộc chuỗi `/src/components/` trong đường dẫn. Cây thành phần nằm chỗ khác thì luật
  **không tồn tại**, chứ không phải được miễn.

---

## `modal-shell-owns-scroll-body`

**Bắt gì?** Vỏ hộp thoại phải giữ đúng **một** thân cuộn của thư viện bọc quanh phần children mà nó
không diễn giải, và thân đó phải mang class không-đệm. Thiếu thân — báo `missing`. Thân có class
khác — báo `inset`, vì hợp đồng đã gắn vào tự sở hữu bố cục, cộng thêm đệm của thân là đệm hai lần.

**Giữ mã nào?** `VENDOR-6`.

**Phát hiện thế nào?** Cổng tên file khoá đúng một đường dẫn kết thúc bằng `ModalShell/index.tsx`. Mỗi
`JSXOpeningElement` có tên là biểu thức thành viên hai phần được ghép lại thành chuỗi và so với
`Modal.Body`. Phép kiểm đệm đọc thuộc tính `className` và đòi `value.type === "Literal"` với giá trị
đúng bằng `p-0`. `Program:exit` báo khi cả file chưa từng thấy thân nào.

**Vì sao nên để máy giữ luật này?** Vì đệm hai lần **không nhìn ra bằng mắt trong một ảnh chụp**.
Nó chỉ lộ ra khi nội dung dài tới mức phải cuộn, hoặc khi so hai hộp thoại cạnh nhau. Đây đúng loại
sai mà review người bỏ lọt còn máy thì không.

**Những chỗ còn lọt.**
- Đổi tên hoặc rã thành viên. Tên thành viên bị so như **văn bản**; vẽ cùng cái thân đó qua một tên
  khác thì phép kiểm đệm biến mất — và nếu trong file đã có một thân đúng ở chỗ khác thì không có
  báo cáo nào cả.
- Đệm đi bằng prop khác. Chỉ thuộc tính `className` được đọc; một prop dạng object khe không ai soi.
- Cổng tên file là một tên chính xác. Cùng cái vỏ đó tách sang file tên khác là hết bị quản.

---

## `field-input-uses-secondary-variant`

**Bắt gì?** Ô nhập của thư viện, khi dùng bên trong lá trường của nhà, phải khoá biến thể bề mặt phụ.
Sai biến thể hoặc **thiếu hẳn** thuộc tính biến thể đều báo `variant`.

**Giữ mã nào?** `VENDOR-7`.

**Phát hiện thế nào?** Cổng tên file khoá đường dẫn kết thúc bằng `Field/index.tsx`. Import phải có
`source.value` **bằng đúng** `@vendor/react`; mỗi specifier có `imported.name` là `Input` góp
`local.name` vào một tập ràng buộc. Sau đó mỗi phần tử JSX mang tên định danh thuần nằm trong tập đó
phải có thuộc tính `variant` với giá trị `Literal` đúng bằng `secondary`.

**Vì sao nên để máy giữ luật này?** Vì biến thể mặc định vẽ ra một **bề mặt trường thứ hai** bên
trong một bề mặt đã có ranh giới. Người viết một form mới không nghĩ tới chuyện đó — họ chỉ dùng ô
nhập theo mặc định của thư viện, và mặc định là thứ không ai coi là một quyết định.

**Những chỗ còn lọt.**
- Nguồn phải **bằng đúng**. Import cùng thành phần đó từ một gói con thì tập ràng buộc rỗng, và luật
  im lặng không có việc gì để làm.
- Import namespace. Vẽ thành phần dưới dạng biểu thức thành viên thì không có tên định danh thuần,
  visitor thoát ngay.
- Dựng phần tử bằng lời gọi factory thay vì JSX thì không có phần tử mở nào để thăm.

---

## `field-label-is-text-only`

**Bắt gì?** Nhãn của trường là **chữ**. Không suy ra một biểu tượng trang trí từ loại dữ liệu ô nhập.
Biểu tượng chỉ thuộc về một điều khiển có hành động riêng của nó.

**Giữ mã nào?** `VENDOR-9`.

**Phát hiện thế nào?** Cùng cổng tên file với luật trên. Import có đường dẫn chuẩn hoá kết thúc bằng
`/components/leaves/Icon`, specifier tên `Icon`, góp tên cục bộ vào tập ràng buộc. Với mỗi phần tử mở
dùng một trong các ràng buộc đó, visitor **leo `node.parent` lên trên** tìm một `JSXElement` có tên
mở là định danh chữ thường `label`.

**Vì sao nên để máy giữ luật này?** Vì cái biểu tượng đó bao giờ cũng trông đẹp ở một trường. Nó chỉ
sai ở **trường thứ tám**, khi cột nhãn đã thành một hàng biểu tượng lộn xộn và không cái nào bấm
được. Đúng loại luật mà từng lần vi phạm đều tự bào chữa được.

**Những chỗ còn lọt.**
- Chỉ tổ tiên là **phần tử `label` chữ thường** mới bị thấy. Một biểu tượng truyền vào **prop** nhãn,
  hoặc đặt trong một thành phần nhãn của nhà, nằm ngoài quan hệ duy nhất mà luật nhìn được.
- Một đường dẫn import định nghĩa thế nào là biểu tượng. Biểu tượng lấy thẳng từ gói glyph, hoặc lấy
  qua barrel, không nằm trong tập ràng buộc — đúng chỗ hở mà phần chú thích đầu nguồn đã cảnh báo.

---

## `no-surface-branch-in-overlay`

**Bắt gì?** Lớp phủ **đã là** vật thể có ranh giới. Nó không được gắn thêm một trong bốn nhánh bề mặt
đã đặt tên vào trong; cần cấu trúc thì dùng tiêu đề, khoảng cách, hàng và điều khiển trực tiếp.

**Giữ mã nào?** `VENDOR-8`.

**Phát hiện thế nào?** Đường dẫn file phải chứa thư mục lớp phủ. Chỉ một visitor `ImportDeclaration`:
đường dẫn nguồn chuẩn hoá phải khớp **và kết thúc bằng** `/components/branches/<một trong bốn tên>`.

**Vì sao nên để máy giữ luật này?** Vì thẻ lồng trong thẻ là sai kiểu **cộng dồn**: mỗi lần thêm chỉ
thấy dày thêm một chút, và tới lúc nhìn thấy rõ thì đã có bốn chỗ như thế. Máy bắt ngay ở lần đầu,
lúc còn rẻ.

**Những chỗ còn lọt.**
- **Import tương đối trượt hoàn toàn.** Phép kiểm đòi đoạn `components/branches/`; một định danh
  tương đối leo ra khỏi thư mục lớp phủ không chứa đoạn đó.
- Import qua barrel, hoặc import sâu vào file bên trong nhánh, đều trượt phép khớp neo-đuôi trong khi
  vẫn vẽ đúng cái bề mặt ấy.
- Luật cấm một **import**, không cấm một lần **vẽ**. Một lớp bọc mỏng đặt tại chỗ gắn lại đúng nhánh
  đó mà không ai báo.

---

## `text-link-uses-hero-link`

**Bắt gì?** Lá liên kết văn bản phải mượn nguyên thể liên kết của thư viện — ngữ nghĩa điều hướng,
bàn phím, tiêu điểm và trạng thái di chuột thuộc về nó. Không import — báo `missing`. Tự dựng lại
bằng nút thô hoặc bằng class gạch chân/di chuột — báo `handmade`.

**Giữ mã nào?** `VENDOR-10`.

**Phát hiện thế nào?** Cổng tên file kết thúc bằng `TextLink/index.tsx`. Sự hiện diện của import: bất kỳ
specifier nào có `imported.name === "Link"` từ nguồn chính xác. Hai báo cáo độc lập trên
`JSXOpeningElement`: tên là định danh chữ thường `button`; và thuộc tính `className` có văn bản
`Literal` khớp `/(?:hover:|underline)/`. `Program:exit` báo khi thiếu import.

**Vì sao nên để máy giữ luật này?** Vì một liên kết tự vẽ **trông giống hệt** một liên kết thật ở
trạng thái nghỉ. Cái mất đi là tiêu điểm bàn phím, menu chuột phải, mở tab mới — những thứ không xuất
hiện trong ảnh chụp và không ai thử lại trong review.

**Những chỗ còn lọt.**
- **Hằng số rửa sạch chuỗi.** Class di chuột hoặc gạch chân gom vào một hằng, một template literal
  hay một lời gọi gộp class thì không còn là giá trị `Literal`, và phép kiểm chuỗi con không bao giờ
  chạy.
- **Có import là đủ.** Import nguyên thể liên kết rồi không vẽ nó vẫn thoả luật hoàn toàn.
- **Một thẻ và hai chuỗi con.** Một thẻ neo, hoặc một khối mang thuộc tính vai trò tự vẽ gạch chân
  bằng viền dưới, đều không phải nút thô và cũng không khớp chuỗi nào.

---

## `account-control-owns-dropdown`

**Bắt gì?** Sáu tình huống trên ba file. Vỏ thả xuống phải là nơi duy nhất import cơ chế thả xuống
của thư viện (`dropdown`). Khối tài khoản phải soạn qua vỏ đó (`shell`) và không được import thư viện
(`vendor`). Thanh điều hướng phải dùng khối đó (`menu`) và nút biểu tượng tài khoản không được tự
mang hành động (`direct`). Khối truyền **dữ liệu mục có kiểu** cho vỏ chứ không import các mảnh giải
phẫu rồi tự lắp lại (`pieces`).

**Giữ mã nào?** `VENDOR-11`.

**Phát hiện thế nào?** Ba biểu thức tên file chọn ra ba vai. Phép kiểm mảnh giải phẫu trong vỏ đọc
**văn bản thô** của khai báo export và so với một biểu thức chính quy hai tiền tố. Import điều khiển
một cờ `hasOwner` dùng chung theo vai. Trong thanh điều hướng, một phần tử `IconButton` bị soi: thuộc
tính `props` chứa `ObjectExpression` có `Property` khoá `icon` giá trị literal `account`, cùng lúc có
một thuộc tính tên `on`.

**Vì sao nên để máy giữ luật này?** Vì đây là chỗ hai thứ **khác loại** hay bị gộp: cơ chế mở/đóng
và ý nghĩa sản phẩm. Gộp xong thì mỗi lần đổi một câu chữ cho khách vãng lai lại phải mở đúng file
đang giữ cơ chế popover. Máy giữ được vì ranh giới này viết ra được bằng import.

**Những chỗ còn lọt.**
- **Lại là sự hiện diện của import.** Thanh điều hướng thoả báo cáo bằng cách import khối; nó có vẽ
  hay không thì không ai xét.
- **Phép kiểm hành động đòi đúng một hình dạng chữ.** Danh tính tài khoản phải là property nội tuyến
  giá trị literal, và hành động phải là thuộc tính tên đúng `on`. Đưa một trong hai vào biến, hoặc
  đặt tên handler khác, là phép kiểm bốc hơi.
- **Mảnh giải phẫu mang tên khác.** Biểu thức văn bản biết hai tiền tố; một mảnh export dưới tên khác
  thì với luật này không phải giải phẫu.

---

## `auth-overlay-owns-single-content-host`

**Bắt gì?** Phần chiếu của luồng xác thực chỉ có **một** vật chứa không-đệm. Mở thêm một `Tree` bọc
quanh panel vốn đã sở hữu đúng vật chứa đó — báo `duplicate`. Không import vật chứa chiếu — báo
`missing`. Token cột-giữa tự khai thêm đệm dọc — báo `inset`.

**Giữ mã nào?** `VENDOR-12`.

**Phát hiện thế nào?** Hai biểu thức tên file: file thành phần của lớp phủ, và file chỉ mục hợp đồng.
Trong lớp phủ, phát hiện **theo tên được import**, cố ý không theo đường dẫn: `ContractContent` bật
cờ, `Tree` báo ngay tại specifier. Trong file hợp đồng, một `Property` khoá token cột-giữa được đọc
bằng **văn bản thô** và so với một biểu thức đòi **một dấu nháy** đứng ngay trước `py-`, `pt-` hoặc
`pb-`:

```js
/["'`](?:py|pt|pb)-/
```

Chi tiết "theo tên, không theo đường dẫn" là một lần sửa có thật: phép kiểm đường dẫn trước đó chỉ
nhận bố cục một-ứng-dụng, nên một workspace phát hành cùng các nhánh đó từ một gói thì **thoả luật mà
trượt rule**, và cách chữa duy nhất là import một mô-đun không tồn tại ở đó.

**Vì sao nên để máy giữ luật này?** Vì hai vật chứa lồng nhau cho ra một dải đệm dọc thừa mà chỉ đo
mới thấy, và vì cái sai này **đi ngược lại trực giác**: người sửa thấy nội dung lệch sẽ có xu hướng
thêm đệm, tức là thêm đúng thứ đang gây lệch.

**Những chỗ còn lọt.**
- **Biểu thức đệm neo vào dấu nháy.** Nó chỉ khớp class đệm dọc khi class đó là **token đầu tiên**
  của chuỗi. Cùng class ấy viết sau bất kỳ class nào khác thì không khớp.
- **Đệm bốn phía không phải đệm dọc** với luật này. Một class bốn phía dựng lại dải thứ hai mà không
  ai khớp.
- **Import mặc định và namespace.** Phát hiện đọc `imported.name`; một import mặc định, hay một truy
  cập thành viên qua namespace, không mang tên nào để so.

---

## `checkbox-keeps-compound-anatomy`

**Bắt gì?** Điều khiển hợp thành chưa xong ở phần gốc. Phần nội dung phải bọc phần điều khiển, phần
điều khiển phải bọc phần chỉ báo, và nhãn nhìn thấy được phải nằm trong cùng phần nội dung đó. Thiếu
bất kỳ mắt nào — báo `anatomy`.

**Giữ mã nào?** `VENDOR-13`.

**Phát hiện thế nào?** Cổng tên file kết thúc bằng `Checkbox/index.tsx`. Ba biến luận **toàn file**,
lấy từ tên biểu thức thành viên hai phần với **tên object cục bộ ghi cứng**: thấy phần nội dung; thấy
phần điều khiển có tổ tiên là phần nội dung; thấy phần chỉ báo có tổ tiên là phần điều khiển. Ba phép
kiểm tổ tiên đều là leo cây, không phải kiểm cha trực tiếp.

**Vì sao nên để máy giữ luật này?** Vì kiểu hỏng này **qua được cả hai loại kiểm tra rẻ tiền**. Đặt
phần điều khiển và phần nội dung thành anh em thì vẫn vẽ ra một ô tick — nhìn ảnh không thấy sai —
nhưng chữ nhìn thấy nằm ngoài vùng bấm. Truyền chữ nhãn thẳng vào gốc thì tên khả truy cập vẫn đúng
— test truy vấn theo nhãn vẫn xanh — nhưng không vẽ ra cái ô nào. Không có lối hỏng nào nấp được sau
lối kia.

**Những chỗ còn lọt.**
- **Ba biến là toàn file, không theo từng cây.** Một điều khiển hợp thành đúng ở bất kỳ đâu trong file
  làm thoả cả ba biến cho mọi điều khiển hỏng đứng cạnh.
- **Tên object cục bộ ghi cứng.** Hợp thành import dưới tên cục bộ khác thì không khớp văn bản thành
  viên nào.
- **Vị trí nhãn không hề được kiểm.** Luật chứng minh ba mắt lồng có tồn tại; nó không chứng minh chữ
  nhìn thấy nằm trong vùng bấm — mà đó mới đúng là lối hỏng văn bản luật mô tả.

---

## `no-internal-starci-href`

**Bắt gì?** Điều hướng nội bộ là một **hành động**, không phải một `href`. Thành phần thuần báo ra một
id hoặc một lần bấm; phần được nối giữ đường dẫn và tự gọi router. Đích nội bộ viết thành literal
trong `href` hoặc trong giá trị object — báo `internal`. Bốn lá chỉ-điều-hướng-nội-bộ thì **khai báo
hay vẽ** `href` đều báo `leaf`.

**Giữ mã nào?** `VENDOR-14`.

**Phát hiện thế nào?** Phạm vi rộng nhất trên kệ này: mọi đường dẫn chứa `/src/` và không phải file test.
Một biểu thức thứ hai đánh dấu bốn lá chỉ-nội-bộ. Ba node được thăm: `JSXAttribute` tên `href`,
`Property` khoá `href` hoặc `externalHref`, và `TSPropertySignature` tên `href`. Đọc giá trị chấp
nhận `Literal` chuỗi hoặc `TemplateLiteral` **không có biểu thức nào**; tính nội bộ là
`startsWith("/")` hoặc một biểu thức host công khai đã ghim.

**Vì sao nên để máy giữ luật này?** Vì một `href` nội bộ **hoạt động được**. Nó bấm ra đúng trang.
Cái mất đi là điều hướng phía client, trạng thái giữ lại, và một chỗ duy nhất giữ bảng đường dẫn — ba
thứ chỉ đau về sau. Không có triệu chứng nào để review người bắt kịp.

**Những chỗ còn lọt.**
- **Mọi đích tính toán được.** Template literal có nội suy, một biến, một tra cứu hằng, một phép nối
  chuỗi — đều trả về không đọc được và đi lọt. Mà đó **chính là dạng phổ biến nhất** của một đường
  dẫn nội bộ thật.
- **Mảng và khoá khác.** Một đường dẫn nằm trong mảng chuỗi thuần thì không ở thuộc tính `href` nào;
  một đích mang khoá tên khác thì không phải một trong hai khoá được đọc.
- **Phép thử nội bộ là một ký tự đầu cộng một host ghim.** Một host nội bộ thứ hai, một tên miền
  staging, hay một đường dẫn viết thiếu gạch chéo đầu đều là "bên ngoài" theo cách luật nhìn — trong
  khi một địa chỉ bên ngoài viết dạng không-giao-thức lại bị đọc nhầm thành nội bộ.
- **Danh sách lá chỉ-nội-bộ là bốn tên thư mục ghi cứng ở đúng một tên file.** Một lá thứ năm cùng
  loại không mang lệnh cấm trọn gói nào.

---

## Luật

1. Danh tính của một rule là **tên đã công bố**. Không đặt thêm mã số cho nó ở tài liệu này.
2. Phát hiện là **tĩnh và trong một file**. Không rule nào phân giải mô-đun, đi theo re-export, hay
   tính giá trị biểu thức.
3. Phép kiểm đường dẫn là chuỗi con hoặc biểu thức chính quy trên tên file đã chuẩn hoá.
4. Phép kiểm thuộc tính chỉ nhận literal; gặp biểu thức thì mỗi rule ngả về một phía, và tài liệu
   phải nói rõ ngả về phía nào.
5. Quyền sở hữu quyết định bằng **thư mục**, không bằng nội dung file.
6. Một rule giữ cả hai chiều: import sai chỗ, và chỗ không có import.
7. Mức độ mà mô-đun yêu cầu là đồng nhất: mọi rule công bố đều ở mức lỗi.

## Ngoại lệ

Ngoại lệ là một phần của cách thi hành, không phải chỗ lách. Mỗi ngoại lệ đóng và nêu rõ nó áp vào
đâu.

- **Ngoài cây thành phần.** Một provider dựng thư viện lên cho cả ứng dụng là chuyện khác với một
  thành phần với tay lấy một widget; rule ranh giới thoát trước khi thăm bất cứ node nào.
- **Vỏ của framework.** Có đúng một vỏ sở hữu cơ chế của **framework** chứ không phải của thư viện:
  nó chuyển phần children mà một layout đoạn tuyến được trao thành thứ mọi tầng dưới trông đợi, và nó
  không import thư viện nào cả. Bắt nó phải có một import vô nghĩa là dạy người ta thêm rác.
- **File test.** Hai báo cáo ở `Program:exit` của rule ranh giới bỏ qua file test; rule điều hướng nội
  bộ bỏ qua hoàn toàn. Nhưng báo cáo **import** của rule ranh giới **không** bỏ qua — đây được ghi
  thành một nhận định trong `audit.md`, không được viết ra như một chủ ý.
- **Thư viện biểu tượng.** Không phải ngoại lệ cấp ở đây, mà là một ranh giới do mô-đun khác sở hữu.
  Mô-đun này ghim đúng một tiền tố gói; gói biểu tượng là rule của người khác — và khoảng hở giữa hai
  rule như thế chính là chỗ đã từng lọt một biểu tượng ở kích thước không tồn tại ở đâu khác.
