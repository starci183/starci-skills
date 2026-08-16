---
id: fe-layouts-archetypes-sticky-chrome-band-vi
title: vi.md
slug: /gates/layouts/archetypes/sticky-chrome-band/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống CHROME-N, nhận diện bằng nghiệp vụ chứ không bằng hình dáng thanh điều hướng.
---

# vi.md

> Phiên bản: `1.00` · Mô-đun: `sticky-chrome-band`

# Băng chrome trên thân trang

Băng chrome là dải dính trên đỉnh mà một cụm route đeo vào, để người đọc **đi ra khỏi trang đang
đứng**. Nó mang thương hiệu, các đích đến, và bộ công cụ tài khoản. Thân trang nằm **cạnh** nó, không
nằm trong nó.

Câu hỏi mở đầu không phải "trang này cần thanh nav không", mà là:

> Người đọc rơi thẳng vào trang này thì có lối ra không?

Bốn mươi chín trên năm mươi mốt trang trả lời có, và trả lời bằng đúng một công thức
`nav-over-body-page`. Hai trang trả lời không: trang gốc locale chỉ chuyển hướng, và trang đăng nhập
cố tình không có lối đi lang thang.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Kết quả |
|---|---|---|
| `CHROME-1` | Cụm route không có mục nào của riêng trang | Băng một hàng, token `top-rail` |
| `CHROME-2` | Trang sở hữu một tập mục đóng của **cùng một tài liệu** | Băng hai hàng dính liền, token `top-course-rail` |
| `CHROME-3` | Điều khiển đổi **vùng nội dung** đang hiển thị | Một line chạy hết ngang |
| `CHROME-4` | Điều khiển đổi **một tham số của một hình** | Điều khiển gọn, đứng cạnh hình đó |
| `CHROME-5` | Đổi mặt của một trang, hay đi sang trang khác | Tab giữ state, hoặc router đổi route |
| `CHROME-6` | Băng khi màn hình hẹp | Từng cụm biến mất trọn cụm, không có gì thay thế |
| `CHROME-7` | Một điều khiển trong băng mở panel | Layout mount panel một lần, không dựng card bên trong |
| `CHROME-8` | Hàng dưới đã mang đích đến của trang này | Hàng trên bỏ phần trùng |

---

## `CHROME-1` — băng một hàng

**Tình huống.** Cụm route mà mỗi trang trong đó là một đích đến riêng, không có mục con nào thuộc về
chính trang. Giỏ hàng, bảng xếp hạng, luyện tập, danh mục khoá học đều thế.

**Dấu hiệu nhận biết**

- Không có tập mục nào mà rời khỏi tập đó thì vẫn là trang này.
- Không control nào ở đầu trang đổi vùng nội dung mà không đổi route.

**Kết quả.** `double-navbar` với slot `bottom` vắng mặt. Cái gì dính dưới băng thì trừ `top-rail` là
`5.5rem`, và nếu tự cuộn thì chặn chiều cao bằng `max-h-rail`.

**Ranh giới.** Nếu trang có bốn mục của cùng một tài liệu thì đó là `CHROME-2`, và **token offset đổi
theo**. Đây là chỗ đã có một lần từ chối thật: dùng `top-rail` dưới một băng hai hàng làm rail chui
lên dưới hàng thứ hai.

---

## `CHROME-2` — băng hai hàng, dính liền

**Tình huống.** Trang sở hữu một tập mục **đóng và hữu hạn** của cùng một tài liệu. Trang chi tiết
khoá học có bốn mục: khám phá, nội dung, cộng đồng, đánh giá. Bảng điều khiển có tập tab của nó.

**Dấu hiệu nhận biết**

- Đổi mục thì vẫn đang đọc cùng một đối tượng.
- Tập mục hữu hạn và biết trước, không sinh ra từ dữ liệu tuỳ ý.

**Kết quả.** Hàng thứ hai là **tầng hai của chính băng đó**, không phải một khối nằm đầu thân trang:

- cùng một landmark dính, `sticky` khi cuộn;
- **một** `border-b` cho cả hai hàng;
- hàng dưới đè đúng `1px` lên nét của hàng trên bằng `-mt-px`;
- không `pt-6`, không khoảng trống nào giữa hai hàng;
- token offset đổi sang `top-course-rail` là `6.1rem`.

**Tự hỏi.** Cuộn xuống giữa trang, hai hàng còn dính vào nhau và còn thấy đủ không? Nếu hàng dưới
trôi mất thì nó chưa bao giờ là tầng hai.

**Ranh giới.** Tab và breadcrumb **cùng tồn tại**. Tab điều hướng trong tài liệu, breadcrumb giữ tổ
tiên route. Bỏ breadcrumb vì đã có tab là một lần đã bị bác thẳng.

---

## `CHROME-3` — điều khiển đổi vùng nội dung

**Tình huống.** Bấm xong thì **vùng nội dung của trang đã khác**. Đang xem tổng quan chuyển sang xem
hoạt động; đang xem nội dung khoá chuyển sang xem đánh giá.

**Kết quả.** Chạy hết chiều ngang, một line như của shell, sống ở hàng thứ hai của băng.

**Tự hỏi.** Sau khi bấm, trang còn đang trả lời cùng một câu hỏi không? Nếu đã đổi câu hỏi thì đây là
`CHROME-3`.

---

## `CHROME-4` — điều khiển đổi một tham số của một hình

**Tình huống.** Bấm xong thì **vẫn đúng vùng nội dung đó**, chỉ có một hình được vẽ lại với tham số
khác. Đổi năm của lịch đóng góp: vẫn là lịch đóng góp.

**Kết quả.** Điều khiển gọn, đứng cạnh chính hình đó, bên trong thân trang, thường ở mép phải của
hàng tiêu đề `justify-between`.

**Đây là chỗ founder tự lật, nên phải đọc cả bốn vòng.** Hai vòng đầu founder bác điều khiển gọn và
đòi "nó phải là 1 line dài như shellnav". Hai vòng sau chính founder bác cái line đó và đòi điều
khiển gọn, với lý do: nó đổi một tham số hiển thị chứ không đổi vùng nội dung của trang.

**Cả bốn phán quyết đều còn hiệu lực.** Không được chọn một bên làm mặc định. Câu phân định là:

> Sau khi dùng điều khiển này, **vùng nội dung** của trang đã đổi, hay **một hình** vừa được vẽ lại
> với tham số khác?

Đổi vùng → `CHROME-3`. Vẽ lại một hình → `CHROME-4`.

**Hai thứ không được dùng làm căn cứ.** Tên vendor đặt cho lớp sơn — vendor gọi gạch chân của nó là
`secondary` không làm điều khiển đó thành thứ yếu trong sản phẩm. Và bề rộng — một segmented control
không biến thành điều hướng chỉ vì nó rộng.

---

## `CHROME-5` — tab đổi panel, route đổi trang

**Tình huống.** Cần quyết định một lựa chọn là **mặt của một trang** hay là **một trang khác**.

**Phân loại.** Tab đổi panel và không sinh trang mới; route đổi trang và giữ breadcrumb. Bốn ca sống
trong repo, phân loại đúng cả bốn:

| Ca | Cơ chế | Vì sao |
|---|---|---|
| Tab mobile của learn | state cục bộ `setMobileView` | Legacy đổi giữa nội dung, bài học và dàn ý mà không đổi route |
| Tab của trang chi tiết khoá học | `useState` | Bốn mục của cùng một tài liệu khoá học |
| Tab của hồ sơ công khai | `router.push` | Ở đây mỗi mặt bằng chứng **là một route thật** |
| Tab của bảng điều khiển | `router.replace` với `?tab=` | Ghi tham số truy vấn, không đổi chủ sở hữu route |

**Ngoại lệ đã đóng.** Tab của bảng điều khiển được chạm vào URL. Đây là chỗ duy nhất, và nó vẫn là
tab vì chủ sở hữu route không đổi. Không tab nào được viết lại breadcrumb.

---

## `CHROME-6` — băng khi hẹp

**Tình huống.** Màn hình hẹp lại, băng không đủ chỗ.

**Hành vi thật.** Các cụm biến mất **trọn cụm**: cụm route links biến mất cùng nhau, cụm
tìm-kiếm/ngôn-ngữ/giao-diện biến mất cùng nhau. Còn lại thương hiệu cộng giỏ hàng, thông báo, tài
khoản.

**Không có hamburger.** Đây là hành vi đo được, không phải luật đẹp. Muốn thêm hamburger thì đó là
một quyết định sản phẩm cần phán quyết riêng, không phải phần còn thiếu hiển nhiên của luật này.

**Sai hay gặp.** Cụm biến mất một nửa: giấu route links nhưng giữ ô tìm kiếm. Cụm là đơn vị, không
phải từng phần tử.

---

## `CHROME-7` — panel mà băng sở hữu

**Tình huống.** Điều khiển mở panel nằm trong chrome, nên panel phải sống lâu hơn route dưới nó.

**Kết quả.** Layout mount panel **một lần cho cả cụm**, không phải mỗi trang một cái. Băng đang mount
ba cái: overlay đăng nhập, ngăn kéo giỏ hàng, overlay tìm kiếm toàn cục. Lý do ghi thẳng trong nguồn:
một ngăn kéo mỗi trang là một bẫy focus mỗi trang, cho một panel mà cùng lúc chỉ một cái hiện được.

**Hai luật của nội thất panel:**

- **Không dựng card trong overlay.** Overlay tự nó đã là một mặt phẳng có biên; thêm card là hai chủ
  sở hữu mặt phẳng chồng nhau.
- **Bề rộng là quyết định sản phẩm.** Overlay tìm kiếm mở `size="cover"`. Giả định "modal thì phải
  hẹp" đã bị bác thẳng.

---

## `CHROME-8` — hàng trên không nói lại điều hàng dưới đã nói

**Tình huống.** Trang có tab ngữ cảnh ở hàng hai, mà hàng một vẫn liệt kê ba đích đến toàn cục ngay
phía trên.

**Kết quả.** Hàng trên bỏ phần trùng, giữ thương hiệu và bộ công cụ.

**Trạng thái thật.** Repo sống **đang vi phạm**: hàng primary vẫn map cả ba route trên trang chi tiết
khoá học. Bản ghi khai là đã sửa `routes: []` và đã thêm test; nguồn sống không có cả hai. Xem
[`audit.md`](./audit.md). Kế hoạch mới chép **phán quyết**, không chép nguồn.

---

## Luật

1. Thân trang là anh em của băng, không phải con của băng.
2. Hai hàng là một landmark dính, một `border-b`.
3. Hàng dưới nối vào hàng trên bằng `-mt-px`, không bằng khoảng trống.
4. Mỗi offset dính gọi đúng token của băng trên đầu nó.
5. Điều khiển đổi vùng nội dung chạy hết ngang; điều khiển đổi một tham số của một hình thì gọn.
6. Tab đổi panel, route đổi trang, tab không viết lại breadcrumb.
7. Overlay do layout mount một lần, không dựng card bên trong, và có bề rộng được chọn.
8. Hàng trên không lặp điều hàng dưới đã mang.

## Ngoại lệ

- **Không hamburger ở `CHROME-6`.** Ghi đúng cái đang chạy; đừng suy ra cái nên có.
- **`CHROME-5` cho phép một tab ghi query.** Chỉ tab bảng điều khiển, chỉ `?tab=`, và chủ sở hữu
  route không đổi.
- **`CHROME-2` sống chung với breadcrumb.** Hai vai trò khác nhau, cùng có mặt.
- **`CHROME-7` cho phép overlay phủ toàn màn.** Bề rộng theo công việc bên trong.
- **`CHROME-8` vẫn ràng buộc dù nguồn sống đang sai.** Vi phạm sống không phải tiền lệ.
