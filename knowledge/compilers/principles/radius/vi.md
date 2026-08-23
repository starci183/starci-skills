---
title: Radius · Vietnamese
---

# Bán kính bo góc

## LOADS

None.


## Bản ghi

Nguyên tắc này nhận một yêu cầu viết bằng lời thường — "một thẻ khoá học chừa một viền mỏng quanh ảnh bìa" — và
đầu ra là, với **mỗi ranh giới** mà yêu cầu đó ngụ ý, một mã tình huống và một className. Yêu cầu không
bao giờ nói ra một góc bo, và không được phép ước lượng một góc bo: góc bo suy ra từ việc phần tử là
**loại ranh giới nào**, và từ **khoảng cách đo được** giữa mép của nó với mép bao quanh nó.

## Luật

Một góc bo nói lên phần tử là loại ranh giới nào, và — khi ranh giới đó nằm bên trong một ranh giới
khác — nói lên quan hệ hình học giữa hai đường cong. Chọn nó từ ranh giới và từ khoảng cách đo được,
không bao giờ từ việc nhìn thấy kết quả tròn hay vuông.

Cả mô-đun chỉ có **một giá trị gốc** là `R`, bậc bề mặt. Mọi thứ khác được lấy ra từ nó, không phải
được nhặt bên cạnh nó. Chỉ ba giá trị từng được **chọn**: `R / 2` cho một thành phần điều khiển, `R`
cho một bề mặt, và giới hạn suy biến cho một hình vốn là hình tròn hoặc viên nhộng. Mọi con số khác
xuất hiện trong mã đánh dấu đều là **kết quả** — `ngoài − khoảng cách` — và một kết quả thì đến từ phép
trừ, không đến từ khẩu vị.

Một hộp lồng bên trong mà vẫn giữ nguyên góc bo của hộp bao quanh nó chính là lỗi mà mô-đun này tồn tại
để chặn. Cung của nó không còn chạy song song với cung bên ngoài, hai đường cong cắt nhau, và hộp trong
thôi đọc như một bề mặt lồng nhau mà bắt đầu đọc như một con dấu dán đè lên trên.

**Đây là luật bắt buộc.** Mọi phần tử hiển thị ra hoặc có sở hữu một ranh giới, hoặc không, và cả hai
câu trả lời đều có một mã ở dưới. Không có kích thước nào nhỏ đến mức được miễn: một góc trong 2px của
tấm ảnh tràn viền là `RADIUS-4`, đúng cùng một lý do mà một tấm hộp thoại là `RADIUS-2`. Câu "có mấy
điểm ảnh ai thấy đâu" không phải một sự miễn trừ — đó là chỗ luật này bị bỏ qua nhiều nhất, và mấy điểm
ảnh đó đúng là cỡ mà một góc sai bị **cảm thấy** trước khi bị **nhìn thấy**.

## Mã tình huống

Mỗi tình huống mô-đun này chi phối đều mang một mã, `RADIUS-<chỉ số>`. Mã gọi tên TÌNH HUỐNG; cột
className gọi tên thứ mà tình huống đó phát ra. Hai thứ này không giống nhau, và có một mã **tính ra**
thứ nó phát ra thay vì chọn.

| Mã | Tình huống | className |
|---|---|---|
| `RADIUS-0` | Phần tử không mang góc nào của riêng nó | *không khai báo class bán kính*, hoặc `rounded-none` khi một ranh giới thật từ chối cái góc lẽ ra nó phải mang |
| `RADIUS-1` | Một ranh giới cỡ thành phần điều khiển, góc của nó tự do khỏi mọi cung ngoài | `rounded-md` |
| `RADIUS-2` | Một bề mặt: ranh giới sở hữu cả một vùng nội dung | `rounded-xl` |
| `RADIUS-3` | Bản thân hình là hình tròn hoặc viên nhộng | `rounded-full` |
| `RADIUS-4` | Một ranh giới có góc nằm trong cung của ranh giới khác — bán kính được suy ra | `ngoài − khoảng cách`, làm tròn xuống: `rounded-lg` · `rounded-md` · `rounded` · `rounded-sm` |
| `RADIUS-5` | Không phải cả bốn góc đều tự do: ranh giới bị mép màn hình cắt, hoặc ghép vào hàng xóm | dạng theo cạnh hoặc theo góc của bậc đang giữ độ lớn: `rounded-t-xl`, `rounded-l-md`, `first:rounded-t-md`, … |

`RADIUS-0` LÀ MỘT TÌNH HUỐNG, KHÔNG PHẢI MỘT BẬC, và nó là mã duy nhất có hai kiểu phát ra. Tình huống
là "phần tử này không mang góc nào". Hai kiểu phát ra trả lời một câu hỏi thứ hai, đóng — *ở đây có một
ranh giới thật hay không?*

- **Không có ranh giới.** Một hộp xếp trong suốt, một ô trong bảng có đường kẻ, hoặc một hàng nằm trong
  một cha đã cắt xén sẵn. Nó không có gì để mà bo góc, nên nó phát ra **không class bán kính nào**. Viết
  `rounded-none` lên nó là tuyên bố rằng một ranh giới đã từ chối điều gì đó, trong khi ở đó không có
  ranh giới nào để mà từ chối.
- **Một ranh giới từ chối.** Một bề mặt thật chạy từ mép này sang mép kia — một dải chạm cả hai mép màn
  hình, một khung trở thành tràn toàn chiều rộng ở khung nhìn hẹp, một phần tử ghi đè cái góc nó thừa
  hưởng từ một class chung. Nó phát ra **`rounded-none`**, nói thành lời, vì sự từ chối là một quyết
  định và người đọc phải thấy được rằng quyết định ấy đã được **lấy** chứ không phải bị **quên**.

`RADIUS-4` là mã chịu lực. Nó không phải một bậc trên thang và nó không giữ giá trị nào của riêng mình:
nó là luật rằng một góc nằm trong một góc khác thì phải được **tính ra**. Mọi mã khác trả lời *tròn bao
nhiêu*; mã này trả lời *tròn bao nhiêu so với cái gì*, và nó thắng mọi mã bậc bất cứ khi nào nó áp
dụng được. Suy ra thắng chọn tay.

Thang này in ra `rounded-sm`, `rounded`, `rounded-lg` chỉ như những kết quả, không bao giờ như những
lựa chọn. Đó là toàn bộ cơ chế chống trôi: một giá trị chỉ tồn tại như đầu ra của phép trừ thì không
thể với tới bằng mắt, nên một góc tự chế không có chỗ nào để trốn. Nhìn thấy `rounded-lg` trong một
diff là một lời tuyên bố rằng đã có một phép tính, và khoảng cách chính là bằng chứng.

Với thang mà bộ mã này viết theo: `R = 0.75rem` (`rounded-xl` = 12px), bậc thành phần điều khiển đúng
bằng `R / 2` = `0.375rem` (`rounded-md` = 6px), và các giá trị suy ra rơi vào `rounded-lg` = 8px,
`rounded-md` = 6px, `rounded` = 4px và `rounded-sm` = 2px. Bảng trừ, để khỏi phải nhẩm:

| Góc ngoài | Khoảng cách (khoảng đệm trong + đường viền) | Kết quả | className |
|---|---|---|---|
| `rounded-xl` (12px) | 4px (`p-1`) | 8px | `rounded-lg` |
| `rounded-xl` (12px) | 6px (`p-1.5`, hoặc `p-1` + đường viền 2px) | 6px | `rounded-md` |
| `rounded-xl` (12px) | 8px (`p-2`) | 4px | `rounded` |
| `rounded-xl` (12px) | 10px (`p-2.5`) | 2px | `rounded-sm` |
| `rounded-xl` (12px) | ≥ 12px (`p-3` trở lên) | — | **hết ràng buộc**, hộp trong tự lấy mã của nó |
| `rounded-lg` (8px) | 4px (`p-1`) | 4px | `rounded` |
| `rounded-md` (6px) | 4px (`p-1`) | 2px | `rounded-sm` |

## Đọc một yêu cầu

1. **Liệt kê những ranh giới mà yêu cầu nói ra.** "Một thẻ khoá học chừa một viền mỏng quanh ảnh bìa"
   nói ra hai: cái thẻ, và ảnh bìa nằm trong nó.
2. **Không bịa ra ranh giới mà yêu cầu không hề nhắc.** Một nhãn trạng thái, một ảnh đại diện, một bảng
   trượt đáy hay một biến thể tràn toàn chiều rộng trên di động không nằm trong yêu cầu đó. Giải cái
   được nói ra; phần còn lại giải khi nó xuất hiện.
3. **Giải từ ngoài vào trong**, rồi tới từng ranh giới lồng bên trong. Mỗi ranh giới có đáp án riêng, và
   đáp án ngoài chính là con số mà đáp án kế tiếp đem trừ; một ranh giới không bao giờ thừa hưởng góc
   của cái hộp bao quanh nó.
4. **Với mỗi ranh giới, hỏi lần lượt theo đúng thứ tự này.** Ở đây có một ranh giới được vẽ ra không —
   không thì là `RADIUS-0`. Bản thân hình có phải hình tròn hoặc viên nhộng không — có thì là `RADIUS-3`,
   và dừng ở đó. Khoảng cách tới ranh giới gần nhất bên trên có nhỏ hơn bán kính của ranh giới đó không
   — có thì là `RADIUS-4` và giá trị được tính ra. Nếu không, chọn bậc theo vai trò: một thao tác là
   `RADIUS-1`, một vùng nội dung là `RADIUS-2`. Cuối cùng, hỏi xem cả bốn góc còn tồn tại không; nếu có
   cạnh bị cắt hoặc bị ghép, `RADIUS-5` thu hẹp đáp án về đúng những góc còn lại.
5. **Nếu hai mã cùng khớp, ưu tiên `RADIUS-4`.** `RADIUS-5` không tranh chấp với các mã còn lại — nó
   chồng lên trên, quyết định **góc nào**, còn mã bậc hoặc phép trừ quyết định **tròn bao nhiêu**. Nếu
   thiếu **đúng một** dữ kiện quyết định — bán kính ngoài hoặc khoảng cách — hỏi một câu cụ thể rồi dừng.

## `RADIUS-0` — không mang góc nào

**Khi nào gặp.** Hoặc phần tử **không phải** một ranh giới, hoặc nó là ranh giới thật nhưng **từ chối**
bo góc. Hai chuyện khác nhau, nên phát ra hai thứ khác nhau.

**Cách nhận ra**

- Không nền, không viền, không đổ bóng, không cắt nội dung — chỉ xếp con cái thành hàng, cột hoặc lưới.
- Hoặc: là hàng, là ô nằm trong một cha đã `overflow-hidden` và cha đã bo sẵn.
- Hoặc: là một mặt phẳng thật nhưng chạm cả hai mép màn hình, nên không còn góc nào để bo.

**Tự hỏi.** Ở đây có một ranh giới thật không? Không có ⇒ **không viết class nào**. Có, mà cố tình không
bo ⇒ **viết `rounded-none`**.

**Ranh giới**

- `RADIUS-1` và `RADIUS-2`: hai mã đó cần một ranh giới **có vẽ ra**. Một `div` chỉ để `flex` thì không
  phải ranh giới, dù nó bọc quanh thứ gì.
- `RADIUS-4`: hàng nằm trong thẻ đã cắt xén là `RADIUS-0`, **không** phải `RADIUS-4`. Nó không có góc
  riêng để suy ra; cha đang cắt nó.
- `RADIUS-5`: `RADIUS-5` vẫn bo, chỉ là bo một phía. `RADIUS-0` không bo gì hết.

**Vì sao hai kiểu phát ra khác nhau.** `rounded-none` là một **lời tuyên bố**: có người đã nhìn cái ranh
giới này, thấy nó lẽ ra sẽ bo, và quyết định không. Không có class là **sự vắng mặt**: không ai phải
quyết gì cả. Viết `rounded-none` lên một `div` xếp hàng là nói dối rằng ở đó từng có một quyết định.

**Tình huống nghiệp vụ hay gặp.** Lớp bọc `flex`/`grid` · ô trong bảng dữ liệu · hàng trong danh sách có
đường phân cách mà cha đã cắt xén · dải thông báo chạy hết chiều ngang màn hình · phần đầu dính trần
trang · khung biến thành tràn toàn chiều rộng ở thiết bị di động · ảnh nền tràn viền · phần tử ghi đè
một class chung có sẵn bo.

## `RADIUS-1` — bậc thành phần điều khiển

**Khi nào gặp.** Một ranh giới cỡ **một thao tác**: người dùng bấm nó, gõ vào nó, hoặc chọn nó. Nó đứng
một mình, góc của nó không nằm trong cung của ai.

**Cách nhận ra**

- Chiều cao cỡ một dòng chữ cộng khoảng đệm trong, không phải một vùng nội dung.
- Nó có trạng thái tương tác: rê chuột, tiêu điểm, bị vô hiệu hoá, checked.
- Nó không chứa cấu trúc — bên trong chỉ là chữ, biểu tượng, hoặc cả hai.

**Tự hỏi.** Đây có phải một thao tác đơn lẻ, và góc của nó có đang ở xa mọi cung khác không?

**Ranh giới**

- `RADIUS-2`: thành phần điều khiển **làm một việc**; bề mặt **chứa nhiều việc**. Một nút là `RADIUS-1`;
  cái thẻ chứa nút đó là `RADIUS-2`. Kích thước không phải tiêu chí — một nút rất rộng vẫn là thành phần
  điều khiển.
- `RADIUS-3`: nếu hình vốn là viên nhộng thì đó là `RADIUS-3`. Câu hỏi là "đây là hình chữ nhật được bo,
  hay bản thân hình là tròn?".
- `RADIUS-4`: nếu thành phần điều khiển nằm sát trong một bề mặt với khoảng cách **nhỏ hơn** bán kính
  bề mặt, bán kính của nó bị suy ra. `RADIUS-4` thắng.

**`R / 2` chứ không phải một con số mới.** Bậc thành phần điều khiển không phải một giá trị độc lập được
ai đó thấy đẹp; nó là **một nửa** bậc bề mặt. Vì thế thang này không có chỗ để cãi nhau: đổi `R` thì
bậc thành phần điều khiển đổi theo, tự động, đúng tỉ lệ.

**Tình huống nghiệp vụ hay gặp.** Nút chính và nút phụ · ô nhập, textarea, ô chọn · nút biểu tượng vuông
· phần tử trong trình đơn thả xuống · chú giải · thẻ hoặc nhãn nhỏ vuông · ô hộp kiểm lớn · thẻ ngày
trong lịch · nút phân trang · ô nhập mã OTP.

## `RADIUS-2` — bậc bề mặt

**Khi nào gặp.** Một ranh giới **sở hữu cả một vùng nội dung**: nó có nền hoặc viền riêng, và bên trong
nó là một cấu trúc chứ không phải một dòng chữ.

**Cách nhận ra**

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

**Tình huống nghiệp vụ hay gặp.** Thẻ khoá học · hộp thoại xác nhận · cửa sổ nổi và trình đơn nổi · khối
nhấn mạnh cảnh báo · khối mã · trạng thái rỗng · ảnh thu nhỏ đứng riêng · khung bên phải · thông báo nổi
· khối biểu đồ · biểu mẫu đăng nhập trên nền trang.

## `RADIUS-3` — bản thân hình là tròn

**Khi nào gặp.** Không phải "hình chữ nhật được bo nhiều", mà là **hình tròn hoặc viên nhộng**. Cung
không nằm ở góc; cung **là cả hai đầu**.

**Cách nhận ra**

- Chiều cao và chiều rộng bằng nhau (tròn), hoặc hai đầu là nửa đường tròn (viên nhộng).
- Nội dung bên trong ngắn và luôn ngắn: một chữ cái, một con số, một hai từ.
- Đổi bán kính đi một bậc thì hình **mất danh tính**, không phải "hơi khác".

**Tự hỏi.** Nếu bo ít đi một bậc, cái này còn là chính nó không?

**Ranh giới**

- `RADIUS-1`: một nút hình viên nhộng là `RADIUS-3`; một nút chữ nhật là `RADIUS-1`. Trong cùng một màn,
  đừng trộn hai kiểu cho cùng một hạng nút — đó là hai danh tính khác nhau.
- `RADIUS-4`: `RADIUS-3` **miễn trừ** phép trừ. Ảnh đại diện nằm trong thẻ không suy ra gì cả.

**Vì sao miễn trừ.** Phép trừ đồng tâm tác động lên một **góc**. Viên nhộng không có góc; cung của nó bị
chặn bởi chiều cao, không phải bởi một bán kính chọn được. Bắt nó tham gia số học sẽ ra một con số vô
nghĩa, và bắt nó **cấp** số cho con bên trong cũng vậy — một vòng tròn nhỏ trong một vòng tròn lớn vẫn
cứ là vòng tròn.

**Tình huống nghiệp vụ hay gặp.** Ảnh đại diện · nhãn trạng thái đếm thông báo · nhãn bo tròn lọc · nút
biểu tượng tròn · rãnh và phần lấp đầy của thanh tiến độ · công tắc và nút gạt của nó · chấm trạng thái
· biểu tượng đang tải · nút hành động nổi · huy hiệu hạng · dấu chấm phân trang.

## `RADIUS-4` — góc trong nằm trong cung góc ngoài

**Khi nào gặp.** Một ranh giới nằm bên trong một ranh giới đã bo, và **khoảng cách giữa hai mép nhỏ hơn
bán kính ngoài**. Lúc đó góc trong nằm gọn trong cung ngoài, và nó **không còn quyền tự chọn**:

> `bán kính trong = bán kính ngoài − khoảng cách`, làm tròn **xuống** bậc gần nhất.

Khoảng cách là **khoảng cách đo được giữa hai mép**: khoảng đệm trong của cha, cộng độ dày đường viền
nếu cha có vẽ đường viền.

**Cách nhận ra**

- Hộp trong chạm tới sát ba hoặc bốn mép trong của hộp ngoài, chỉ cách một lớp khoảng đệm trong mỏng.
- Bốn góc của hộp trong nằm ngay bên trong bốn góc của hộp ngoài.
- Nhìn vào một góc thấy **hai đường cong**, và câu hỏi là chúng có song song không.

**Tự hỏi.** Khoảng cách giữa hai mép có **nhỏ hơn** bán kính ngoài không? Nếu có — bán kính bị suy ra,
mọi mã bậc thang đều thua.

**Ranh giới**

- `RADIUS-1` và `RADIUS-2`: hai mã đó **chọn**; mã này **tính**. Nếu tính được thì phải tính, vì một góc
  suy ra sống sót qua lần đổi khoảng đệm trong tiếp theo, còn một góc chọn tay thì không.
- Khi khoảng cách **bằng hoặc lớn hơn** bán kính ngoài: hết ràng buộc. Góc trong đã ra khỏi cung ngoài,
  hai đường cong không còn nhìn thấy nhau, và hộp trong quay về `RADIUS-1` hoặc `RADIUS-2` theo đúng vai
  trò của nó. Đây là **giới hạn của luật**, không phải một lối thoát: nó là hình học, không phải sự cho
  phép bo bằng mắt.
- `RADIUS-0`: nếu hộp trong chạm **thẳng** vào mép hộp ngoài, khoảng cách bằng 0, và lời giải không phải
  "bán kính bằng bán kính ngoài" mà là **cha cắt xén, con để trơn**. Hai phần tử cùng bo một góc là khai
  báo cùng một góc hai lần, và hai khai báo đó sẽ lệch nhau ở lần sửa đầu tiên.
- `RADIUS-3`: viên nhộng miễn trừ.

**Vì sao làm tròn xuống.** Nếu kết quả rơi giữa hai bậc, lấy bậc **dưới**. Bán kính trong lớn hơn
`ngoài − khoảng cách` là đúng cái làm hai cung cắt nhau, tức là con dấu dán. Nhỏ hơn một chút thì chỉ
hơi vuông hơn cần thiết — sai lệch đó không ai đọc ra được. Sai về phía an toàn có tên, và tên nó là
"xuống".

**Mã nói cách lấy giá trị, không nói giá trị bằng bao nhiêu.** `rounded-md` chọn cho một nút là
`RADIUS-1`. Cũng `rounded-md` đó, ra từ `12 − 6`, là `RADIUS-4`. Hai mã in ra cùng một chuỗi nhưng không
bao giờ ra cùng một quyết định: đổi khoảng đệm trong của cha thì cái thứ hai phải đổi, còn cái thứ nhất
thì nằm im và sai.

**Tình huống nghiệp vụ hay gặp.** Ảnh bìa tràn trong thẻ có khoảng đệm trong mỏng · khối "well" tóm tắt
bên trong thẻ · ô nhập nằm sát trong một khung bo · khung ảnh đại diện vuông trong thẻ · hàng được chọn
trong một trình đơn bo · ảnh thu nhỏ trong một phần tử danh sách bo · vùng bản xem trước trong hộp thoại
· nút tràn hết chiều rộng dính đáy một bảng trượt · khối mã trong khối nhấn mạnh · phân đoạn đang chọn
trong một rãnh bo · ảnh trong khung có đường viền.

## `RADIUS-5` — không phải cả bốn góc đều tự do

**Khi nào gặp.** Ranh giới **bị cắt** hoặc **bị ghép**. Một hoặc nhiều cạnh của nó không kết thúc trên
màn hình, hoặc chạm khít vào một phần tử khác, nên ở phía đó không có góc nào để bo.

**Cách nhận ra**

- Mặt phẳng neo vào một mép màn hình và chạy tràn ra khỏi mép đó.
- Nhiều phần tử xếp khít, chỉ phần tử đầu và cuối chạm ra ngoài khối chung.
- Một phần tử dính vào phần tử kế bên, không có khoảng cách giữa các phần tử ở giữa chúng.

**Tự hỏi.** Ở phía này còn tồn tại một góc không, hay cạnh đó chạy tiếp ra khỏi tầm nhìn, hoặc dính vào
hàng xóm?

**Ranh giới**

- `RADIUS-0`: nếu **không** phía nào còn góc thì đó là `RADIUS-0`, không phải `RADIUS-5`.
- `RADIUS-1` / `RADIUS-2`: nếu cả bốn góc đều tự do thì dùng mã bậc, không dùng dạng theo cạnh.
- `RADIUS-4`: hai mã này **chồng lên nhau được**, và khi chồng thì `RADIUS-4` quyết định **độ lớn**,
  `RADIUS-5` quyết định **góc nào**. Ảnh tràn ngang trên đầu một thẻ có khoảng đệm trong mỏng lấy giá
  trị suy ra, ở dạng `rounded-t-*`.

**Bị cắt không đổi độ lớn.** Một bảng trượt đáy không được bo to hơn ở hai góc trên chỉ vì hai góc dưới
biến mất. Mã này chỉ nói **góc nào tồn tại**; **tồn tại tròn bao nhiêu** vẫn do mã bậc hoặc phép trừ trả
lời. Trộn hai câu hỏi vào một là cách một hệ thống có hai bán kính bề mặt mà không ai nhớ vì sao.

**Tình huống nghiệp vụ hay gặp.** Bảng trượt đáy trên thiết bị di động · ngăn trượt trượt từ cạnh · nhóm
nút phân đoạn ghép sát · nhóm nút dính nhau · phần tử đầu và cuối của một cụm xếp dọc ghép · thẻ tab
đang chọn bo hai góc trên · ảnh bìa nằm trên cùng một thẻ không khoảng đệm trong · phần đầu của bảng ·
thanh tìm kiếm dính với nút bên cạnh · biểu ngữ neo đáy màn hình.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| ranh giới | Phần tử có vẽ ra một ranh giới không — nền, viền, đổ bóng, cắt xén — hay sở hữu một ranh giới về mặt ngữ nghĩa |
| vai trò | thành phần điều khiển, bề mặt, hình, ô, hay hộp xếp |
| góc ngoài | Bán kính của tổ tiên gần nhất có vẽ ranh giới, nếu có |
| khoảng cách | Khoảng cách đo được giữa hai mép: khoảng đệm trong của hộp ngoài cộng đường viền nếu nó có vẽ |
| tính liên tục của cạnh | Cả bốn góc có kết thúc trên màn hình không, hay có cạnh bị cắt hoặc bị ghép |

## Quy tắc

1. Chỉ xét **một ranh giới thật** tại một thời điểm. Không ranh giới thì không có bán kính.
2. Chỉ ba giá trị được **chọn**: `R / 2`, `R`, và viên nhộng. Mọi giá trị khác phải là **kết quả**.
3. Nếu góc nằm trong cung của một góc khác, bán kính **được tính**: `ngoài − khoảng cách`, làm tròn
   xuống. Suy ra thắng chọn tay.
4. Khoảng cách là **đo được**: khoảng đệm trong cộng đường viền của hộp ngoài. Không ước lượng từ ảnh
   chụp.
5. Khoảng cách bằng hoặc lớn hơn bán kính ngoài ⇒ hết ràng buộc, hộp trong tự lấy mã của nó.
6. Khoảng cách bằng 0 ⇒ **cha cắt xén**, con để trơn. Không bao giờ bo cùng một góc ở hai nơi.
7. Viên nhộng không tham gia số học, cả chiều nhận lẫn chiều cấp.
8. Bán kính **không** đổi theo khung nhìn, rê chuột, tiêu điểm, trạng thái tải hay độ dài nội dung. Chỉ
   một thay đổi của ranh giới mới làm đổi một góc.
9. Giá trị tự chế (`rounded-[10px]`) là một đề nghị đổi luật, không phải một lần chọn khác đi.
10. Class theo cạnh và theo góc chỉ thuộc về `RADIUS-5`, không thuộc mã nào khác.

Ngoài ra: mã nói giá trị được LẤY RA bằng cách nào, không nói nó bằng bao nhiêu — hai mã có thể in ra
cùng một chuỗi nhưng không bao giờ ra cùng một quyết định — và mọi ranh giới hiển thị ra đều rơi vào
đúng một mã. Không phần tử nào nằm ngoài phạm vi. `R` là biến duy nhất chỉnh được của mô-đun; dịch nó
là dịch theo toàn bộ các mã và phải suy lại cả bảng, tức là một lần đổi luật chứ không phải một quyết
định cục bộ.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **Đường viền tính vào khoảng cách.** Nếu hộp ngoài có vẽ đường viền, hai mép cách nhau xa hơn con số
  khoảng đệm trong nói ra. `RADIUS-4` dùng `khoảng đệm trong + độ dày đường viền`, vì phép trừ nói về
  khoảng cách giữa hai mép, không quan tâm thuộc tính nào tạo ra nó.
- **Cắt xén thay vì suy ra.** Khi con phải chạm tới mép ngoài mà không chừa khoảng cách nào, hộp ngoài
  cắt xén (`overflow-hidden`) và con ở nguyên `RADIUS-0`. Đây là ngoại lệ duy nhất cho phép một phần tử
  hiện ra bo mà không tự khai bán kính.
- **Viên nhộng miễn trừ.** `RADIUS-3` nằm trong một bề mặt bo vẫn là `RADIUS-3`. Viên nhộng không có góc
  nào để làm đồng tâm — cung của nó là cả một đầu — nên phép trừ không có gì để tác động vào.
- **Khoảng cách bằng hoặc vượt bán kính ngoài.** Không phải ngoại lệ của đồng tâm mà là **mép** của nó:
  góc trong đã ra ngoài cung ngoài và tự do. Nó lấy `RADIUS-1` hoặc `RADIUS-2` theo đúng phận sự của
  mình, và sự tự do đó là hình học, không phải giấy phép bo bằng mắt.
- **Hai mã cùng khớp.** Ưu tiên `RADIUS-4`. Một góc suy ra được thì phải suy ra, vì một góc suy ra sống
  sót qua lần đổi khoảng đệm trong, còn một góc chọn tay thì không.
- **Tính đồng nhất trạng thái.** Khung chờ, đang tải, lỗi và rỗng giữ nguyên mã của ranh giới mà chúng
  thay thế. Đổi bán kính khi đang tải là nói dối rằng ranh giới đã đổi.
- **Thiết kế đáp ứng.** Chỉ đổi mã khi ranh giới **thật sự** đổi — một khung trở thành tràn toàn chiều
  rộng ở thiết bị di động thì chuyển sang `RADIUS-0` với `rounded-none`. Màn hình hẹp đi mà ranh giới
  không đổi thì mã không đổi.
- **Cạnh bị cắt hoặc bị ghép.** `RADIUS-5` đổi việc góc nào còn tự do, không bao giờ đổi độ lớn. Một
  bảng trượt neo đáy màn hình tròn ở phía trên đúng bằng mức mà cùng bề mặt đó sẽ tròn ở cả bốn góc.
- **Vòng tiêu điểm và dàn ý.** Chúng bám theo bán kính của hộp mà chúng viền quanh, không cần khai lại.
  Khai lại là tạo ra một nguồn sự thật thứ hai cho cùng một góc.

## Đầu ra

Mỗi phần tử một khối, từ ngoài vào trong:

```text
element: <ranh giới đang quyết>
role: <control | surface | shape | cell | arranger>
outer: <bán kính của ranh giới tổ tiên gần nhất, hoặc none>
inset: <khoảng đệm trong + đường viền đo được, hoặc none>
situation: <RADIUS-0 | RADIUS-1 | RADIUS-2 | RADIUS-3 | RADIUS-4 | RADIUS-5>
className: <không class | rounded-none | rounded-md | rounded-xl | rounded-full | giá trị suy ra | dạng theo cạnh>
reason: <sự thật loại trừ mã liền kề, và với RADIUS-4 là phép tính>
```

## Ví dụ đã giải

**Yêu cầu.** "Một thẻ khoá học chừa 4px quanh ảnh bìa, phía dưới là tiêu đề và một nút Bắt đầu nằm
trong phần thân có khoảng đệm trong 12px."

Yêu cầu này nói ra ba ranh giới — cái thẻ, ảnh bìa, nút Bắt đầu — cộng một phần tử không vẽ gì cả, là
phần thân xếp tiêu đề với nút. Nó không nói tới ảnh đại diện, không nói tới nhãn trạng thái, không nói
tới bảng trượt đáy, cũng không nói tới biến thể tràn toàn chiều rộng trên di động, nên không giải những
thứ đó.

```text
element: thẻ khoá học
role: surface
outer: none
inset: none
situation: RADIUS-2
className: rounded-xl
reason: nó sở hữu một vùng chứa ảnh, tiêu đề và một hành động chứ không phải là một thao tác, điều này loại trừ RADIUS-1
```

```text
element: ảnh bìa
role: surface
outer: rounded-xl (12px)
inset: 4px (khoảng đệm trong của thẻ, không nói tới đường viền)
situation: RADIUS-4
className: rounded-lg
reason: 4px nhỏ hơn bán kính ngoài 12px nên 12 − 4 = 8 được tính ra chứ không được chọn, điều này loại trừ RADIUS-2
```

```text
element: phần thân thẻ
role: arranger
outer: rounded-xl (12px)
inset: 4px
situation: RADIUS-0
className: không class
reason: nó không vẽ nền, viền, bóng hay cắt xén nên không có ranh giới nào để bo và cũng không có gì để từ chối, điều này loại trừ rounded-none
```

```text
element: nút Bắt đầu
role: control
outer: rounded-xl (12px)
inset: 16px (4px khoảng đệm trong của thẻ + 12px khoảng đệm trong của phần thân)
situation: RADIUS-1
className: rounded-md
reason: 16px đã vượt bán kính ngoài 12px nên góc đã ra khỏi cung và không suy ra gì cả, điều này loại trừ RADIUS-4
```

Yêu cầu không nói thẻ có vẽ đường viền hay không. Nó không cần nói: góc của chính cái thẻ là góc được
chọn, không phải góc suy ra. Nếu yêu cầu nói thẻ có đường viền 2px thì ảnh bìa sẽ ra `12 − (4 + 2) = 6`
và in `rounded-md` thay vì `rounded-lg` — vẫn là `RADIUS-4`, vẫn bằng phép trừ. Còn nếu yêu cầu muốn ảnh
bìa chạm thẳng mép thẻ thì khoảng cách bằng 0, và đáp án chuyển thành thẻ cắt xén bằng `overflow-hidden`
còn ảnh để trơn ở `RADIUS-0`.

## Phạm vi

Mô-đun này quyết định các góc bo. Nó không quyết định khoảng cách nuôi phép trừ — việc đó thuộc mô-đun
khoảng đệm, và mô-đun này chỉ đo lại thứ mô-đun kia đã quyết. Nó cũng không quyết định một bề mặt có
được phép nằm trong một bề mặt khác hay không, không quyết định đường nối giữa các phần tử cùng cấp,
cũng không quyết định đường viền, đổ bóng hay màu sắc.

Nó phát biểu một luật đúng với mọi front end. Nó không gọi tên sản phẩm nào, thư viện thành phần nào,
khoá registry nào hay repository nào. Mọi ví dụ đều là `className` thường trên markup thường.
