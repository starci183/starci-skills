---
title: Gap · Vietnamese
---

# Khoảng cách

## LOADS

None.


## Bản ghi

Nguyên tắc này nhận một yêu cầu viết bằng lời thường — "form đăng nhập có 3 field" — rồi trả về là, với **mỗi
phần tử cha** mà yêu cầu đó ngụ ý, một mã tình huống và một className. Yêu cầu không bao giờ nói ra
một khoảng cách, và không được phép ước lượng một khoảng cách: khoảng cách suy ra từ **quan hệ** giữa
những thứ nằm cạnh nhau.

## Luật

Đường nối giữa hai thứ nói lên chúng thuộc về nhau chặt đến mức nào. Chọn khoảng cách từ quan hệ đó,
không bao giờ từ việc nhìn thấy nó chật hay rộng.

Phần tử cha trực tiếp sở hữu đường nối đó. Một phần tử cha diễn đạt một quan hệ; trộn nhiều quan hệ
thì phải tạo phần tử cha lồng nhau.

**Đây là luật bắt buộc.** Bất cứ thứ gì hiển thị ra từ hai phần tử cùng cấp trở lên đều có một tình
huống khoảng cách, và tình huống đó có một mã ở dưới. Không có kích thước nào nhỏ đến mức được miễn:
một nhãn đứng trên một ô nhập liệu là `GAP-3`, đúng cùng một lý do mà một thanh bộ lọc đứng cạnh vùng
kết quả là `GAP-8`. Câu "có mỗi hai cái thôi mà" là chỗ luật này bị bỏ qua nhiều nhất.

## Mã tình huống

Mỗi tình huống mô-đun này chi phối đều mang một mã, `GAP-<bậc>`. Mã gọi tên TÌNH HUỐNG; cột className
gọi tên thứ mà tình huống đó phát ra. Hai thứ này không giống nhau, và có một mã không phát ra gì cả.

| Mã | Tình huống | className |
|---|---|---|
| `GAP-0` | Danh sách có đường phân cách hoặc liền mạch, nhịp đã nằm sẵn trong hàng | *không khai báo khoảng cách* |
| `GAP-1` | Một danh tính hoặc một giá trị; vế sau bổ nghĩa vế trước | `gap-1` |
| `GAP-2` | Một hành động, tài liệu, câu hoặc chuỗi có thứ tự, gọn thành một khối | `gap-2` |
| `GAP-3` | Một nhãn, tiêu đề hoặc thanh công cụ sở hữu khối đứng ngay sau nó | `gap-3` |
| `GAP-4` | Hai nhóm ngang hàng; mỗi nhóm đã có cấu trúc bên trong | `gap-4` |
| `GAP-6` | Hai phần nội dung ngang hàng trong cùng một mạch nội dung | `gap-6` |
| `GAP-8` | Hai vùng bố cục ngang hàng, hình học độc lập | `gap-8` |

`GAP-0` LÀ MỘT TÌNH HUỐNG, KHÔNG PHẢI MỘT BẬC. Không có class `gap-0`, và thêm nó vào là đổi luật chứ
không phải đi đường tắt: **vắng mặt** một đường nối là một sự thật khác với một đường nối bằng không.
Viết `gap-0` là tuyên bố phần tử cha đã quyết một khoảng cách, trong khi thực ra nó quyết không sở hữu
khoảng cách nào. Mã này tồn tại vì "không có khoảng cách" là một trường hợp người đọc phải nhận ra,
trích dẫn được và bị bắt lỗi được — một tình huống không có tên là một tình huống không ai chứng minh
được là đã làm sai.

Thang bậc cố tình bỏ `5` và `7`. Một thang đóng và có lỗ hổng buộc người ta phải quyết định quan hệ;
một thang liên tục mời người ta chia đôi khoảng cách, tức là để con mắt quay lại quyết định thông qua
phép tính.

## Đọc một yêu cầu

1. **Liệt kê những phần tử cha mà yêu cầu nói ra.** "Form đăng nhập có 3 field" nói ra hai: thân form
   chứa ba trường, và mỗi trường chứa nhãn cùng ô nhập liệu của chính nó.
2. **Không bịa ra phần tử cha mà yêu cầu không hề nhắc.** Nút gửi, tiêu đề hay thẻ không nằm trong yêu
   cầu đó. Giải cái được nói ra; phần còn lại giải khi nó xuất hiện.
3. **Giải từ ngoài vào trong**, rồi tới từng phần tử cha lồng bên trong. Mỗi phần tử cha có đáp án
   riêng; phần tử cha không bao giờ thừa hưởng mã của con nó.
4. **Với mỗi phần tử cha, gọi tên các con trực tiếp và hỏi câu hỏi quan hệ** nằm trong phần của từng
   mã. Mã đầu tiên có tình huống khớp chính là đáp án.
5. **Nếu một phần tử cha trộn nhiều quan hệ, phải tách phân cấp trước rồi mới chọn.** Nếu hai bậc liền
   kề cùng khớp, chọn bậc nhỏ hơn.

## `GAP-0` — nhịp đã nằm trong hàng và đường phân cách

**Khi nào gặp.** Một danh sách liền mạch: mỗi hàng tự có khoảng đệm trong, và đường phân cách đã nói rõ
ranh giới giữa các hàng. Cha của các hàng **không sở hữu** khoảng cách giữa các phần tử nào cả.

**Cách nhận ra**

- Mỗi hàng có thể bấm được, hoặc có khoảng đệm bên trong riêng.
- Giữa các hàng đã có đường kẻ.
- Thêm khoảng trắng sẽ làm đường kẻ đứt rời và danh sách mất cảm giác liền mạch.

**Tự hỏi.** Nếu thêm khoảng trắng vào đây, đường phân cách có bị biến thành những đoạn kẻ rời rạc không?

**Ranh giới**

- `GAP-2`: hai nút bấm đứng cạnh nhau **không** phải danh sách; chúng là một nhóm hành động.
- `GAP-4`: nếu các hàng là những nhóm có cấu trúc riêng và **không** có đường phân cách, chúng không
  còn là danh sách liền mạch nữa.

**Không bao giờ viết `gap-0`.** Không có khoảng cách là **trạng thái vắng mặt** của khoảng cách giữa
các phần tử cùng cấp, không phải một bậc mới trong thang. `GAP-0` là mã tình huống, không phải tên
class CSS.

**Tình huống nghiệp vụ hay gặp.** Trình đơn cài đặt · lịch sử thanh toán · bảng xếp hạng · lệnh trình
đơn · luồng thông báo có đường phân cách · danh sách điều hướng trên thiết bị di động · bảng số liệu
dạng hàng.

## `GAP-1` — hai dòng vẫn là một danh tính

**Khi nào gặp.** Dòng dưới chỉ bổ nghĩa hoặc nhận diện cho dòng trên. Đọc riêng dòng dưới thì nó không
còn là một đối tượng độc lập.

**Cách nhận ra**

- Hai dòng cùng trả lời **một** câu hỏi: "đây là ai?", "bao nhiêu?", "giá thế nào?".
- Vế sau mất đi thì vế trước vẫn đúng, chỉ kém rõ.
- Không có vế nào là một hành động.

**Tự hỏi.** Nếu đọc riêng vế dưới, nó có còn là một đối tượng độc lập không? Nếu không — `GAP-1`.

**Ranh giới**

- `GAP-2`: `GAP-1` là một vế bổ nghĩa một vế; `GAP-2` là nhiều vế cùng tạo một khối. Tên và tên người
  dùng là `GAP-1`; Lưu và Xem trước là `GAP-2`.
- `GAP-3`: nhãn đứng trên ô nhập liệu là `GAP-3` chứ không phải `GAP-1`, vì nhãn **sở hữu** một khối có
  tương tác, không phải chú thích một giá trị.

**Tình huống nghiệp vụ hay gặp.** Tên + tên người dùng · ảnh đại diện phương án dự phòng + tên · số
liệu + đơn vị · giá + chu kỳ thanh toán · tiêu đề + phụ đề ngắn · hạng + nhãn hạng · ngày + múi giờ ·
tên tệp + loại tệp.

## `GAP-2` — nhiều thành phần tạo một khối gọn

**Khi nào gặp.** Các phần tử cùng tạo thành **một** thao tác, một tài liệu, một câu, hoặc một chuỗi có
thứ tự. Tách một cái ra là khối đó vỡ.

**Cách nhận ra**

- Chúng chia nhau một ranh giới, một trạng thái hoặc một hành động.
- Chúng được đọc thành một cụm, không phải hai việc.
- Trục ngang hay dọc **không** phải tiêu chí.

**Tự hỏi.** Nếu tách các thành phần khỏi ranh giới hoặc trạng thái chung, thao tác hoặc tài liệu có bị
vỡ không?

**Ranh giới**

- `GAP-1`: xem trên.
- `GAP-3`: nếu **một** thành phần gọi tên hoặc quản lý các thành phần còn lại thì đó là `GAP-3`. Nhóm
  nút Lưu/Xem trước là `GAP-2`; chữ "Hành động" đứng trên nhóm nút đó là `GAP-3`.

**Tình huống nghiệp vụ hay gặp.** Lưu/Xem trước · Trước/Sau · biểu tượng + nhãn trong một nút · ô nhập
liệu + nút hành động đi kèm · cụm bộ lọc gọn · tác giả + nội dung của một đánh giá · cụm chữ giá · dòng
thời gian có thứ tự · cụm hành động xếp dọc khi thu hẹp.

## `GAP-3` — một phần sở hữu phần kế tiếp

**Khi nào gặp.** Phần đầu gọi tên, điều khiển hoặc giải thích phần sau. Quan hệ là **sở hữu**, không
phải ngang hàng.

**Cách nhận ra**

- Phần đầu ngắn, phần sau là nội dung thật.
- Bỏ phần đầu đi thì phần sau vẫn hoạt động, chỉ mất tên.
- Bỏ phần sau đi thì phần đầu trở nên vô nghĩa.

**Tự hỏi.** Phần đầu có đang đặt tên, điều khiển hoặc giải thích phần sau không?

**Ranh giới**

- `GAP-2`: `GAP-2` chia nhau một ranh giới; `GAP-3` có một bên chi phối bên kia.
- `GAP-4`: nếu **cả hai** bên đều đã là nhóm có cấu trúc riêng thì không còn quan hệ sở hữu — đó là
  `GAP-4`.

**Tình huống nghiệp vụ hay gặp.** Nhãn + ô nhập liệu · tiêu đề + thẻ · thanh công cụ + vùng kết quả ·
dải thẻ tab + nội dung thẻ tab · thẻ + chú thích · câu hỏi + vùng trả lời · ô tìm kiếm + dòng tóm tắt
kết quả · hộp kiểm điều khoản + nút gửi.

## `GAP-4` — hai phía đều đã là một nhóm

**Khi nào gặp.** Mỗi bên đã có khoảng cách bên trong của riêng nó. Hai bên ngang hàng, không bên nào sở
hữu bên nào.

**Cách nhận ra**

- Mỗi bên tự gọi tên được như một nhóm hoàn chỉnh.
- Bên trong mỗi bên đã dùng `GAP-1`, `GAP-2` hoặc `GAP-3`.
- Hai bên chưa lớn đến mức thành hai phần nội dung của trang.

**Tự hỏi.** Cả hai phía có thể tự được gọi tên như một nhóm hoàn chỉnh không?

**Ranh giới**

- `GAP-3`: xem trên.
- `GAP-6`: nếu mỗi bên có tiêu đề riêng, mục đích riêng và trạng thái tải riêng thì đã lên `GAP-6`.

**Tình huống nghiệp vụ hay gặp.** Cụm hồ sơ + cụm tiến độ · trường nhập liệu + trường nhập liệu · tóm
tắt thanh toán + điều khoản · cụm tiêu đề + cụm nội dung · địa chỉ + phương thức thanh toán · biểu đồ +
cụm chú giải · câu hỏi + cụm lựa chọn · tóm tắt khoá học + cụm ghi danh.

## `GAP-6` — hai phần nội dung lớn của cùng một trang

**Khi nào gặp.** Mỗi phần có tiêu đề, nội dung và mục đích riêng, nhưng vẫn cùng thuộc một trang và
chảy trong cùng một mạch nội dung.

**Cách nhận ra**

- Mỗi phần có thể tự đứng thành một phần nội dung độc lập.
- Mỗi phần có trạng thái tải riêng, có thể rỗng riêng.
- Chúng vẫn cuộn cùng nhau trong một luồng, chưa phải hai vùng bố cục.

**Tự hỏi.** Nếu tách một phần ra, nó có thể tự đứng thành một phần nội dung độc lập không?

**Ranh giới**

- `GAP-4`: xem trên.
- `GAP-8`: nếu hai bên tự quyết chiều rộng và cách xếp đặt của mình khi màn hình đổi kích thước, chúng
  là vùng bố cục — `GAP-8`.

**Ví dụ không được chấp nhận.** Phần nội dung chỉ có một tiêu đề và một con số **không** đủ để minh hoạ
`GAP-6`: nó chưa chứng minh được mình tự đứng độc lập. Mỗi phần nội dung trong ví dụ phải có nội dung
thật tương ứng với mục đích của nó.

**Tình huống nghiệp vụ hay gặp.** Tổng quan + hoạt động gần đây · nội dung khoá học + đánh giá học viên
· hồ sơ + cài đặt bảo mật · mốc tiến độ + phản hồi · phân tích + giao dịch · brief dự án + sản phẩm bàn
giao.

## `GAP-8` — hai vùng bố cục

**Khi nào gặp.** Hai bên điều khiển cách cả vùng trang được tổ chức. Mỗi bên tự sở hữu hình học của
mình: chiều rộng, vị trí, hành vi khi màn hình đổi kích thước.

**Cách nhận ra**

- Một bên có thể được ghim, cuộn độc lập, hoặc biến mất trên thiết bị di động.
- Chiều rộng của mỗi bên là một quyết định bố cục, không phải hệ quả của nội dung.

**Tự hỏi.** Hai phía có điều khiển cách cả vùng trang được tổ chức không?

**Ranh giới**

- `GAP-6`: xem trên. Kích thước của thành phần **không** biến nó thành vùng bố cục — một thẻ to vẫn chỉ
  là thẻ.

**Tình huống nghiệp vụ hay gặp.** Thanh bộ lọc + kết quả · điều hướng + nội dung · vùng vẽ + bảng kiểm
tra · hộp thư + khung hội thoại · catalog + khung giỏ hàng · cây tệp + trình soạn thảo.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| phần tử cha | Phần tử cha chung trực tiếp |
| phần tử cùng cấp | Chỉ các con trực tiếp |
| quan hệ | danh tính, cụm gọn, khối bị sở hữu, nhóm ngang hàng, phần nội dung, vùng bố cục hoặc danh sách liền mạch |
| hành vi | Hành động, trạng thái và ranh giới là dùng chung hay độc lập |

## Quy tắc

1. Chỉ xét các con **trực tiếp** của cùng một phần tử cha.
2. Phần tử cha sở hữu `gap`; phần tử con **không** dùng `margin` để đẩy phần tử cùng cấp.
3. Một phần tử cha chỉ diễn đạt **một** quan hệ. Quan hệ khác nhau phải tạo phần tử cha lồng nhau.
4. Đổi hàng thành cột, đổi khung nhìn hoặc đổi trạng thái tải **không** tự làm đổi bậc.
5. Đường phân cách và khoảng cách không diễn đạt cùng một ranh giới hai lần.
6. Nếu còn hai bậc liền kề cùng hợp lý, mặc định chọn **bậc nhỏ hơn**; chỉ hỏi khi yêu cầu bắt buộc
   quan hệ lớn hơn.

Ngoài ra: một mã tình huống ứng với đúng một className, không className nào phục vụ hai mã, và mọi tập
phần tử cùng cấp được hiển thị ra đều rơi vào đúng một mã. Không bố cục nào nằm ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **Tính đồng nhất trạng thái.** Khung chờ và nội dung thật dùng chung một mã. Đổi khoảng cách khi đang
  tải là nói dối về quan hệ.
- **Trình tự thời gian.** Mốc thời gian cạnh sự kiện là `GAP-2` **chỉ khi** hai thứ tạo thành một tài
  liệu có thứ tự. Mốc thời gian chỉ để ghi ngày cho một khối riêng thì không thuộc tài liệu đó.
- **Phần tử cha phẳng trộn nhiều quan hệ.** Phải tách phân cấp **trước**, rồi mới chọn. Một vùng chứa
  chứa cả danh tính, cả số liệu đo, cả tiêu đề phần nội dung thì không có đáp án đúng nào, và lấy trung
  bình là cách chọn ra đáp án sai.
- **Hai bậc liền kề cùng khớp.** Chọn bậc nhỏ hơn. Chỉ hỏi **một** câu phân định khi bên yêu cầu nói rõ
  họ cần quan hệ lớn hơn.
- **Đã có đường phân cách.** Danh sách có đường kẻ và hàng tự thêm khoảng đệm là `GAP-0`, kể cả khi các
  hàng đọc như ngang hàng.
- **Thiết kế đáp ứng.** Chỉ đổi bậc khi phần tử cha hoặc vai trò bố cục **thật sự** thay đổi, không
  phải khi màn hình hẹp đi.

## Đầu ra

Mỗi phần tử cha một khối, từ ngoài vào trong:

```text
parent: <phần tử cha trực tiếp>
siblings: <các con trực tiếp>
situation: <GAP-0 | GAP-1 | GAP-2 | GAP-3 | GAP-4 | GAP-6 | GAP-8>
className: <không class | gap-1 | gap-2 | gap-3 | gap-4 | gap-6 | gap-8>
reason: <sự thật nghiệp vụ loại trừ mã liền kề>
```

## Ví dụ đã giải

**Yêu cầu.** "Form đăng nhập có 3 field, mỗi field gồm label + input."

Yêu cầu này nói ra hai phần tử cha: thân form chứa ba trường, và mỗi trường chứa nhãn cùng ô nhập
liệu của chính nó. Nó không nói tới nút gửi, không nói tới tiêu đề, không nói tới thẻ, nên không giải
những thứ đó.

```text
parent: thân form
siblings: trường, trường, trường
situation: GAP-4
className: gap-4
reason: mỗi trường đã tự sở hữu đường nối nhãn–ô nhập liệu và không trường nào chi phối trường nào, điều này loại trừ GAP-3
```

```text
parent: trường
siblings: nhãn, ô nhập liệu
situation: GAP-3
className: gap-3
reason: nhãn gọi tên một khối có tương tác chứ không bổ nghĩa một giá trị, điều này loại trừ GAP-1
```

Khi yêu cầu bổ sung thêm hành động gửi, thân form lúc đó chứa một cụm trường và một cụm hành động —
hai nhóm ngang hàng đều có cấu trúc bên trong, vẫn là `GAP-4` — còn bản thân cụm hành động là một thao
tác gọn, `GAP-2`. Một tiêu đề đặt trên thân form thì sở hữu thân form: `GAP-3`.

## Phạm vi

Mô-đun này phát biểu một luật đúng với mọi front end. Nó không gọi tên sản phẩm nào, thư viện thành
phần nào, khoá registry nào hay repository nào. Mọi ví dụ đều là `className` thường trên markup
thường.
