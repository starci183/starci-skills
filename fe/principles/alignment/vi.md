---
id: fe-principles-alignment-vi
title: vi.md
slug: /fe/principles/alignment/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống ALIGN-N, nhận diện bằng bản chất của con chứ không bằng mắt.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `alignment`

# Căn chỉnh

Căn chỉnh là việc **vùng chứa** quyết định các **con trực tiếp** của nó **treo vào đâu**.

Hai con cao thấp khác nhau nằm cạnh nhau thì luôn phải có một câu trả lời: chúng cùng cao bằng nhau,
cùng treo vào giữa, cùng bắt đầu ở một mép, cùng kết thúc ở một mép, hay cùng đứng trên một dòng
chữ. Không tuyên bố gì cũng là một câu trả lời — và là câu trả lời có hậu quả.

Hỏi hai câu, độc lập với nhau:

> **Trục chéo** — các con treo vào đâu?
>
> **Trục chính** — cả cụm nằm ở đâu, và chỗ trống thừa thuộc về ai?

Trục chéo là trục **vuông góc** với hướng chảy. Một hàng `flex` chảy ngang thì trục chéo là chiều
dọc, `items-*` nói các con treo cao thấp thế nào. Một cột `flex-col` chảy dọc thì trục chéo là chiều
ngang, `items-*` nói các con dạt về mép nào. **Cùng một class CSS, hai ý nghĩa khác nhau, quyết định bởi
hướng chảy** — đây là chỗ sai nhiều nhất khi một hàng đổi thành cột ở màn hình hẹp.

**Đây là luật bắt buộc.** Mọi vùng chứa `flex` hoặc `grid` hiển thị ra đều rơi vào đúng một mã trục
chéo và đúng một mã trục chính. Không có hàng nào nhỏ tới mức được miễn: một biểu tượng cạnh một chữ là
`ALIGN-1`, đúng cùng một lý do mà một thanh dọc cạnh vùng nội dung là `ALIGN-0`. Câu "nhìn đã đúng rồi mà"
là chỗ luật này bị bỏ qua nhiều nhất — vì căn chỉnh là quyết định mà **vi phạm của nó vô hình cho tới
khi dữ liệu đổi**. Hai con cao bằng nhau thì mọi mã trong mô-đun này hiển thị giống hệt nhau. Chúng
thôi giống nhau đúng vào ngày một con xuống dòng thứ hai.

## Bảng tra nhanh

**Trục chéo — các con treo vào đâu**

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `ALIGN-0` | Các con dùng chung một chiều đo ngang trục chéo, con nào cũng lấp đầy | *không khai báo* |
| `ALIGN-1` | Các con cao thấp khác nhau nhưng phải đọc thành **một dòng** | `items-center` |
| `ALIGN-2` | Mỗi con có chiều dài riêng, phải **bắt đầu cùng nhau** | `items-start` |
| `ALIGN-3` | Mỗi con có chiều dài riêng, phải **kết thúc cùng nhau** | `items-end` |
| `ALIGN-4` | Chữ khác cỡ phải đứng trên **cùng một dòng viết** | `items-baseline` |
| `ALIGN-5` | **Một** con đi chệch khỏi luật mà cha đã tuyên bố | `self-*` |

**Trục chính — cả cụm nằm ở đâu, chỗ trống thừa thuộc về ai**

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `ALIGN-6` | Cụm bắt đầu ở mép nội dung, chỗ thừa rơi về phía sau | *không khai báo* |
| `ALIGN-7` | **Cả cụm** thuộc về mép cuối theo hướng chảy | `justify-end` |
| `ALIGN-8` | Cụm không thuộc về mép nào, nằm giữa chỗ trống | `justify-center` |
| `ALIGN-9` | Chỗ thừa thuộc về **khoảng giữa** các con, do hai đầu đối nghịch hoặc ngang quyền | `justify-between` · `justify-around` · `justify-evenly` |

**Nhiều dòng — các dòng treo vào đâu**

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `ALIGN-10` | Vùng chứa xuống dòng và **sở hữu** chỗ trống trục chéo mà các dòng không lấp hết | `content-*` |

---

## `ALIGN-0` — dùng chung một chiều đo, không khai báo

**Tình huống.** Các con **không** có chiều đo riêng theo trục chéo, hoặc phải cùng nhận chiều đo của
con dài nhất. Đây là mặc định của flex và lưới, và tuyệt đại đa số vùng chứa đúng ở đây.

**Dấu hiệu nhận biết**

- Mỗi con là một **vùng** cần cao bằng nhau: hai cột thẻ cạnh nhau, hai ô trong một lưới.
- Có con cần một nền, một viền hoặc một vùng bấm **chạy hết chiều cao của hàng**.
- Không con nào có chiều cao nội dung mà việc kéo dãn sẽ nói dối.

**Tự hỏi.** Nếu con cao nhất cao thêm nữa, những con còn lại **có nên** cao theo không?

**Ranh giới**

- `ALIGN-2`: khi các con **tình cờ** cao bằng nhau, hai mã hiển thị y hệt. Phân biệt bằng **quyền sở
  hữu ranh giới**: con nào có nền, viền hoặc bóng đổ mà bị kéo dãn sẽ trở thành một hộp to hơn nội
  dung nó có — lúc đó không còn là `ALIGN-0`.
- `ALIGN-1`: một biểu tượng 16px bị kéo cao bằng đoạn văn hai dòng là dấu hiệu `ALIGN-0` bị dùng nhầm.
  Biểu tượng có kích thước riêng và không được kéo.

**Không viết `items-stretch`.** Nó không nói thêm điều gì so với mặc định. `ALIGN-0` là mã **tình
huống**, không phải tên class CSS.

**Tình huống nghiệp vụ hay gặp.** Hai cột thẻ cao bằng nhau · ô trong lưới danh mục · thanh bên và
vùng nội dung cùng cao · một hàng gồm các nút cùng chiều cao · ô trong bảng · hai khung của một
màn hình chia đôi.

---

## `ALIGN-1` — cao thấp khác nhau nhưng đọc thành một dòng

**Tình huống.** Các con có chiều đo riêng theo trục chéo và **không thứ nào nên bị kéo**. Chúng cùng
tạo thành **một dòng** mà mắt đọc một lượt.

**Dấu hiệu nhận biết**

- Có ít nhất một con là **hình** hoặc **hộp cố định**: biểu tượng, ảnh đại diện, nhãn trạng thái, hộp kiểm, công tắc, biểu tượng đang tải.
- Chữ trong hàng chắc chắn chỉ một dòng.
- Kéo dãn con nào cũng vô nghĩa: một biểu tượng cao bằng hai dòng chữ là một biểu tượng méo.

**Tự hỏi.** Có con nào là **hình hoặc hộp cố định** mà việc kéo dãn sẽ làm nó sai đi không?

**Ranh giới**

- `ALIGN-4`: `ALIGN-1` treo vào **giữa hộp**; `ALIGN-4` treo vào **dòng viết**. Nếu **mọi** con đều
  là chữ và người đọc đọc chúng thành một giá trị hoặc một câu — dùng `ALIGN-4`. Chỉ cần một con là
  hình thì quay về `ALIGN-1`.
- `ALIGN-2`: `ALIGN-1` chỉ đúng khi phần chữ **chắc chắn** một dòng. Nếu tên, tiêu đề hay mô tả có
  thể xuống dòng thứ hai — đó là `ALIGN-2`, kể cả khi dữ liệu hôm nay còn ngắn.
- `ALIGN-0`: `ALIGN-0` là các con **cùng nhận** một chiều đo; `ALIGN-1` là các con **giữ** chiều đo
  riêng và gặp nhau ở giữa.

**Tình huống nghiệp vụ hay gặp.** Biểu tượng + nhãn trong một nút · ảnh đại diện + tên một dòng · hộp kiểm + nhãn
ngắn · nhãn trạng thái trạng thái cạnh tiêu đề · công tắc + tên cài đặt · phần đầu của một hàng có tiêu đề và một
nút · một ô vuông chỉ chứa chữ cái viết tắt (`grid place-items-center`).

---

## `ALIGN-2` — mỗi con có chiều dài riêng, bắt đầu cùng nhau

**Tình huống.** Ít nhất một con có thể **dài ra** theo trục chéo, và phần đầu của các con mới là chỗ
mắt neo vào. Treo vào giữa sẽ khiến những con cố định **trôi** mỗi khi con dài kia đổi độ dài.

**Dấu hiệu nhận biết**

- Trong một hàng: có đoạn chữ có thể xuống dòng thứ hai, thứ ba.
- Một con là hình cố định (ảnh đại diện, biểu tượng) cần đứng ngang **dòng đầu tiên** của con kia.
- Trong một cột: các con phải dạt về **mép đầu** theo hướng đọc, không phải mép cuối.

**Tự hỏi.** Nếu con dài nhất dài gấp đôi, con cố định kia **có được phép trôi xuống** theo không?
Nếu không — `ALIGN-2`.

**Ranh giới**

- `ALIGN-1`: phân định bằng **khả năng dài ra**, không bằng dữ liệu hiện tại. Một tên người hôm nay
  một dòng, ngày mai một dòng rưỡi, vẫn là `ALIGN-2` ngay từ đầu.
- `ALIGN-0`: `ALIGN-2` **giữ** chiều đo tự nhiên của mỗi con; `ALIGN-0` **xoá** nó. Con có viền hay
  nền thì khác biệt này nhìn thấy ngay.
- `ALIGN-3`: cùng là "một mép", nhưng `ALIGN-2` neo vào chỗ nội dung **bắt đầu**, `ALIGN-3` neo vào
  chỗ nội dung **kết thúc**.

**Tình huống nghiệp vụ hay gặp.** Ảnh đại diện + tên + bình luận nhiều dòng · biểu tượng + tiêu đề + mô tả trong
một khối nhấn mạnh · hộp kiểm + điều khoản dài · số thứ tự + câu hỏi dài · hai cột nội dung phải cùng bắt
đầu ở mép trên · một cột chứa nhãn và mô tả, dạt về mép đầu.

---

## `ALIGN-3` — mỗi con có chiều dài riêng, kết thúc cùng nhau

**Tình huống.** Mép **cuối** mới là chỗ có nghĩa. Trong một **cột**, đây là cách một cụm dạt về phía
cuối theo hướng đọc. Trong một **hàng**, đây là các con cùng đứng trên một sàn chung.

**Dấu hiệu nhận biết**

- Cột: cụm giá, cụm thời gian, cụm hành động ở ô cuối của một tài liệu.
- Hàng: các cột của một biểu đồ cùng mọc lên từ một sàn.
- Con số đọc từ phải sang (tiền, phần trăm) và cần thẳng mép cuối với nhau.

**Tự hỏi.** Cái người đọc so sánh giữa các con là chỗ chúng **kết thúc**, hay chỗ chúng **bắt đầu**?

**Ranh giới**

- `ALIGN-4`: trong một **hàng**, `items-end` gần như luôn là nhầm lẫn của `items-baseline`. Chữ có
  phần dưới dòng (`g`, `y`, `p`) và khoảng đệm của hộp chữ khiến "cùng đáy hộp" **không** bằng "cùng
  dòng viết". Nếu các con là chữ — dùng `ALIGN-4`.
- `ALIGN-2`: trong một **cột**, hai mã này là hai mép đối nhau. Chọn theo mép nào mang nghĩa so
  sánh.
- `ALIGN-7`: `ALIGN-3` là **trục chéo**, `ALIGN-7` là **trục chính**. Trong một cột, dạt các con
  sang mép cuối là `ALIGN-3`; dồn cả cụm xuống đáy cột là `ALIGN-7`.

**Tình huống nghiệp vụ hay gặp.** Cột chứa số tiền dạt mép cuối · cụm thời gian ở ô cuối một dòng
danh sách · nhóm nút trong một cột biểu mẫu · các cột biểu đồ mọc từ một sàn · cụm trạng thái dạt về cuối
một thẻ.

---

## `ALIGN-4` — chữ khác cỡ đứng trên một dòng viết

**Tình huống.** Hai hay nhiều mẩu chữ **khác cỡ** phải được đọc thành **một giá trị** hoặc **một
câu**. Đây là mã làm cho một con số và đơn vị của nó đọc thành một thứ chứ không phải hai.

**Dấu hiệu nhận biết**

- Mọi con đều là chữ, không con nào là hình.
- Cỡ chữ giữa các con lệch nhau rõ rệt: một số lớn cạnh một nhãn nhỏ.
- Đọc to lên thì thành **một** cụm từ: "42 bài", "799.000đ mỗi tháng", "4,9 trên 5".

**Tự hỏi.** Đọc to cả hàng lên, nó là **một** cụm từ hay hai mẩu tin rời nhau?

**Vì sao không phải `ALIGN-1`.** `items-center` treo các con vào **tâm hộp chữ** của chúng. Hộp chữ
của cỡ nhỏ thấp hơn hộp chữ của cỡ lớn, nên khi hai tâm trùng nhau thì **hai chân chữ lệch nhau**.
Mắt người đọc theo chân chữ, không theo tâm hộp — nên cụm bị đọc thành hai thứ. `items-baseline` cho
chúng đứng chung một chân, và cụm trở lại thành một giá trị.

**Ranh giới**

- `ALIGN-1`: có **bất kỳ** con nào là biểu tượng, ảnh đại diện, nhãn trạng thái nền, ô vuông màu — quay về `ALIGN-1`.
  Ngoại lệ duy nhất là khi "biểu tượng" thực chất là một ký tự chữ.
- `ALIGN-3`: cùng đáy hộp không phải cùng dòng viết. Xem trên.
- `ALIGN-2`: nếu một con là đoạn nhiều dòng, dòng viết chung chỉ còn là dòng **đầu tiên** của nó —
  đúng khi đó là câu tiếp diễn, sai khi đó là một khối riêng.

**Tình huống nghiệp vụ hay gặp.** Số liệu + đơn vị · giá + chu kỳ · điểm + thang điểm · số lượng +
danh từ đếm · giá hiện tại + giá gạch + mức giảm · tên + nhãn phụ cùng dòng · số trang + tổng số
trang · tiêu đề + số đếm nhỏ bên cạnh.

---

## `ALIGN-5` — một con đi chệch khỏi luật của cha

**Tình huống.** Cha đã tuyên bố một luật đúng cho **hầu hết** các con, và **đúng một** con có lý do
nghiệp vụ riêng để không theo.

**Dấu hiệu nhận biết**

- Cha là `ALIGN-2` cho phần chữ dài, nhưng một nút hành động phải nằm giữa hàng.
- Cha là `ALIGN-0` cho các cột cao bằng nhau, nhưng một ô chỉ chứa một biểu tượng và không được kéo.
- Số con đi chệch là **một**. Từ hai con trở lên thì luật của cha đã sai, không phải con đi chệch.

**Tự hỏi.** Nếu bỏ con này ra, luật của cha còn **đúng cho tất cả** những con còn lại không? Nếu có —
`ALIGN-5`. Nếu không — sửa luật của cha.

**Ranh giới**

- mọi mã trục chéo: `ALIGN-5` **không** thay thế câu trả lời của cha; nó chỉ miễn trừ cho một con.
  Cha vẫn phải mang mã của mình, đọc được, khai báo rõ.
- `ALIGN-7`: một con **tự** dạt về mép cuối trên **trục chính** không phải việc của mô-đun này. Đó
  là một con dùng khoảng trắng tự động để đẩy chính nó, thuộc luật lề ngoài.

**Tình huống nghiệp vụ hay gặp.** Một nút nằm giữa hàng trong khi phần chữ neo mép trên · một biểu tượng
không bị kéo trong hàng các cột cao đều · một ô lưới tự kéo hết chiều cao trong khi các ô khác neo
mép trên · một nhãn trạng thái treo giữa trong cụm chữ nhiều dòng.

---

## `ALIGN-6` — cụm bắt đầu ở mép nội dung, không khai báo

**Tình huống.** Nội dung thuộc về **mép đầu** của luồng đọc, và chỗ trống thừa rơi về phía sau. Đây
là mặc định và là câu trả lời đúng cho tuyệt đại đa số hàng.

**Dấu hiệu nhận biết**

- Các con nối tiếp nhau theo thứ tự đọc, không con nào "thuộc về" mép cuối.
- Vùng chứa không rộng hơn nội dung, hoặc chỗ thừa không mang nghĩa gì.

**Tự hỏi.** Chỗ trống thừa có **mang nghĩa** không? Nếu không — để nó rơi về sau và không khai báo gì.

**Ranh giới**

- `ALIGN-9`: xem `ALIGN-9`. Đây là ranh giới bị vượt sai nhiều nhất trong cả mô-đun.
- `ALIGN-8`: nội dung thuộc về mép đọc thì ở lại mép đọc. Chỉ nội dung **không thuộc về mép nào**
  mới ra giữa.

**Không viết `justify-start`.** Nó không nói thêm gì so với mặc định.

**Tình huống nghiệp vụ hay gặp.** Hàng biểu tượng + chữ · cụm bộ lọc nhãn nhỏ · đường dẫn phân cấp · cụm thẻ thẻ · hàng
nút trong một thanh công cụ · mọi hàng nội dung thông thường.

---

## `ALIGN-7` — cả cụm thuộc về mép cuối

**Tình huống.** **Toàn bộ** nội dung của vùng chứa thuộc về mép cuối theo hướng chảy. Không phải một
con bị đẩy đi — mà cả cụm vốn dĩ ở đó.

**Dấu hiệu nhận biết**

- Vùng chứa chỉ chứa **một loại** thứ: một nhóm nút, một cụm meta.
- Thêm một con nữa thì con mới cũng thuộc về mép cuối, đứng cạnh những con đang có.
- Trong cột (`flex-col`), đây là dồn cả cụm về **đáy** vùng cao hơn nội dung.

**Tự hỏi.** Nếu thêm một con nữa vào vùng chứa này, nó sẽ đứng **cạnh** cụm hiện tại ở mép cuối, hay
sẽ tách ra mép đối diện?

**Ranh giới**

- `ALIGN-9`: `ALIGN-7` là **một** cụm ở mép cuối; `ALIGN-9` là **hai** phía đối nghịch. Một phần cuối
  chỉ có nút là `ALIGN-7`; một phần đầu có tiêu đề bên này và nút bên kia là `ALIGN-9`.
- luật lề ngoài: nếu vùng chứa có nhiều thứ bắt đầu từ mép đầu và **một** con phải nhảy về cuối, đó
  là con tự đẩy mình bằng khoảng trắng tự động, không phải vùng chứa đổi cách xếp.
- `ALIGN-3`: `ALIGN-3` là trục chéo. Trong một hàng, dạt cụm sang mép cuối là `ALIGN-7`; cho các
  con đứng chung một sàn là `ALIGN-3`.

**Tình huống nghiệp vụ hay gặp.** Nhóm nút ở chân một hộp thoại · nhóm nút ở chân biểu mẫu · cụm hành
động ở chân một thẻ · phân trang dạt mép cuối · cụm meta ở cuối một dòng.

---

## `ALIGN-8` — cụm không thuộc về mép nào

**Tình huống.** Nội dung là một **thông báo độc lập** với chính vùng chứa nó: nó không tiếp nối luồng
đọc từ mép nào cả, nên đứng giữa chỗ trống.

**Dấu hiệu nhận biết**

- Vùng chứa rộng hơn hẳn nội dung, và chỗ trống hai bên là **cố ý**.
- Nội dung nói về **cả vùng**: trạng thái rỗng, trạng thái đang tải, lỗi của cả khối.
- Bỏ nội dung đi thì vùng đó trống hoàn toàn.

**Tự hỏi.** Nội dung này **tiếp nối** luồng đọc từ một mép, hay nó nói về **cả vùng** đang trống?

**Ranh giới**

- `ALIGN-6`: nội dung tiếp nối luồng đọc thì ở lại mép đọc, kể cả khi vùng rất rộng.
- luật lề ngoài: căn giữa **một khối có bề rộng giới hạn** trong một cha **không phải** flex là việc
  của lề ngoài. `ALIGN-8` chỉ áp dụng khi cha thật sự là flex hoặc lưới.
- luật kiểu chữ: căn giữa **chữ bên trong** một hộp là căn chữ, không phải căn hộp. Hai thứ này
  hay bị viết nhầm cho nhau và thường phải viết **cả hai** mới ra kết quả mong muốn.

**Tình huống nghiệp vụ hay gặp.** Trạng thái rỗng của một danh sách · biểu tượng đang tải giữa một vùng đang tải ·
thông báo lỗi của cả khối · một ô vuông chứa ảnh đại diện chữ cái · phân trang căn giữa · một CTA đơn độc
giữa một dải.

---

## `ALIGN-9` — chỗ thừa thuộc về khoảng giữa

**Tình huống.** Hai đầu của vùng chứa có **tuyên bố đối nghịch** lên hai mép, hoặc mọi con **ngang
quyền** chia nhau cả chiều dài. Chỗ trống thừa không thuộc về phía nào cả, nên nó nằm **giữa**.

**Dấu hiệu nhận biết**

- Đầu này là "cái này là gì", đầu kia là "làm gì với nó".
- Hai vai trò **không** đổi chỗ được cho nhau mà nghĩa vẫn giữ nguyên.
- Hoặc: các con là một tập ngang quyền chia đều một dải (`justify-evenly`).

**Tự hỏi.** Nếu thêm một con thứ ba vào, nó có **chỗ đứng chính đáng ở giữa** không? Nếu không — hai
con này không đối nghịch, và mã đúng là `ALIGN-6` với con cuối tự đẩy mình.

**Vì sao câu hỏi đó là câu quyết định.** `justify-between` phát biểu rằng **mọi** con đều có tuyên bố
lên chỗ trống. Khi người viết chỉ muốn đẩy một con sang cuối, phát biểu đó sai, và cái sai lộ ra
đúng lúc số con thay đổi: một con hiển thị có điều kiện biến mất thì hai con còn lại **văng ra hai
mép**, và bố cục đổi hình mà không ai sửa gì.

**Ranh giới**

- `ALIGN-6`: xem trên.
- `ALIGN-7`: `ALIGN-7` là một cụm ở mép cuối, `ALIGN-9` là hai phía đối nghịch.
- luật khoảng cách: `justify-between` **tiêu** chỗ trống sẵn có, `gap` **tạo** khoảng cách. Vùng chứa không
  rộng hơn nội dung thì `justify-between` không làm gì cả — nó "chạy được" trên bản mô phỏng rộng rồi hỏng
  trong một cột hẹp.
- `justify-around` và `justify-evenly` chỉ đúng khi các con **ngang quyền**. `around` cho mỗi con một
  phần lề riêng nên mép ngoài hẹp hơn khoảng giữa; `evenly` chia đều mọi khoảng. Nếu không nói được
  vì sao mép ngoài phải hẹp hơn thì dùng `evenly`.

**Tình huống nghiệp vụ hay gặp.** Tiêu đề phần nội dung bên này + nút "Xem tất cả" bên kia · tên mục + giá
trị của mục trong một dòng danh sách · nhãn + giá trị trong một dòng tóm tắt · nút Quay lại + nút
Tiếp tục ở hai đầu · thanh điều hướng dưới cùng chia đều các mục · nhãn cực trị hai đầu một thanh
trượt.

---

## `ALIGN-10` — các dòng treo vào đâu

**Tình huống.** Vùng chứa cho phép xuống dòng, thực tế đã có **nhiều dòng**, và vùng chứa **sở hữu**
một chiều đo trục chéo lớn hơn tổng các dòng. Lúc đó phải nói các dòng treo vào đâu trong chỗ thừa
ấy.

**Dấu hiệu nhận biết**

- Vùng chứa có `flex-wrap` **và** một chiều cao (hoặc chiều cao tối thiểu) do nó tự đặt.
- Số dòng thay đổi theo dữ liệu, còn chiều cao thì không.

**Tự hỏi.** Vùng chứa này có **thật sự** sở hữu một chiều đo trục chéo lớn hơn nội dung không? Nếu
không — không có chỗ thừa nào để chia, và mã này không phát ra gì.

**Ranh giới**

- `ALIGN-0` … `ALIGN-4`: những mã kia nói **các con trong một dòng** treo vào đâu; `ALIGN-10` nói
  **các dòng trong vùng chứa** treo vào đâu. Một vùng chứa xuống dòng có thể mang cả hai, và chúng
  trả lời hai câu khác nhau.
- **Câu trả lời đúng thường là bỏ chiều cao đi.** Phần lớn trường hợp cần `content-*` là trường hợp
  vùng chứa được gán một chiều cao mà nó không kiếm được. Chỉ khai báo khi chiều cao đó có lý do
  nghiệp vụ thật.

**Tình huống nghiệp vụ hay gặp.** Dải nhãn nhỏ lọc trong một thanh công cụ cao cố định · lưới huy hiệu trong
một ô cao cố định · nhóm nút xuống dòng trong một thanh có chiều cao tối thiểu.

---

## Luật

1. Chỉ khai báo căn chỉnh trên phần tử **thật sự** là `flex`, `inline-flex` hoặc `grid`. Trên thứ
   khác, class CSS đó không hiển thị gì và không phát biểu gì.
2. Mỗi vùng chứa trả lời **trục chéo một lần** và **trục chính một lần**. Hai câu trả lời độc lập,
   được phép cùng có mặt trên một nút DOM.
3. Căn chỉnh **tiêu** chỗ trống đã có; nó không **tạo** khoảng cách. Khoảng cách giữa các con thuộc
   về `gap` của cha.
4. Căn chỉnh dịch chuyển **hộp**. Căn chữ bên trong một hộp là chuyện khác.
5. Căn chỉnh không đổi **chiều đo** của con. Con phải rộng bằng anh em nó là quyết định về kích
   thước, không phải về căn chỉnh.
6. `start` và `end` là **lô-gic**. Không có luật nào trong mô-đun này nói tới trái hay phải.
7. Chọn mã theo **bản chất của con**, không theo dữ liệu hôm nay hiển thị ra.
8. Một con nhảy sang mép cuối một mình **không** phải câu trả lời trục chính của vùng chứa.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Biểu tượng cạnh chữ.** Luôn là `ALIGN-1`, không bao giờ là `ALIGN-4`. Chân của một biểu tượng là hệ quả của
  cái hộp bao nó, không phải một dòng viết; treo một hình vào dòng viết sẽ đặt nó thấp hơn chỗ mắt
  người đọc chờ đợi.
- **Chữ có thể xuống dòng.** Một hàng mà phần chữ **có thể** dài sang dòng thứ hai là `ALIGN-2` ngay
  từ đầu, kể cả khi dữ liệu hôm nay còn ngắn.
- **Các con cao bằng nhau.** `ALIGN-0` và `ALIGN-2` hiển thị y hệt cho tới ngày một con có ranh giới
  riêng hoặc dài ra. Chọn theo quyền sở hữu ranh giới, không theo cái nhìn thấy.
- **Hai con và một con thứ ba tuỳ chọn.** `ALIGN-9` chỉ đúng khi hai đầu đối nghịch về vai trò. Nếu
  con thứ ba không có chỗ đứng chính đáng ở giữa thì con cuối đang tự đẩy mình đi, và trục chính vẫn
  là `ALIGN-6`.
- **Cha không phải flex hay lưới.** Mô-đun này không phát ra gì. Căn giữa một khối có bề rộng giới
  hạn trong chỗ trống nội tuyến của cha là quyết định về lề ngoài.
- **Trục chính không có chỗ thừa.** `ALIGN-7`, `ALIGN-8`, `ALIGN-9` không làm gì khi nội dung đã lấp
  đầy vùng chứa. Khai báo vẫn đúng; **trông cậy** vào chúng để tạo khoảng cách thì sai.
- **Tính đồng nhất trạng thái.** Giữ nguyên mã qua mọi khung nhìn, mọi hướng chảy và mọi trạng thái tải, trừ
  khi chính vùng chứa đổi. Khung chờ và nội dung thật treo vào cùng một thứ.
- **Đổi hàng thành cột.** Khi `flex-row` đổi thành `flex-col` ở màn hình hẹp, **trục chéo đổi
  hướng**, nên `items-center` đang có nghĩa "cùng cao" bỗng có nghĩa "cùng dạt vào giữa theo chiều
  ngang". Đây không phải ngoại lệ cho phép đổi mã tuỳ ý — nó là lý do phải nêu lại mã ở mỗi
  điểm ngắt mà hướng chảy đổi.
