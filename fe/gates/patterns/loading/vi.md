---
id: fe-patterns-loading-vi
title: vi.md
slug: /gates/patterns/loading/vi
sidebar_label: vi.md
sidebar_position: 1
description: Các tình huống LOADING-N, nhận diện bằng nghiệp vụ chứ không bằng cách nhìn màn hình.
---

# vi.md

> Version: `2.00` · Module: `loading`

# Loading

Một surface đang chờ dữ liệu phải vẽ **đúng cái hình mà nó sẽ vẽ khi dữ liệu về**, chỉ bỏ các giá trị
ra. Không phải một cây khác, không phải một chồng thanh xám trông na ná — mà **cùng những component
đó, cùng cách sắp xếp đó, ở trạng thái nghỉ**.

Lý do là **drift**, và nó không phải chuyện giả định. Một cây thứ hai mô tả cây thứ nhất là một bản
mô tả không ai cập nhật: nó đúng vào ngày được viết, và sai ngay lần đầu hình thật đổi. Không có gì
đỏ lên cả, vì một hình đang nghỉ thì không có assertion nào để fail — nó chỉ đơn giản là sai trên màn
hình, và chỉ sai trong đúng một giây có người tình cờ nhìn vào.

Câu hỏi chốt hạ:

> Ngày mai component này đổi hình, thì bản đang chờ có đổi theo không?

Nếu không — đó là một bản mô tả thứ hai, và nó sẽ drift.

**Đây là luật bắt buộc.** Bất cứ thứ gì render ra trước khi dữ liệu của nó về đều rơi vào một trong
bảy mã dưới đây. Không có surface nào nhỏ đến mức được miễn: một dòng chữ đơn lẻ là `LOADING-2`, đúng
cùng một lý do mà cả một cột dashboard là `LOADING-6`. Câu "có mỗi cái spinner thôi mà" là chỗ luật
này bị bỏ qua nhiều nhất.

## Chỗ hai nửa gặp nhau

Đây là mối nối bị làm sai nhiều nhất, nên nó được viết ra chứ không để suy đoán. Block và leaf diễn
đạt việc chờ theo hai cách khác nhau, và bản dịch giữa chúng chỉ dài một dòng:

| Tầng | Việc chờ được diễn đạt thế nào |
|---|---|
| block | `pending` là một thành viên của state union — một tình huống thật, đứng cạnh `ready`, `empty`, `failed` |
| leaf, composite | `isLoading` — một cờ được **nhận**, không bao giờ được **quyết** |
| mối nối | `const isLoading = input.state === "pending"` ở nửa thuần trình bày |

Block sở hữu **TÌNH HUỐNG**, vì chỉ nó biết câu trả lời đã về hay chưa. Leaf sở hữu **DÁNG NGHỈ**, vì
chỉ nó biết giải phẫu của chính nó. Không bên nào làm được nửa của bên kia, và một dòng ở giữa là chỗ
chúng gặp nhau.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Yêu cầu |
|---|---|---|
| `LOADING-1` | Chính component vẽ dữ liệu là component vẽ lúc chờ | Không twin, không prop đưa sẵn hình nghỉ |
| `LOADING-2` | Vẫn đúng thẻ đó, đúng cách xếp đó, chỉ rút giá trị ra | Không ternary chọn giữa hai component khác nhau |
| `LOADING-3` | Vùng nghỉ đứng cao bằng vùng thật; số dòng lặp là một quyết định | Không có vùng nào vẽ rỗng khi chờ |
| `LOADING-4` | Phần đang nghỉ được giấu khỏi trợ năng | Không đọc shimmer, không đọc ô trống |
| `LOADING-5` | Control chỉ xuất hiện khi đã có nơi để đi | Không vẽ đích bấm trước khi có đích |
| `LOADING-6` | Mỗi vùng tự chờ request của mình | Không dùng chung một cờ cho nhiều request độc lập |
| `LOADING-7` | `pending` là một thành viên của union và mang theo phần khung | Không coi việc chờ là `undefined` hay "chưa có dữ liệu" |

---

## `LOADING-1` — một hình, hai trạng thái; không bao giờ hai cây

**Tình huống.** Dữ liệu chưa về, và có người muốn dựng thêm một component thứ hai để vẽ lúc chờ:
một file `…Skeleton`, hoặc một prop nhận sẵn markup nghỉ từ bên ngoài đưa vào. Component thật thì vẫn
nằm đó, không biết gì.

**Dấu hiệu nhận biết**

- Có một file mà nhiệm vụ duy nhất là **nhại lại hình** của một file khác.
- Có prop tên `skeleton`, `placeholder` hoặc `fallback` nhận vào một element.
- Sửa component thật xong, phải nhớ sang sửa thêm một chỗ nữa — và không có gì nhắc.

**Tự hỏi.** Nếu ngày mai component này thêm một dòng, bản đang chờ có tự có dòng đó không?

**Ranh giới**

- ↔ `LOADING-2`: `LOADING-1` là **tồn tại** một cây thứ hai (một file, một prop). `LOADING-2` là cây
  thứ hai được viết **ngay tại call site** bằng một ternary. Cùng một sai lầm, khác vị trí.
- ↔ `LOADING-7`: `LOADING-1` nói **ai vẽ**; `LOADING-7` nói **tình huống có tên chưa**. Một block có
  `pending` trong union vẫn có thể vi phạm `LOADING-1` nếu nhánh `pending` render một twin.
- **Không phải twin:** một primitive nghỉ dùng chung — thứ mà component *nghỉ BẰNG nó* — không mô tả
  hình của ai cả, nên không thể drift khỏi hình nào.

**Tình huống nghiệp vụ hay gặp.** Card khoá học · row hoá đơn · ô thống kê trên dashboard · dòng
thông báo · thẻ hồ sơ · bảng xếp hạng · card sản phẩm trong giỏ.

---

## `LOADING-2` — vẫn là phần tử đó, chỉ rút ruột ra

**Tình huống.** Component đúng là một, nhưng lúc chờ nó bị thay bằng một element khác — thường bởi
một ternary ở call site: `isLoading ? <A/> : <B/>` với `A` và `B` là hai thứ khác nhau.

**Dấu hiệu nhận biết**

- Hai nhánh của ternary có **tên element khác nhau**.
- Kích thước, khoảng cách hoặc đường bo của bản nghỉ được viết lại bằng tay ở call site.
- Lúc dữ liệu về, chữ nhảy sang chỗ khác một chút — vì hai element không cùng measure.

**Tự hỏi.** Hai nhánh có phải cùng một element không? Nếu không, cái nào đang nói dối về measure?

**Ranh giới**

- ↔ `LOADING-1`: xem trên.
- ↔ `LOADING-3`: `LOADING-2` là **một phần tử** bảo toàn hình; `LOADING-3` là **cả vùng** bảo toàn
  chiều cao. Một dòng chữ nghỉ đúng luật vẫn có thể nằm trong một section co lại còn 0 pixel.
- ↔ `LOADING-5`: ternary có một nhánh là `null` **không** thuộc mã này. Đó là `LOADING-5`, và nó đúng.

**Tình huống nghiệp vụ hay gặp.** Tên hiển thị · số dư · nhãn hạng · tiêu đề khoá học · avatar ·
badge trạng thái · số liệu trong ô thống kê · caption dưới ảnh.

---

## `LOADING-3` — vùng nghỉ bảo toàn chiều cao của section

**Tình huống.** Vùng đang chờ không vẽ gì cả, nên nó co lại; đến khi câu trả lời về thì cả cột bên
dưới nhảy xuống. Người đọc đang đọc dở một thứ và mất chỗ.

**Dấu hiệu nhận biết**

- Có `isLoading ? null : …` ở cấp **vùng**, không phải cấp control.
- Danh sách lúc chờ vẽ 0 dòng, lúc về vẽ 6 dòng.
- Không ở đâu khai báo "vùng này nghỉ bằng mấy dòng" — con số nằm rải rác trong JSX hoặc không có.

**Tự hỏi.** Nếu bây giờ dữ liệu về, có gì trên màn hình dịch chuyển không? Và số dòng lúc nghỉ là một
**quyết định có tên**, hay là hệ quả tình cờ?

**Ranh giới**

- ↔ `LOADING-2`: xem trên.
- ↔ `LOADING-5`: bỏ một **control** vì chưa có đích là đúng luật; bỏ cả một **vùng** vì chưa có dữ
  liệu là sai luật. Khác nhau ở chỗ: control mất đi không làm ai mất chỗ đọc, vùng mất đi thì có.
- ↔ `LOADING-6`: `LOADING-3` là chiều cao của **một** vùng; `LOADING-6` là **nhiều** vùng chờ lẫn
  nhau.

**Tình huống nghiệp vụ hay gặp.** Danh sách bài học · feed hoạt động · bảng giao dịch · lưới khoá
học · danh sách mục tiêu tuần · kết quả tìm kiếm · dòng bình luận.

---

## `LOADING-4` — phần đang nghỉ được giấu khỏi trợ năng

**Tình huống.** Một shimmer, hoặc một giá trị đã bị rút ruột, vẫn nằm trong cây trợ năng. Screen
reader đọc ra tiếng ồn, hoặc đọc ra một chuỗi rỗng, đúng vào lúc người dùng đang chờ được nêu cho
biết một điều gì đó.

**Dấu hiệu nhận biết**

- Element nghỉ không có `aria-hidden`.
- Có `aria-label` mô tả chính cái shimmer ("đang tải…") gắn lên từng ô một.
- Bật screen reader lên nghe thấy một chuỗi khoảng trắng, hoặc nghe thấy cùng một câu lặp mười lần.

**Tự hỏi.** Ở giây này, có **nội dung** nào để đọc không? Nếu không có, tại sao nó còn nằm trong cây
trợ năng?

**Ranh giới**

- ↔ `LOADING-2`: `LOADING-2` lo phần **nhìn thấy** bảo toàn hình; `LOADING-4` lo phần **nghe thấy**
  im lặng. Một element có thể đúng `LOADING-2` mà vẫn sai `LOADING-4`.
- ↔ `LOADING-7`: thông báo **một** lần ở cấp vùng rằng "đang tải" là chuyện của khung — của
  `LOADING-7`, nơi `pending` mang theo tên vùng. Thông báo ở **từng ô nghỉ** là tiếng ồn.
- Giấu chỉ kéo dài **đúng lúc nghỉ**. Element quay lại cây trợ năng ngay khi nó mang nội dung.

**Tình huống nghiệp vụ hay gặp.** Avatar nghỉ · dòng tiêu đề nghỉ · icon nghỉ · ô số liệu nghỉ ·
chú giải biểu đồ nghỉ · lưới đóng góp nghỉ.

---

## `LOADING-5` — chưa có nơi để đi thì chưa vẽ control

**Tình huống.** Một card đang nghỉ vẫn vẽ ra cái nút của nó, hoặc vẽ một link ở dạng shimmer. Người
đọc bấm vào, và không có gì xảy ra — hoặc tệ hơn, có một cái gì đó sai xảy ra.

**Dấu hiệu nhận biết**

- Có control mà `href`, `id` đích hoặc handler của nó đang là `undefined`.
- Control được vẽ ở dạng `disabled` "cho đỡ trống".
- Nhãn của control chưa được dịch xong nhưng khung nút đã có mặt.

**Tự hỏi.** Nếu người đọc bấm vào cái này **ngay bây giờ**, họ học được điều gì? Nếu câu trả lời là
"rằng surface này không đáng tin" — thì đừng vẽ nó.

**Ranh giới**

- ↔ `LOADING-3`: xem trên. Bỏ control thì không ai mất chỗ đọc; bỏ vùng thì có.
- ↔ `LOADING-2`: đây là ngoại lệ **đóng** của `LOADING-2`: một ternary có nhánh `null` không phải cây
  thứ hai.
- **Vắng mặt, không phải `disabled`.** Một nút xám vẫn là một lời hứa; nó nói "sắp bấm được", trong
  khi sự thật là "chưa biết có đích hay không".

**Tình huống nghiệp vụ hay gặp.** Nút "Học tiếp" trên card khoá học · link "Xem thêm" · nút tải hoá
đơn · nút chia sẻ hồ sơ · nút mở phòng thi · nút thanh toán khi chưa có giỏ.

---

## `LOADING-6` — mỗi vùng tự sở hữu việc chờ của mình

**Tình huống.** Một cờ `isLoading` duy nhất được kéo qua bốn vùng độc lập. Vùng nào cũng phải đợi
vùng chậm nhất, và bốn tình huống thật bị gộp thành một.

**Dấu hiệu nhận biết**

- `const isLoading = a.isLoading || b.isLoading || c.isLoading`.
- Một `Promise.all` gom nhiều request không liên quan chỉ để có một trạng thái.
- Cả trang trắng ba giây rồi hiện ra một lượt, thay vì lấp dần trong một giây.

**Tự hỏi.** Hai vùng này có **cùng một câu trả lời** không? Nếu không, tại sao chúng dùng chung một
cờ?

**Ranh giới**

- ↔ `LOADING-3`: xem trên.
- ↔ `LOADING-7`: `LOADING-7` nói *một* vùng phải có tình huống `pending` có tên. `LOADING-6` nói *mỗi*
  vùng phải có tình huống của **riêng** nó. Một trang có thể đúng `LOADING-7` ở mọi block mà vẫn sai
  `LOADING-6` nếu chúng cùng nhận một cờ từ trên xuống.
- **Cùng một request thì không phải nhiều vùng.** Hai phần đọc từ cùng một câu trả lời thì chờ cùng
  nhau là đúng — chúng chỉ có một câu trả lời để chờ.

**Tình huống nghiệp vụ hay gặp.** Dashboard nhiều thẻ · trang hồ sơ có tiến độ và hoạt động · trang
khoá học có nội dung và đánh giá · trang thanh toán có giỏ và địa chỉ · sidebar điều hướng cạnh nội
dung.

---

## `LOADING-7` — chờ là một tình huống thật, không phải sự vắng mặt của tình huống

**Tình huống.** Component coi việc chờ là "chưa có dữ liệu": `data === undefined` thì trả về `null`,
hoặc trả về đúng cái giao diện của "không có gì". Từ đó nó không phân biệt được **chưa về** với
**không có**, mà hai thứ đó cần hai câu chữ khác nhau.

**Dấu hiệu nhận biết**

- Union chỉ có `ready`, `empty`, `failed` — thiếu `pending`.
- Nhánh chờ trả về `null`, hoặc trả về đúng empty state.
- Nhánh chờ không có `props`, nên tên của vùng biến mất trong lúc nội dung đang trên đường về.

**Tự hỏi.** Người đọc nhìn vào surface này lúc chờ, họ có còn biết **họ đang ở vùng nào** không?

**Ranh giới**

- ↔ `LOADING-1`: xem trên. Có `pending` trong union chưa cứu được gì nếu nhánh đó vẽ một twin.
- ↔ `LOADING-3`: `LOADING-7` là **có tên tình huống**; `LOADING-3` là **có kích thước**. Thiếu tên thì
  không viết nổi nhánh nghỉ; có tên rồi vẫn có thể viết nhánh nghỉ rỗng.
- `pending` **mang theo phần khung**: nhãn của vùng, heading của nó — những thứ đã biết trước khi
  request được gửi đi. Chỉ phần nội dung là chưa biết.

**Tình huống nghiệp vụ hay gặp.** Section "Học tiếp" · thẻ tín chỉ AI · lịch sử giao dịch · danh sách
thử thách tuần · feed cộng đồng · kết quả tìm kiếm · giỏ hàng.

---

## Luật

1. Component vẽ dữ liệu chính là component vẽ lúc chờ. Không có file thứ hai, không có prop đưa hình
   nghỉ từ ngoài vào.
2. Phần tử nghỉ bảo toàn thẻ, cách sắp xếp và measure của nó.
3. Vùng nghỉ bảo toàn chiều cao của một vùng thật; số dòng lặp là một quyết định được khai báo.
4. Phần tử nghỉ được giấu khỏi trợ năng, và chỉ trong đúng lúc nó nghỉ.
5. Control chưa có đích thì **vắng mặt**, không phải `disabled`, cũng không phải shimmer.
6. Một cờ chờ cho một request. Nhiều request độc lập thì nhiều cờ.
7. `pending` là một thành viên của state union và mang theo phần khung.
8. Block quyết **tình huống**; leaf quyết **dáng nghỉ**. Mối nối giữa chúng dài đúng một dòng.
9. Không có gì được dịch chuyển vào đúng khoảnh khắc dữ liệu về.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Test được dựng hình nghỉ bằng tay.** Một twin nằm trong file `.test.tsx` hoặc `.spec.tsx` là
  fixture để assert, không phải bản mô tả thứ hai được ship cho người đọc. `LOADING-1` không với tới
  đó.
- **Primitive nghỉ dùng chung không phải twin.** Một mặt nghỉ tổng quát mà component *nghỉ bằng nó*
  không mô tả hình của ai cả, nên không drift khỏi hình nào. `LOADING-1` cấm nhại **một component có
  tên**, không cấm một primitive.
- **Control mà bề rộng chính là nhãn của nó thì không nghỉ được.** Một dòng chữ có measure khai báo
  sẵn nên nghỉ được mà chưa cần biết sẽ nói gì; một control lấy chữ làm bề rộng thì không. Đó là lý
  do `LOADING-5` **bỏ hẳn** nó thay vì rút ruột nó.
- **Dữ liệu đã có trong cache thì không phải tình huống chờ.** Vùng đang fetch lại phía sau dữ liệu
  nó đang hiển thị vẫn là `ready`. Xoá trắng nó là `LOADING-2` bị lộn ngược: một cái hình đi giật lùi.
- **Nhánh `null` là đúng.** Ternary có một nhánh `null` là `LOADING-5`, và `LOADING-2` không áp vào
  đó.
