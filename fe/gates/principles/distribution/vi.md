---
id: fe-principles-distribution-vi
title: vi.md
slug: /gates/principles/distribution/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống DIST-N — ai giãn, ai co, ai đứng yên trong một hàng.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `distribution`

# Phân bố

Phân bố là quyết định **ai giãn, ai co, ai đứng yên** khi một hàng phải chia chiều rộng của nó
cho nhiều thứ cùng lúc.

Một hàng chỉ có một bề rộng, nhưng có nhiều thứ đòi phần trong đó. Với mỗi thứ đứng trong hàng, phải
trả lời đúng hai câu:

> Khi **còn thừa** chỗ, ai được lấy?
> Khi **thiếu** chỗ, ai phải nhường?

**Khi hai câu trả lời mâu thuẫn, câu về phần thiếu quyết định mã.** Một phần tử con có thể vừa lấy phần dư
vừa từ chối nhường; nó được gọi tên bằng sự **từ chối**, vì đó mới là dữ kiện làm vỡ hàng. Phần dư
quyết định hàng *trông* thế nào. Phần thiếu quyết định hàng còn **giữ được nội dung** hay không.

Người tham gia chia chỗ không chỉ là các phần tử con. **Khoảng khoảng cách giữa các phần tử giữa hai phần tử con cũng là một người tham
gia** — vì phần dư có thể được đẩy vào đó thay vì nhét vào một phần tử con nào.

**Đây là luật bắt buộc.** Bất cứ phần tử cha nào xếp con theo một trục — hàng flex, cột flex, lưới — đều
tạo ra tình huống phân bố cho **từng** người tham gia. Không có hàng nào nhỏ đến mức được miễn:
một biểu tượng đứng cạnh một nhãn là `DIST-3` cạnh `DIST-1`, đúng cùng một lý do mà một thanh dọc cố định đứng
cạnh vùng kết quả là `DIST-5` cạnh `DIST-1`. Câu "có mỗi biểu tượng với chữ thôi mà" là chỗ luật này bị bỏ
qua nhiều nhất — và cũng đúng là hàng mà cái tên dài đầu tiên trong dữ liệu thật sẽ đẩy biểu tượng rơi ra
khỏi thẻ.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `DIST-0` | Không khai báo gì; phần tử con lấy đúng kích thước tự nhiên và chỉ co tới sàn nội dung | *không khai báo* |
| `DIST-1` | Một phần tử con ôm trọn phần dư và gánh trọn phần thiếu | `min-w-0 flex-1` |
| `DIST-2` | Nhiều phần tử con chia đều trục với nhau | `min-w-0 flex-1` mỗi cái · `grid-cols-<n>` |
| `DIST-3` | Phần tử con **không bao giờ** được co, dù hàng phải chứa gì | `shrink-0` |
| `DIST-4` | Phần tử con **phải được phép co**, dù không lấy phần dư | `min-w-0` |
| `DIST-5` | Phần tử con giữ một số đo do bố cục quyết định, không phải do nội dung | `w-64 shrink-0` · rãnh `16rem` |
| `DIST-6` | Không phần tử con nào lấy phần dư; một khoảng cách giữa các phần tử được chọn để lấy | `ml-auto` · phần tử cha `justify-between` |

---

## `DIST-0` — không khai báo gì, và đó vẫn là một hành vi

**Tình huống.** Trong hàng không có gì đủ dài để tranh chỗ: mọi phần tử con đều là nội dung ngắn, đóng, và
tổng bề rộng của chúng luôn nhỏ hơn hàng. Không ai cần được ưu tiên, không ai cần được bảo vệ.

**Dấu hiệu nhận biết**

- Mọi giá trị trong hàng đến từ một tập đóng: nhãn cố định, biểu tượng, số có độ dài biết trước.
- Không có phần tử con nào cần chạm mép phải của hàng.
- Không có phần tử con nào bị cắt, xuống dòng hay cuộn — vì chưa bao giờ có phần thiếu.

**Tự hỏi.** Có dữ liệu thật nào khiến tổng bề rộng các phần tử con vượt quá hàng không? Nếu **không có** —
`DIST-0`.

**Ranh giới**

- `DIST-3`: `DIST-0` là "chưa bao giờ thiếu chỗ"; `DIST-3` là "có thể thiếu, nhưng riêng cái này
  cấm co". Nếu trong hàng có **một** phần tử con sinh ra từ dữ liệu người dùng nhập, hàng đó không còn là
  `DIST-0` nữa.
- `DIST-4`: `DIST-0` co tới **sàn nội dung** rồi dừng và đẩy phần tử cùng cấp ra. `DIST-4` là khi đúng chỗ
  dừng đó là thứ phải bỏ đi.

**`DIST-0` không phải là chỗ trống trong luật.** Một phần tử con flex không khai báo gì thì **đã** có hành
vi: nó từ chối giãn, và nó đồng ý co — nhưng chỉ tới đúng bề rộng nội dung của chính nó, không thêm
một điểm ảnh nào. Cái sàn đó vô hình trong mọi bản thiết kế và quyết định mọi thứ trong dữ liệu thật.

**Tình huống nghiệp vụ hay gặp.** Cụm nhãn trạng thái ngắn · biểu tượng + số đếm · đường dẫn phân cấp hai cấp cố
định · cụm nhãn trạng thái cấp độ · pagination số trang · cụm biểu tượng mạng xã hội · nhãn đơn vị cạnh số.

---

## `DIST-1` — một phần tử con ôm cả hàng

**Tình huống.** Trong hàng có đúng **một** thứ là nội dung thật, dài không biết trước, và mọi thứ còn
lại là phụ kiện quanh nó: ảnh đại diện, biểu tượng, nhãn trạng thái, nút, dấu thời gian. Nội dung đó vừa được lấy hết chỗ
thừa, vừa là thứ phải nhường khi thiếu.

**Dấu hiệu nhận biết**

- Có đúng một phần tử con đến từ dữ liệu người dùng hoặc dữ liệu nghiệp vụ.
- Các phần tử con còn lại có bề rộng đoán được trước khi chạy.
- Nếu nội dung đó dài ra, thứ *phải* nhỏ lại chính là nó, không phải các phụ kiện.

**Tự hỏi.** Nếu chuỗi dài nhất có thể xảy ra đổ vào hàng này, ai là người phải nhường? Nếu chỉ có một
người và người đó cũng là người đáng được lấy chỗ thừa — `DIST-1`.

**Ranh giới**

- `DIST-2`: `DIST-1` là **một** người ôm hết; `DIST-2` là **nhiều** người chia nhau. Hai phần tử con cùng
  `flex-1` không phải hai `DIST-1` — đó là `DIST-2` viết sai tên.
- `DIST-4`: `DIST-4` **nhường** nhưng **không lấy** phần dư. Nếu hàng ngắn hơn phần tử cha mà bạn không
  muốn phần tử con này giãn ra chạm mép, nó là `DIST-4`, không phải `DIST-1`.
- `DIST-3` mang `grow`: nếu phần tử con này giãn nhưng **cấm bị cắt**, phần thiếu quyết định — nó là
  `DIST-3`, và hàng phải tìm người khác để nhường.

**`min-w-0` là phần bắt buộc của mã này, không phải phần thêm.** Thiếu nó, phần tử con vẫn giãn đúng như
mong đợi khi rộng, và **không** co khi hẹp — nó đẩy phần tử cùng cấp văng ra khỏi hàng. Đây là kiểu hỏng không
báo lỗi: class CSS danh sách nhìn vẫn đúng, chỉ có hàng là không còn là hàng.

**Tình huống nghiệp vụ hay gặp.** Tên người + nút hành động · tiêu đề bài học + nhãn tiến độ · tên
tệp + kích thước · dòng hội thoại + dấu thời gian · tên khoá học + giá · ô tìm kiếm trong thanh công cụ ·
tiêu đề thẻ + trình đơn ba chấm · tên chi nhánh + trạng thái bản dựng · địa chỉ ví + nút văn bản.

---

## `DIST-2` — nhiều phần tử con chia đều

**Tình huống.** Không ai trong hàng quan trọng hơn ai. Các phần tử con là những mục **đồng hạng**, và bề
rộng bằng nhau chính là thông điệp: chúng có thể so sánh với nhau.

**Dấu hiệu nhận biết**

- Các phần tử con cùng loại, cùng vai trò, thường sinh ra từ cùng một mảng dữ liệu.
- Bề rộng bằng nhau là điều người đọc **dựa vào** để so sánh, không phải hệ quả tình cờ.
- Thêm hoặc bớt một mục là chuyện bình thường của màn hình này.

**Tự hỏi.** Bề rộng bằng nhau ở đây có phải là một tuyên bố nghiệp vụ ("mấy thứ này ngang hàng nhau")
không, hay chỉ là ngẫu nhiên trông đều?

**Ranh giới**

- `DIST-1`: xem trên.
- `DIST-5`: nếu **một** trong các cột phải có số đo cố định thì cột đó là `DIST-5`, và phần còn lại
  mới chia nhau.
- **chia đều trục** so với **chia đều phần dư**: hai chuyện khác nhau. `flex-1` cho ra các cột bằng
  nhau; `grow` giữ nguyên bề rộng nội dung của từng phần tử con rồi chỉ chia đều **chỗ thừa**. Cả hai vẫn
  là `DIST-2`; câu hỏi phân định là: cái phải bằng nhau là **các cột**, hay là **phần được thêm vào**?

**Số cột là quyết định bố cục, không phải quyết định của phần tử con.** Khi số mục thay đổi theo dữ liệu,
dùng lưới với số cột khai báo ở phần tử cha; đừng để mỗi phần tử con tự tính phần của mình bằng phân số.

**Tình huống nghiệp vụ hay gặp.** Ba ô số liệu tổng quan · nhóm nút phân đoạn · lưới thẻ khoá học ·
bảng giá ba gói · nhóm nút chọn đáp án · lịch bảy ngày · dải thống kê trong phần đầu · cụm hai nút
Huỷ/Xác nhận trải đều toàn bề rộng trên thiết bị di động.

---

## `DIST-3` — cấm co, bất kể hàng phải chứa gì

**Tình huống.** Có một thứ trong hàng mà **mất một phần là mất tất cả**: một biểu tượng bị bóp thành hình
oval, một nút bị nuốt mất chữ, một con số bị cắt còn nửa. Những thứ này không được phép là người
nhường.

**Dấu hiệu nhận biết**

- Đọc thiếu một phần của nó thì người đọc **hiểu sai**, chứ không phải hiểu ít đi.
- Nó vuông, tròn, hoặc có tỉ lệ phải giữ.
- Nó là thứ người dùng phải bấm được — vùng chạm không được co lại theo bề rộng của phần tử cùng cấp.

**Tự hỏi.** Nếu thứ này nhỏ lại 30%, người đọc có bị hiểu **sai** không, hay chỉ đọc được ít hơn? Nếu
hiểu sai — `DIST-3`.

**Ranh giới**

- `DIST-0`: `DIST-0` là hàng chưa bao giờ thiếu chỗ; `DIST-3` là hàng có thể thiếu và cái này được
  miễn nhường. Khi bên cạnh có một `DIST-1`, mọi phụ kiện trong hàng đều cần được nói rõ là `DIST-3`.
- `DIST-5`: `DIST-3` lấy số đo từ **nội dung của chính nó** rồi khoá lại; `DIST-5` lấy số đo từ một
  **quyết định bố cục**.
- `DIST-1`: một phần tử con vừa `grow` vừa `shrink-0` vẫn là `DIST-3` — phần thiếu quyết định.

**`shrink-0` nói đúng một điều; `flex-none` nói hai.** `flex-none` vừa cấm co vừa cấm giãn, mà cấm
giãn thì đã là mặc định. Chọn cái nói đúng điều mình muốn nói, để lần đọc sau không phải đoán ý nào
là chủ ý.

**Tình huống nghiệp vụ hay gặp.** Ảnh đại diện · biểu tượng trạng thái · nút chỉ có biểu tượng · nhãn trạng thái số thông báo ·
hộp kiểm trong hàng · giá tiền · mã đơn hàng · thời lượng bài học · nhãn "Mới" · biểu tượng chữ V mở rộng ·
ảnh ảnh thu nhỏ vuông trong danh sách hàng.

---

## `DIST-4` — phải được phép co, nhưng không lấy phần dư

**Tình huống.** Phần tử con này **phải nhường** khi hàng hẹp, nhưng không được phép phình ra khi hàng rộng.
Nó nhận đúng chỗ nó cần, và trả lại chỗ khi bị đòi.

**Dấu hiệu nhận biết**

- Nội dung của nó dài không đoán trước được.
- Nếu nó giãn ra chạm mép, bố cục bị sai nghĩa: một cụm nhận diện bị kéo rời ra khỏi ảnh đại diện, một nhãn nhỏ
  biến thành một thanh dài.
- Bên trong nó có `truncate`, `line-clamp` hoặc một vùng cuộn — và những thứ đó đang **không chạy**.

**Tự hỏi.** Thứ này có cần **nhỏ lại** khi hàng hẹp không, và khi hàng rộng nó có nên **đứng yên**
không? Nếu cả hai đều đúng — `DIST-4`.

**Ranh giới**

- `DIST-1`: `DIST-1` nhường **và** lấy; `DIST-4` chỉ nhường.
- `DIST-0`: cùng là "không lấy phần dư", nhưng `DIST-0` dừng ở sàn nội dung, còn `DIST-4` là khi
  đúng cái sàn đó phải bị gỡ.

**Đây là mã hay bị bỏ sót nhất, và bỏ sót nó không tạo ra lỗi nào để đọc.** Mọi `truncate` nằm trong
một hàng đều cần `min-w-0` ở **từng mắt xích** giữa hàng và chính phần tử bị cắt. Một `min-w-0` ở
phần tử con ngoài cùng không mở khoá cho một phần tử con nằm sâu ba tầng bên trong.

Trên trục dọc, luật này đọc là `min-h-0`: một cột phải cuộn bên trong phần tử cha có trần sẽ **giãn vượt
trần** thay vì cuộn, cho tới khi chiều cao tối thiểu của nó được gỡ.

**Tình huống nghiệp vụ hay gặp.** Cụm tên + tên người dùng nằm cạnh ảnh đại diện · nhãn thẻ tab dài · nhãn nhỏ bộ lọc có
chữ do người dùng đặt · tên thư mục trong đường dẫn phân cấp · cụm chữ trong một `DIST-3` khác · cột trong
lưới `1fr` chứa văn bản dài · vùng cuộn nằm trong cột flex.

---

## `DIST-5` — số đo do bố cục quyết định

**Tình huống.** Bề rộng của phần tử con này là một **quyết định của bố cục**, không phải hệ quả của nội
dung. Thanh dọc lọc rộng 16rem vì đó là kích thước đã chọn cho thanh dọc, không phải vì nhãn dài nhất trong đó
đo được ngần ấy.

**Dấu hiệu nhận biết**

- Nếu nội dung bên trong đổi, bề rộng vẫn phải giữ nguyên.
- Bề rộng đó lặp lại giống nhau ở nhiều màn hình khác — nó là một hằng số của sản phẩm.
- Bên còn lại của hàng mới là bên phải thích nghi.

**Tự hỏi.** Con số này đến từ đâu — từ nội dung dài nhất bên trong, hay từ một quyết định bố cục đã
chốt? Nếu từ quyết định bố cục — `DIST-5`.

**Ranh giới**

- `DIST-3`: xem trên. `DIST-3` khoá **kích thước nội dung**; `DIST-5` khoá **một con số**.
- `DIST-2`: nếu tất cả các cột đều do bố cục quyết định và **bằng nhau**, đó là `DIST-2` dạng lưới,
  không phải nhiều `DIST-5`.

**Viết bề rộng ra thôi thì không giữ được.** Flex mặc định **bật** co, nên phần tử con có `w-64` vẫn âm
thầm nhỏ hơn 64 khi hàng hẹp — không có dấu hiệu nào cho biết đã từng có một con số ở đó. `DIST-5`
luôn là **hai** tuyên bố: số đo, và lời từ chối nhường nó.

Trong lưới, cùng một sự thật đọc khác đi: rãnh `1fr` có sàn tự động, nên một rãnh chứa nội dung dài
sẽ **kéo giãn cả lưới** vượt khỏi vùng chứa. `minmax(0,1fr)` là cách viết `min-w-0` của lưới, và cần
vì đúng lý do đó.

**Tình huống nghiệp vụ hay gặp.** Thanh dọc lọc · thanh bên điều hướng · khung giỏ hàng ghim bên phải · cột
bảng kiểm tra · cột số thứ tự trong bảng · cột ảnh đại diện cố định trong danh sách hội thoại · cột nhãn của
biểu mẫu hai cột.

---

## `DIST-6` — phần dư rơi vào khoảng cách giữa các phần tử, không rơi vào phần tử con nào

**Tình huống.** Mọi phần tử con trong hàng đều muốn giữ nguyên bề rộng của mình, nhưng hàng vẫn phải trải
hết bề rộng: một bên nằm sát trái, một bên nằm sát phải. Chỗ thừa phải đi đâu đó — và nó đi vào
**khoảng giữa**.

**Dấu hiệu nhận biết**

- Có một mép mà một phần tử con bắt buộc phải chạm tới.
- Không phần tử con nào nên phình ra: phình ra là làm sai nghĩa (một tiêu đề bị kéo dài ra, một nút bị kéo
  rộng vô cớ).
- Đọc yêu cầu ra thành lời thì nó là "đẩy cái này sang phải", không phải "cho cái kia rộng ra".

**Tự hỏi.** Thứ tôi muốn to ra là một **phần tử con**, hay là **khoảng cách** giữa các phần tử con?

**Ranh giới**

- `DIST-1`: đây là nhầm lẫn đắt nhất trong mô-đun này. `flex-1` trên tiêu đề cũng đẩy được nút sang
  phải — nhưng nó đồng thời biến tiêu đề thành vùng nhận cả phần thiếu, và vùng bấm của tiêu đề tự
  nhiên kéo dài qua cả khoảng trống. Nếu ý định là **đẩy**, dùng `DIST-6`.
- mô-đun `gap`: `gap` sở hữu khoảng cách **lúc nghỉ** giữa các phần tử cùng cấp; `DIST-6` sở hữu câu hỏi ai
  nhận **chỗ thừa**. Một khoảng cách giữa các phần tử nở ra vì `DIST-6` là một khoảng cách **bị giãn**, không phải một khoảng cách được chọn
  to hơn.

**Không dùng phần tử rỗng để đẩy.** Một `<div className="flex-1" />` là một phần tử con không có nội dung,
không có nghĩa, và vẫn được trình đọc màn hình duyệt qua như một phần tử. Chỗ thừa được đòi bởi một khoảng cách giữa các phần tử,
không bởi một phần tử con giả.

**`justify-between` với ba phần tử con là câu trả lời cho một câu hỏi khác.** Nó chia chỗ thừa cho **mọi**
khoảng cách giữa các phần tử. Khi chỉ một khoảng cách giữa các phần tử nên nở, hãy gom các phần tử con thành hai nhóm, hoặc đặt `ml-auto` lên đúng phần tử con
mở khoảng cách giữa các phần tử đó.

**Tình huống nghiệp vụ hay gặp.** Phần đầu thẻ: tiêu đề trái, trình đơn phải · phần cuối hộp thoại: nút phụ trái,
nút chính phải · hàng bảng: nhãn trái, giá trị phải · thanh công cụ: nhóm bộ lọc trái, nút tạo mới
phải · hàng danh sách: nội dung trái, biểu tượng chữ V phải · dòng tổng tiền.

---

## Luật

1. Mỗi người tham gia của một phần tử cha phân phối rơi vào **đúng một** mã, trên **đúng một** trục.
2. **Phần thiếu quyết định mã.** Hành vi khi thừa chỗ không bao giờ lật ngược được kết luận đó.
3. Mỗi hàng phải có ít nhất một người tham gia gánh được phần thiếu. Một hàng chỉ gồm `DIST-3` và
   `DIST-5` là một hàng đã tuyên bố trước rằng nó sẽ tràn.
4. Mỗi phần tử cha, mỗi trục, nhiều nhất **một** `DIST-1`.
5. `min-w-0` phải có ở **mọi mắt xích** giữa hàng và phần tử thật sự phải nhường.
6. Số đo khai báo luôn đi kèm lời từ chối co. Viết `w-*` mà quên `shrink-0` là chưa nói xong câu.
7. Không dùng phần tử rỗng để đẩy chỗ.
8. Không dùng bề rộng phân số trong phần tử cha có khoảng cách giữa các phần tử: khoảng cách giữa các phần tử được cộng thêm **lên trên** phân số đó và
   hàng tràn.
9. Đổi khung nhìn không đổi mã. Mã chỉ đổi khi **phần tử cha** đổi.
10. Khung chờ và nội dung thật dùng chung mã trên cùng một người tham gia.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Phần tử con vừa giãn vừa cấm cắt.** Là `DIST-3` mang thêm `grow`, không phải `DIST-1`. Phần thiếu quyết
  định. Khi đó hàng phải có một người khác đứng ra nhường.
- **Chia đều cột hay chia đều phần thêm.** Cả hai là `DIST-2`. `flex-1` khi các cột phải bằng nhau;
  `grow` khi mỗi phần tử con giữ bề rộng nội dung và chỉ chỗ thừa được chia.
- **Số, giá, mã định danh và thành phần điều khiển là `DIST-3` ngay cả khi đứng cạnh một `DIST-1`.** Một giá trị mà
  người đọc không kiểm chứng được sau khi bị cắt thì không được phép là người nhường.
- **Một phần tử con thì không có tình huống phân bố.** Một mình nó không chia gì cả. Chỉ gán mã khi có
  người tham gia thứ hai.
- **Hai mã cùng khớp.** Chọn mã **khai báo ít hơn**: `DIST-0` thay vì `DIST-3` khi trong hàng không
  có gì đẩy được; `DIST-4` thay vì `DIST-1` khi phần tử con phải nhường nhưng không nên phình. Chỉ hỏi một
  câu phân định khi bên yêu cầu nói rõ họ cần vai trò lớn hơn.
- **Thiết kế đáp ứng.** Một thanh dọc xếp chồng lên trên nội dung khi màn hình hẹp là một **phần tử cha khác**, không
  phải cùng một thanh dọc cư xử khác đi. Mã đổi vì phần tử cha đổi, không vì màn hình hẹp.
- **Trục dọc.** Cùng bộ mã, đọc bằng `min-h-0`, `shrink-0` và `flex-1` trên trục khối. Một vùng cuộn
  trong cột flex không cuộn cho tới khi chiều cao tối thiểu của nó được gỡ.
