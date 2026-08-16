---
id: fe-principles-radius-vi
title: vi.md
slug: /fe/principles/radius/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống RADIUS-N, nhận diện bằng ranh giới và phép trừ chứ không bằng mắt.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `radius`

# Bán kính bo góc

Bán kính bo góc là độ bo góc mà **một ranh giới** tự mang trên chính nó, và — khi ranh giới đó nằm bên trong
một ranh giới khác — là **quan hệ hình học** giữa hai đường cong.

Độ bo không được chọn bằng cảm giác "hơi vuông" hay "hơi tròn". Hãy nhìn cái hộp và hỏi hai câu, theo
đúng thứ tự này:

> 1. Nó có phải một ranh giới thật không, và là loại nào?
> 2. Góc của nó có nằm bên trong cung của một góc khác không?

Câu hai thắng câu một. Nếu góc nằm trong một cung khác, bán kính **được tính ra**, không được chọn.

Cả mô-đun chỉ có **một giá trị gốc** là `R` — bậc bề mặt. Chỉ ba giá trị từng được **chọn**: `R / 2`
cho một thành phần điều khiển, `R` cho một bề mặt, và giới hạn suy biến cho một hình vốn dĩ tròn. Mọi con số khác
xuất hiện trong mã đánh dấu đều là **kết quả** của phép trừ `ngoài − khoảng cách`. Con số tự chế là lỗi,
không phải phong cách.

**Đây là luật bắt buộc.** Mọi thứ hiển thị ra đều rơi vào đúng một mã dưới đây. Không có kích thước nào
nhỏ đến mức được miễn: một góc trong 2px của tấm ảnh tràn viền là `RADIUS-4`, đúng cùng một lý do mà
một tấm hộp thoại là `RADIUS-2`. Câu "có mấy điểm ảnh ai thấy đâu" là chỗ luật này bị bỏ qua nhiều nhất — và
mấy điểm ảnh đó đúng là cỡ mà một góc sai bị **cảm thấy** trước khi bị **nhìn thấy**.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `RADIUS-0` | Không mang góc nào: hộp xếp trong suốt, ô trong bảng, hàng đã bị cha cắt — hoặc một ranh giới thật **từ chối** bo | *không khai báo class CSS*, hoặc `rounded-none` |
| `RADIUS-1` | Một thành phần điều khiển: nút, ô nhập, phần tử trình đơn — góc tự do, không nằm trong cung nào | `rounded-md` |
| `RADIUS-2` | Một bề mặt: thẻ, hộp thoại, cửa sổ nổi, khối nhấn mạnh — ranh giới sở hữu cả một vùng nội dung | `rounded-xl` |
| `RADIUS-3` | Bản thân hình là hình tròn hoặc viên nhộng: ảnh đại diện, nhãn trạng thái đếm, nhãn bo tròn, rãnh tiến độ | `rounded-full` |
| `RADIUS-4` | **Góc nằm trong cung của góc ngoài** — bán kính = `ngoài − khoảng cách`, làm tròn xuống | `rounded-lg` · `rounded-md` · `rounded` · `rounded-sm` |
| `RADIUS-5` | Không phải cả bốn góc đều tự do: bị mép màn hình cắt, hoặc ghép vào hàng xóm | dạng theo cạnh/góc: `rounded-t-xl`, `rounded-l-md`, `first:rounded-t-md`… |

Với thang mà bộ mã này viết theo: `R = 0.75rem` (`rounded-xl`), bậc thành phần điều khiển đúng bằng `R / 2` =
`0.375rem` (`rounded-md`). Các giá trị suy ra rơi vào `0.5rem` (`rounded-lg`), `0.375rem`
(`rounded-md`), `0.25rem` (`rounded`) và `0.125rem` (`rounded-sm`).

Bảng trừ, để khỏi phải nhẩm:

| Góc ngoài | Khoảng cách (khoảng đệm trong + đường viền) | Kết quả | Class CSS |
|---|---|---|---|
| `rounded-xl` (12px) | 4px (`p-1`) | 8px | `rounded-lg` |
| `rounded-xl` (12px) | 6px (`p-1.5`, hoặc `p-1` + đường viền 2px) | 6px | `rounded-md` |
| `rounded-xl` (12px) | 8px (`p-2`) | 4px | `rounded` |
| `rounded-xl` (12px) | 10px (`p-2.5`) | 2px | `rounded-sm` |
| `rounded-xl` (12px) | ≥ 12px (`p-3` trở lên) | — | **hết ràng buộc**, hộp trong tự chọn mã của nó |
| `rounded-lg` (8px) | 4px (`p-1`) | 4px | `rounded` |
| `rounded-md` (6px) | 4px (`p-1`) | 2px | `rounded-sm` |

---

## `RADIUS-0` — không mang góc nào

**Tình huống.** Hoặc phần tử **không phải** một ranh giới, hoặc nó là ranh giới thật nhưng **từ chối**
bo góc. Hai chuyện khác nhau, nên phát ra hai thứ khác nhau.

**Dấu hiệu nhận biết**

- Không nền, không viền, không đổ bóng, không cắt nội dung — chỉ xếp con cái thành hàng, cột hoặc lưới.
- Hoặc: là hàng/ô nằm trong một cha đã `overflow-hidden` và cha đã bo sẵn.
- Hoặc: là một mặt phẳng thật nhưng chạm cả hai mép màn hình, nên không còn góc nào để bo.

**Tự hỏi.** Ở đây có một ranh giới thật không? Không có ⇒ **không viết class CSS nào**. Có, mà cố tình
không bo ⇒ **viết `rounded-none`**.

**Ranh giới**

- `RADIUS-1` và `RADIUS-2`: hai mã đó cần một ranh giới **có vẽ ra**. Một `div` chỉ để `flex` thì
  không phải ranh giới, dù nó bọc quanh thứ gì.
- `RADIUS-4`: hàng nằm trong thẻ đã cắt xén là `RADIUS-0`, **không** phải `RADIUS-4`. Nó không có góc
  riêng để suy ra; cha đang cắt nó.
- `RADIUS-5`: `RADIUS-5` vẫn bo, chỉ là bo một phía. `RADIUS-0` không bo gì hết.

**Vì sao hai phát ra khác nhau.** `rounded-none` là một **lời tuyên bố**: có người đã nhìn cái ranh
giới này, thấy nó lẽ ra sẽ bo, và quyết định không. Không có class CSS là **sự vắng mặt**: không ai phải
quyết gì cả. Viết `rounded-none` lên một `div` xếp hàng là nói dối rằng ở đó từng có một quyết định.

**Tình huống nghiệp vụ hay gặp.** Lớp bọc `flex`/`grid` · ô trong bảng dữ liệu · hàng trong danh sách
có đường phân cách mà cha đã cắt xén · dải thông báo chạy hết chiều ngang màn hình · phần đầu dính trần trang ·
khung biến thành tràn toàn chiều rộng ở thiết bị di động · ảnh nền tràn viền · phần tử ghi đè một class CSS chung có sẵn bo.

---

## `RADIUS-1` — bậc thành phần điều khiển

**Tình huống.** Một ranh giới cỡ **một thao tác**: người dùng bấm nó, gõ vào nó, hoặc chọn nó. Nó
đứng một mình, góc của nó không nằm trong cung của ai.

**Dấu hiệu nhận biết**

- Chiều cao cỡ một dòng chữ cộng khoảng đệm trong, không phải một vùng nội dung.
- Nó có trạng thái tương tác: rê chuột, tiêu điểm, bị vô hiệu hoá, checked.
- Nó không chứa cấu trúc — bên trong chỉ là chữ, biểu tượng, hoặc cả hai.

**Tự hỏi.** Đây có phải một thao tác đơn lẻ, và góc của nó có đang ở xa mọi cung khác không?

**Ranh giới**

- `RADIUS-2`: thành phần điều khiển **làm một việc**; bề mặt **chứa nhiều việc**. Một nút là `RADIUS-1`; một thẻ
  chứa nút đó là `RADIUS-2`. Kích thước không phải tiêu chí — một nút rất rộng vẫn là thành phần điều khiển.
- `RADIUS-3`: nếu hình vốn là viên nhộng thì đó là `RADIUS-3`. Câu hỏi là "đây là hình chữ nhật
  được bo, hay bản thân hình là tròn?".
- `RADIUS-4`: nếu thành phần điều khiển nằm sát trong một bề mặt với khoảng cách **nhỏ hơn** bán kính bề mặt,
  bán kính của nó bị suy ra. `RADIUS-4` thắng.

**`R / 2` chứ không phải một con số mới.** Bậc thành phần điều khiển không phải một giá trị độc lập được ai đó thấy
đẹp; nó là **một nửa** bậc bề mặt. Vì thế thang này không có chỗ để cãi nhau: đổi `R` thì bậc thành phần điều khiển
đổi theo, tự động, đúng tỉ lệ.

**Tình huống nghiệp vụ hay gặp.** Nút chính và nút phụ · ô nhập, textarea, ô chọn · nút biểu tượng vuông ·
phần tử trong trình đơn thả xuống · chú giải · thẻ/nhãn nhỏ vuông · ô hộp kiểm lớn · thẻ ngày trong lịch · nút
phân trang · ô nhập mã OTP.

---

## `RADIUS-2` — bậc bề mặt

**Tình huống.** Một ranh giới **sở hữu cả một vùng nội dung**: nó có nền hoặc viền riêng, và bên trong
nó là một cấu trúc chứ không phải một dòng chữ.

**Dấu hiệu nhận biết**

- Bên trong có nhiều nhóm, có tiêu đề riêng, hoặc có cả thành phần điều khiển lẫn nội dung.
- Nó có khoảng đệm trong riêng — chính con số đó sẽ nuôi phép trừ của `RADIUS-4` ở tầng dưới.
- Bỏ nó đi thì nội dung bên trong mất chỗ dựa, không chỉ mất trang trí.

**Tự hỏi.** Cái hộp này có đang **chứa một vùng** không, hay chỉ đang **là một thao tác**?

**Ranh giới**

- `RADIUS-1`: xem trên.
- `RADIUS-4`: bề mặt lồng trong bề mặt với khoảng cách nhỏ hơn bán kính ngoài thì **không** lấy
  `rounded-xl` lần nữa. Đó chính là con dấu dán mà mô-đun này tồn tại để chặn.
- `RADIUS-0`: bề mặt chạm hai mép màn hình thì không còn góc — `rounded-none`.

**To hơn không tròn hơn.** Một hộp thoại không được bo tròn hơn một thẻ chỉ vì nó lớn hơn. Kích thước
không phải một lý lẽ; nếu nó là lý lẽ thì mỗi màn hình lại có một bán kính riêng và cả hệ thống mất
gốc. Cùng vai trò ⇒ cùng bậc.

**Tình huống nghiệp vụ hay gặp.** Thẻ khoá học · hộp thoại xác nhận · cửa sổ nổi và trình đơn nổi · khối nhấn mạnh
cảnh báo · khối mã · trạng thái rỗng · ảnh ảnh thu nhỏ đứng riêng · khung bên phải · thông báo nổi · khối
biểu đồ · biểu mẫu đăng nhập trên nền trang.

---

## `RADIUS-3` — bản thân hình là tròn

**Tình huống.** Không phải "hình chữ nhật được bo nhiều", mà là **hình tròn hoặc viên nhộng**. Cung
không nằm ở góc; cung **là cả hai đầu**.

**Dấu hiệu nhận biết**

- Chiều cao và chiều rộng bằng nhau (tròn), hoặc hai đầu là nửa đường tròn (viên nhộng).
- Nội dung bên trong ngắn và luôn ngắn: một chữ cái, một con số, một hai từ.
- Đổi bán kính đi một bậc thì hình **mất danh tính**, không phải "hơi khác".

**Tự hỏi.** Nếu bo ít đi một bậc, cái này còn là chính nó không?

**Ranh giới**

- `RADIUS-1`: một nút hình viên nhộng là `RADIUS-3`; một nút chữ nhật là `RADIUS-1`. Trong cùng một
  màn, đừng trộn hai kiểu cho cùng một hạng nút — đó là hai danh tính khác nhau.
- `RADIUS-4`: `RADIUS-3` **miễn trừ** phép trừ. Ảnh đại diện nằm trong thẻ không suy ra gì cả.

**Vì sao miễn trừ.** Phép trừ đồng tâm tác động lên một **góc**. Viên nhộng không có góc; cung của
nó bị chặn bởi chiều cao, không phải bởi một bán kính chọn được. Bắt nó tham gia số học sẽ ra một con
số vô nghĩa, và bắt nó **cấp** số cho con bên trong cũng vậy — một vòng tròn nhỏ trong một vòng tròn
lớn vẫn cứ là vòng tròn.

**Tình huống nghiệp vụ hay gặp.** Ảnh đại diện · nhãn trạng thái đếm thông báo · nhãn bo tròn lọc · nút biểu tượng tròn · rãnh và
lấp đầy của thanh tiến độ · công tắc và nút gạt của nó · chấm trạng thái · biểu tượng đang tải · nút hành động nổi ·
huy hiệu hạng · dấu chấm phân trang.

---

## `RADIUS-4` — góc trong nằm trong cung góc ngoài

**Tình huống.** Một ranh giới nằm bên trong một ranh giới đã bo, và **khoảng cách giữa hai mép nhỏ
hơn bán kính ngoài**. Lúc đó góc trong nằm gọn trong cung ngoài, và nó **không còn quyền tự chọn**:

> `bán kính trong = bán kính ngoài − khoảng cách`, làm tròn **xuống** bậc gần nhất.

Khoảng cách là **khoảng cách đo được giữa hai mép**: khoảng đệm trong của cha, cộng độ dày đường viền nếu cha có vẽ
đường viền.

**Dấu hiệu nhận biết**

- Hộp trong chạm tới sát ba hoặc bốn mép trong của hộp ngoài, chỉ cách một lớp khoảng đệm trong mỏng.
- Bốn góc của hộp trong nằm ngay bên trong bốn góc của hộp ngoài.
- Nhìn vào một góc thấy **hai đường cong**, và câu hỏi là chúng có song song không.

**Tự hỏi.** Khoảng cách giữa hai mép có **nhỏ hơn** bán kính ngoài không? Nếu có — bán kính bị suy ra,
mọi mã bậc thang đều thua.

**Ranh giới**

- `RADIUS-1` và `RADIUS-2`: hai mã đó **chọn**; mã này **tính**. Nếu tính được thì phải tính, vì
  một góc suy ra sống sót qua lần đổi khoảng đệm trong tiếp theo, còn một góc chọn tay thì không.
- khi khoảng cách **bằng hoặc lớn hơn** bán kính ngoài: hết ràng buộc. Góc trong đã ra khỏi cung
  ngoài, hai đường cong không còn nhìn thấy nhau, và hộp trong quay về `RADIUS-1` hoặc `RADIUS-2`
  theo đúng vai trò của nó. Đây là **giới hạn của luật**, không phải một lối thoát: nó là hình học,
  không phải sự cho phép bo bằng mắt.
- `RADIUS-0`: nếu hộp trong chạm **thẳng** vào mép hộp ngoài, khoảng cách bằng 0, và lời giải không
  phải "bán kính bằng bán kính ngoài" mà là **cha cắt xén, con để trơn**. Hai phần tử cùng bo một góc là
  khai báo cùng một góc hai lần, và hai khai báo đó sẽ lệch nhau ở lần sửa đầu tiên.
- `RADIUS-3`: viên nhộng miễn trừ.

**Vì sao làm tròn xuống.** Nếu kết quả rơi giữa hai bậc, lấy bậc **dưới**. Bán kính trong lớn hơn
`ngoài − khoảng cách` là đúng cái làm hai cung cắt nhau, tức là cái con dấu dán. Nhỏ hơn một chút thì
chỉ hơi vuông hơn cần thiết — sai lệch đó không ai đọc ra được. Sai về phía an toàn có tên, và tên nó
là "xuống".

**Mã nói cách lấy giá trị, không nói giá trị bằng bao nhiêu.** `rounded-md` chọn cho một nút là
`RADIUS-1`. Cũng `rounded-md` đó, ra từ `12 − 6`, là `RADIUS-4`. Hai mã in ra cùng một chuỗi nhưng
không bao giờ ra cùng một quyết định: đổi khoảng đệm trong cha thì cái thứ hai phải đổi, cái thứ nhất thì không.

**Tình huống nghiệp vụ hay gặp.** Ảnh bìa tràn trong thẻ có khoảng đệm trong mỏng · khối "well" tóm tắt bên
trong thẻ · ô nhập nằm sát trong một khung bo · ảnh đại diện-frame vuông trong thẻ · hàng được chọn trong
một trình đơn bo · ảnh thu nhỏ trong danh sách-phần tử bo · vùng bản xem trước trong hộp thoại · nút full-chiều rộng dính đáy một
bảng trượt · khối mã trong khối nhấn mạnh · phân đoạn đang chọn trong một rãnh bo · ảnh trong khung có đường viền.

---

## `RADIUS-5` — không phải cả bốn góc đều tự do

**Tình huống.** Ranh giới **bị cắt** hoặc **bị ghép**. Một hoặc nhiều cạnh của nó không kết thúc trên
màn hình, hoặc chạm khít vào một phần tử khác, nên ở phía đó không có góc nào để bo.

**Dấu hiệu nhận biết**

- Mặt phẳng neo vào một mép màn hình và chạy tràn ra khỏi mép đó.
- Nhiều phần tử xếp khít, chỉ phần tử đầu và cuối chạm ra ngoài khối chung.
- Một phần tử dính vào phần tử kế bên, không có khoảng cách giữa các phần tử giữa chúng.

**Tự hỏi.** Ở phía này còn tồn tại một góc không, hay cạnh đó chạy tiếp ra khỏi tầm nhìn / dính vào
hàng xóm?

**Ranh giới**

- `RADIUS-0`: nếu **không** phía nào còn góc thì đó là `RADIUS-0`, không phải `RADIUS-5`.
- `RADIUS-1` / `RADIUS-2`: nếu cả bốn góc đều tự do thì dùng mã bậc, không dùng dạng theo cạnh.
- `RADIUS-4`: hai mã này **chồng lên nhau được**, và khi chồng thì `RADIUS-4` quyết định **độ lớn**,
  `RADIUS-5` quyết định **góc nào**. Ảnh tràn ngang trên đầu một thẻ có khoảng đệm trong mỏng lấy giá trị suy
  ra, ở dạng `rounded-t-*`.

**Độ lớn không đổi vì bị cắt.** Một dưới bảng trượt không được bo to hơn ở hai góc trên chỉ vì hai góc
dưới biến mất. Mã này chỉ nói **góc nào tồn tại**; **tồn tại tròn bao nhiêu** vẫn do mã bậc hoặc phép
trừ trả lời. Trộn hai câu hỏi vào một là cách một hệ thống có hai bán kính bề mặt mà không ai nhớ vì
sao.

**Tình huống nghiệp vụ hay gặp.** Dưới bảng trượt trên thiết bị di động · ngăn trượt trượt từ cạnh · nhóm nút phân đoạn
ghép sát · nhóm nút dính nhau · phần tử đầu và cuối của một cụm xếp dọc ghép · thẻ tab đang chọn bo hai góc trên
· ảnh bìa nằm trên cùng một thẻ không khoảng đệm trong · phần đầu của bảng · thanh tìm kiếm dính với nút bên
cạnh · biểu ngữ neo đáy màn hình.

---

## Luật

1. Chỉ xét **một ranh giới thật** tại một thời điểm. Không ranh giới thì không có bán kính.
2. Chỉ ba giá trị được **chọn**: `R / 2`, `R`, và viên nhộng. Mọi giá trị khác phải là **kết quả**.
3. Nếu góc nằm trong cung của một góc khác, bán kính **được tính**: `ngoài − khoảng cách`, làm tròn
   xuống. Suy ra thắng chọn tay.
4. Khoảng cách là **đo được**: khoảng đệm trong cộng đường viền của hộp ngoài. Không ước lượng từ ảnh chụp.
5. Khoảng cách bằng hoặc lớn hơn bán kính ngoài ⇒ hết ràng buộc, hộp trong tự chọn mã.
6. Khoảng cách bằng 0 ⇒ **cha cắt xén**, con để trơn. Không bao giờ bo cùng một góc ở hai nơi.
7. Viên nhộng không tham gia số học, cả chiều nhận lẫn chiều cấp.
8. Bán kính **không** đổi theo khung nhìn, rê chuột, tiêu điểm, trạng thái tải hay độ dài nội dung.
9. Giá trị tự chế (`rounded-[10px]`) là một đề nghị đổi luật, không phải một lần chọn khác đi.
10. Class CSS theo cạnh và theo góc chỉ thuộc về `RADIUS-5`.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Đường viền tính vào khoảng cách.** Cha có `border` 1px và `p-1` thì khoảng cách là 5px, không phải
  4px. Phép trừ nói về **khoảng cách giữa hai mép**, không quan tâm thuộc tính nào tạo ra nó.
- **Cắt xén thay vì suy ra.** Con phải chạm mép cha ⇒ cha `overflow-hidden`, con `RADIUS-0`. Đây là ngoại
  lệ duy nhất cho phép một phần tử hiện ra bo mà không tự khai bán kính.
- **Viên nhộng miễn trừ.** `RADIUS-3` nằm trong một bề mặt bo vẫn là `RADIUS-3`.
- **Khoảng cách ≥ bán kính ngoài.** Không phải ngoại lệ của đồng tâm mà là **mép** của nó. Hộp trong
  tự do, và tự do đó là hình học chứ không phải giấy phép.
- **Hai mã cùng khớp.** Ưu tiên `RADIUS-4`. Một góc suy ra được mà lại chọn tay là một quả bom hẹn giờ
  đúng bằng lần đổi khoảng đệm trong kế tiếp.
- **Tính đồng nhất trạng thái.** Khung chờ, đang tải, lỗi, rỗng giữ nguyên mã của ranh giới mà chúng thay thế.
  Đổi bán kính khi đang tải là nói dối rằng ranh giới đã đổi.
- **Thiết kế đáp ứng.** Chỉ đổi mã khi ranh giới **thật sự** đổi — ví dụ khung trở thành tràn toàn chiều rộng ở thiết bị di động
  thì nó chuyển sang `RADIUS-0` với `rounded-none`. Màn hình hẹp đi mà ranh giới không đổi thì mã
  không đổi.
- **Vòng tiêu điểm và dàn ý.** Chúng bám theo bán kính của hộp, không cần khai lại. Khai lại là tạo ra
  một nguồn sự thật thứ hai cho cùng một góc.
