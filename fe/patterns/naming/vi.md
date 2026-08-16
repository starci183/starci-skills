---
id: fe-patterns-naming-vi
title: vi.md
slug: /fe/patterns/naming/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống NAMING-N, nhận diện bằng chỗ cái tên sẽ đi qua chứ không bằng thói quen gõ.
---

# vi.md

> Version: `2.00` · Module: `naming`

# Naming

Đây là **nửa cơ học** của việc đặt tên: những cách viết phải giống nhau ở mọi file, bất kể file đó
làm gì. Một hàm ở mức module được khai báo thế nào, một thứ chạy khi người dùng bấm thì tên là gì, và
đường dẫn viết bằng ngôn ngữ nào.

Cả ba đều là những cặp mà **hai cách viết đều chạy**. Đó chính là lý do chúng phải thành luật: không
có gì tự sửa cách viết thứ hai, nên một file viết hôm thứ Ba đọc khác hẳn file bên cạnh, và mọi diff
về sau mang theo nhiễu không liên quan gì tới thay đổi thật.

> Cái tên này sẽ đi qua bao nhiêu ranh giới, và ở mỗi ranh giới nó có còn là chính nó không?

**Đây là luật bắt buộc.** Mọi khai báo ở mức module, mọi hàm chạy do người dùng tác động, và mọi đoạn
đường dẫn đều rơi vào đúng một mã dưới đây. Không có file nào nhỏ tới mức được miễn.

Còn một câu hỏi **không** thuộc module này: một component được đặt tên **theo cái gì** — theo bản
thân nó, chứ không theo người gọi đầu tiên. Câu đó được trả lời **ở từng layer**, vì cái hỏng mà nó
ngăn ở mỗi layer là khác nhau. Ở đây không phát mã cho nó, và không phát mã là một quyết định: một mã
phát ra ở đây sẽ bị trích dẫn ở đây, trong khi câu trả lời nằm ở nơi khác.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Tầng giữ |
|---|---|---|
| `NAMING-1` | Một hàm được khai báo ở mức module, ai cũng gọi được từ file khác | `enforced` · `starci-fe/prefer-arrow-export` |
| `NAMING-2` | Một hàm chạy khi người dùng bấm, gõ, chọn — và nó sẽ được truyền đi | `enforced` · `starci-fe/handler-on-prefix` |
| `NAMING-3` | Tên file, tên thư mục, đoạn route — thứ nằm trên URL và trong stack trace | `enforced` · `starci-fe/no-second-language-in-path` |

---

## `NAMING-1` — hàm ở mức module là một arrow const

**Tình huống.** Bạn đang khai báo một hàm ở **mức ngoài cùng** của file: một helper, một component,
một hàm định dạng, một route. Hai cách viết đều chạy, nhưng chỉ một cách giữ được lời hứa về **thứ
tự** của file.

Lý do sâu hơn nằm ở **hoisting**. Một khai báo `function` tồn tại **trước** dòng khai báo ra nó, nên
một file có thể gọi xuống dưới mà vẫn xanh — và thứ tự của file lập tức không còn nghĩa gì, vì không
có gì bắt buộc một thứ phải được định nghĩa trước khi được dùng. Một `const` thì không thể dùng trước
khi tồn tại, nên file đọc từ trên xuống đúng theo thứ tự nó thật sự chạy.

`export default function` còn thêm một cái giá nữa: bản export **không có tên để grep** ở phía các
call site.

**Dấu hiệu nhận biết**

- Khai báo nằm sát lề trái, cha của nó là chính module hoặc một câu `export`.
- Trong file có chỗ gọi tới một cái tên được định nghĩa ở **phía dưới** mà vẫn chạy.
- Bạn phải cuộn lên rồi cuộn xuống mới biết một cái tên đến từ đâu.

**Tự hỏi.** Nếu tôi đọc file này từ trên xuống, có chỗ nào dùng một cái tên chưa hề xuất hiện chưa?

**Ranh giới**

- ↔ khai báo lồng bên trong: một `function` nằm **trong thân** một hàm khác thì không phải mức module.
  Hoisting trong một thân duy nhất không phá thứ tự của file, vì thân đó được đọc như một khối.
- ↔ `NAMING-2`: mã này nói **cách khai báo**, không nói **chữ**. Một arrow const tên `handleClaim`
  vẫn đúng `NAMING-1` và vẫn sai `NAMING-2`. Hai mã đọc độc lập nhau.

**Tình huống nghiệp vụ hay gặp.** Component export ra ngoài · hàm định dạng số tiền, ngày, đơn vị ·
custom hook · guard/validator · adapter gọi API · route mặc định của một trang · helper dựng chuỗi
class · factory tạo cấu hình.

---

## `NAMING-2` — thứ chạy do người dùng thì tên là `onX`

**Tình huống.** Một hàm chạy **vì người dùng đã làm gì đó**: bấm, gõ, chọn, gửi, đóng. Nó gần như
luôn được **truyền đi** — vào một slot, vào một prop, vào một thuộc tính DOM.

`handleSubmit` và `onSubmit` mô tả **cùng một hàm**. Nhưng một codebase dùng cả hai thì có **hai bộ
từ vựng cho một ý**, và mỗi người viết phải tự quyết file này đang nói thứ tiếng nào.

`on` là chữ **sống sót được qua chuyến đi**. Slot đã là `on`, thuộc tính DOM đã là `onClick`, kiểu
props đã khai `on…` — nên một biến cục bộ tên `handlePress` **bị đổi tên ở ranh giới, mỗi lần**, và
mỗi lần đổi tên là một dịp để sai. Đặt thẳng `onPress` ngay lúc khai báo thì cái tên giống hệt nhau ở
chỗ khai báo, ở chỗ gọi, và trong kiểu props.

**Dấu hiệu nhận biết**

- Nó không trả về giá trị để hiển thị; nó **gây ra** một việc.
- Nó xuất hiện ở vế phải của một prop hoặc một thuộc tính DOM.
- Trong cùng một màn hình, cái tên này đang tồn tại ở hai dạng chữ khác nhau.

**Tự hỏi.** Cái chạy nó là **hành động của người đọc**, hay là quá trình render?

**Ranh giới**

- ↔ một giá trị: nếu nó **tính ra** một thứ thì `on` là nói dối, và luật này **không** đòi. Một nhãn
  dựng từ dữ liệu là một giá trị, không phải handler.
- ↔ `NAMING-1`: xem trên.
- ↔ chữ `handled`, `handler`: đó là **từ**, không phải khuôn `handle` + chữ hoa. Nới ra tới chúng thì
  bắt thêm được một ca và mất toàn bộ sự chú ý của người đọc.

**Tình huống nghiệp vụ hay gặp.** Nút gửi form · nút huỷ trong modal · chọn một dòng trong danh sách ·
đổi tab · đổi trang · đóng overlay · thả file vào vùng upload · nhấn phím tắt · xác nhận xoá · nhận
một phần thưởng.

---

## `NAMING-3` — đường dẫn viết bằng thứ tiếng mọi người cùng đọc

**Tình huống.** Bạn đang đặt tên một **file**, một **thư mục**, hoặc một **đoạn route**.

Luật soi source đọc được định danh, comment và chuỗi — nhưng **không đọc được tên của chính file nó
đang đọc**. Nên một route có thể là `app/cap-phat/page.tsx` với mọi định danh bên trong bằng tiếng
Anh, và không có gì báo một tiếng — trong khi URL, chuỗi import, cái thư mục hiện trên sidebar của mọi
editor, và đường dẫn trong mọi stack trace vẫn nằm ở một thứ tiếng mà một nửa người đọc không có.

Một đoạn route còn là một **cái tên công khai**. Nó là địa chỉ khách hàng trích lại trong ticket hỗ
trợ. Nên đây không chỉ là chuyện của người viết code: URL của chính sản phẩm thôi đọc được đối với
bất kỳ ai ngoài một thứ tiếng.

**Dấu hiệu nhận biết**

- Đoạn đường dẫn có dấu thanh, hoặc là một từ đã bỏ dấu của thứ tiếng khác.
- Chữ trên URL trùng với chữ hiển thị trên màn hình — dấu hiệu ai đó đã lấy nội dung làm địa chỉ.
- Import specifier đọc lên nghe như một câu, không như một địa chỉ.

**Tự hỏi.** Đoạn này là **địa chỉ** hay là **nội dung**? Nội dung thì thuộc về catalogue locale.

**Ranh giới**

- ↔ catalogue locale: từ điển dịch **chính là** thứ tiếng kia. Đó là nội dung, và đổi được nó là mục
  đích của nó. Tên của chính file catalogue thì vẫn là địa chỉ.
- ↔ từ tiếng Anh trông giống chữ đã bỏ dấu: `capacity`, `dangerous` mở đầu bằng đúng những chữ cái ấy.
  Luật **không** đụng tới chúng.

**Phép kiểm là hai phần, vì đường dẫn không mang được dấu.** `cấp phát` xuống tới filesystem thành
`cap-phat`. Dấu thanh bắt dạng thứ nhất; một **danh sách có tên** bắt dạng đã bỏ dấu. Danh sách là cố
ý chứ không phải là lười: đoán theo hình dạng chữ sẽ từ chối luôn `capacity` và `dangerous`, mà một
luật báo lỗi trên từ tiếng Anh là một luật bị tắt — và một luật đã tắt thì không giữ gì cả.

**Tình huống nghiệp vụ hay gặp.** Route đăng nhập/đăng ký · trang khoá học · trang thanh toán · giỏ
hàng · hồ sơ · cài đặt · thư mục component · file util · route group đặt trong ngoặc · thư mục ảnh và
tài nguyên tĩnh.

## Luật

1. Hàm ở mức module là **arrow const**, export **theo tên**. Không `function X() {}`, không
   `export default function`.
2. Khai báo lồng trong thân một hàm khác **không** thuộc mức module.
3. Thứ chạy do hành động của người đọc thì tên là `onX` — ở **cả ba** chỗ: biến cục bộ, prop, và
   field trong kiểu props.
4. Một thứ **tính ra giá trị** thì không mang `on`.
5. Tên file, tên thư mục và đoạn route viết bằng **một** thứ tiếng: thứ tiếng mọi người đọc repository
   này cùng có.
6. Chữ mà **người ta đọc** nằm trong catalogue locale, không nằm trên địa chỉ.
7. Một component được đặt tên theo **chính nó**, không theo nơi nó được dùng — luật đó nằm ở **từng
   layer**, không nằm ở đây.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Khai báo lồng** (`NAMING-1`). `function` nằm trong thân một hàm khác được phép. Hoisting trong một
  thân không phá thứ tự của file. Ngoại lệ này có case chạy thật trong twin test, không chỉ là một câu
  viết ở đây.
- **Giá trị không phải handler** (`NAMING-2`). Đặt `on` cho một thứ không ai kích hoạt là nói sai về
  chính nó.
- **`handled`, `handler`** (`NAMING-2`). Là từ, không phải khuôn `handle` + chữ hoa.
- **Catalogue locale** (`NAMING-3`). Từ điển mang thứ tiếng kia là đúng chức năng của nó.
- **Từ tiếng Anh trùng hình dạng** (`NAMING-3`). `capacity`, `dangerous` và họ hàng ở lại nguyên.
