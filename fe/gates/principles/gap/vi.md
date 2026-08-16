---
id: fe-principles-gap-vi
title: vi.md
slug: /gates/principles/gap/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống GAP-N, nhận diện bằng nghiệp vụ chứ không bằng mắt.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `gap`

# Khoảng cách

Khoảng cách là khoảng cách do **phần tử cha** đặt giữa các **con trực tiếp**, chọn theo **quan hệ ý nghĩa**
giữa chúng.

Khoảng cách không được chọn bằng cảm giác "hơi chật" hay "hơi rộng". Hãy nhìn hai thứ nằm cạnh nhau
và hỏi:

> Chúng thuộc về nhau chặt đến mức nào?

Hai thứ càng được đọc như **một**, khoảng cách càng nhỏ. Hai thứ càng là những **vùng độc lập**, khoảng cách càng lớn.

**Đây là luật bắt buộc.** Bất cứ thứ gì hiển thị ra từ hai phần tử cùng cấp trở lên đều rơi vào đúng một mã dưới
đây. Không có kích thước nào nhỏ đến mức được miễn: một nhãn đứng trên một ô nhập liệu là `GAP-3`, đúng
cùng một lý do mà một thanh bộ lọc đứng cạnh vùng kết quả là `GAP-8`. Câu "có mỗi hai cái thôi mà" là
chỗ luật này bị bỏ qua nhiều nhất.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `GAP-0` | Danh sách đã có hàng khoảng đệm trong và đường phân cách, nhịp nằm sẵn trong hàng | *không khai báo khoảng cách* |
| `GAP-1` | Một danh tính/một giá trị; vế sau bổ nghĩa vế trước | `gap-1` |
| `GAP-2` | Một hành động, tài liệu, câu hoặc chuỗi có thứ tự — gọn thành một khối | `gap-2` |
| `GAP-3` | Một phần **gọi tên, điều khiển hoặc giải thích** phần kế tiếp | `gap-3` |
| `GAP-4` | Hai nhóm ngang hàng, mỗi bên đã có cấu trúc bên trong | `gap-4` |
| `GAP-6` | Hai phần nội dung lớn của cùng một trang | `gap-6` |
| `GAP-8` | Hai vùng bố cục có hình học độc lập | `gap-8` |

---

## `GAP-0` — nhịp đã nằm trong hàng và đường phân cách

**Tình huống.** Một danh sách liền mạch: mỗi hàng tự có khoảng đệm trong, và đường phân cách đã nói rõ ranh giới giữa
các hàng. Cha của các hàng **không sở hữu** khoảng cách giữa các phần tử nào cả.

**Dấu hiệu nhận biết**

- Mỗi hàng có thể bấm được, hoặc có khoảng đệm bên trong riêng.
- Giữa các hàng đã có đường kẻ.
- Thêm whitespace sẽ làm đường kẻ **đứt rời** và danh sách mất cảm giác liền mạch.

**Tự hỏi.** Nếu thêm khoảng trắng vào đây, đường phân cách có bị biến thành những đoạn kẻ rời rạc không?

**Ranh giới**

- `GAP-2`: hai nút bấm đứng cạnh nhau **không** phải danh sách; chúng là một nhóm hành động.
- `GAP-4`: nếu các hàng là những nhóm có cấu trúc riêng và **không** có đường phân cách, chúng không còn là
  liền mạch danh sách nữa.

**Không dùng `gap-0`.** Không có khoảng cách là **trạng thái vắng mặt** của khoảng cách giữa các phần tử, không phải một bậc mới trong
thang. Mã `GAP-0` là mã tình huống, không phải tên class CSS.

**Tình huống nghiệp vụ hay gặp.** Trình đơn cài đặt · lịch sử thanh toán · bảng xếp hạng · lệnh trình đơn ·
notification luồng tin có đường phân cách · danh sách điều hướng trên thiết bị di động · bảng số liệu dạng hàng.

---

## `GAP-1` — hai dòng vẫn là một danh tính

**Tình huống.** Dòng dưới chỉ **bổ nghĩa hoặc nhận diện** cho dòng trên. Đọc riêng dòng dưới thì nó
không còn là một đối tượng độc lập.

**Dấu hiệu nhận biết**

- Hai dòng cùng trả lời **một** câu hỏi: "đây là ai?", "bao nhiêu?", "giá thế nào?".
- Vế sau mất đi thì vế trước vẫn đúng, chỉ kém rõ.
- Không có vế nào là một hành động.

**Tự hỏi.** Nếu đọc riêng vế dưới, nó có còn là một đối tượng độc lập không? Nếu không — `GAP-1`.

**Ranh giới**

- `GAP-2`: `GAP-1` là **một vế bổ nghĩa một vế**; `GAP-2` là **nhiều vế cùng tạo một khối**. Tên và
  tên người dùng là `GAP-1`; Lưu và Xem trước là `GAP-2`.
- `GAP-3`: nhãn đứng trên ô nhập liệu là `GAP-3` chứ không phải `GAP-1`, vì nhãn **sở hữu** một khối
  có tương tác, không phải chú thích một giá trị.

**Tình huống nghiệp vụ hay gặp.** Tên + tên người dùng · ảnh đại diện phương án dự phòng + tên · số liệu + đơn vị · giá +
chu kỳ thanh toán · tiêu đề + phụ đề ngắn · hạng + nhãn hạng · ngày + múi giờ · tên tệp + loại tệp.

---

## `GAP-2` — nhiều thành phần tạo một khối gọn

**Tình huống.** Các phần tử cùng tạo thành **một** thao tác, một tài liệu, một câu, hoặc một chuỗi có
thứ tự. Tách một cái ra là khối đó vỡ.

**Dấu hiệu nhận biết**

- Chúng chia nhau một ranh giới, một trạng thái hoặc một hành động.
- Chúng được đọc thành một cụm, không phải hai việc.
- Trục ngang hay dọc **không** phải tiêu chí.

**Tự hỏi.** Nếu tách các thành phần khỏi shared ranh giới/trạng thái, thao tác hoặc tài liệu có bị vỡ không?

**Ranh giới**

- `GAP-1`: xem trên.
- `GAP-3`: nếu **một** thành phần gọi tên hoặc quản lý các thành phần còn lại thì đó là `GAP-3`.
  Nhóm nút Lưu/Xem trước là `GAP-2`; chữ "Hành động" đứng trên nhóm nút đó là `GAP-3`.

**Tình huống nghiệp vụ hay gặp.** Lưu/Xem trước · Trước/Sau · biểu tượng + nhãn trong một nút · ô nhập liệu +
nút hành động đi kèm · cụm bộ lọc gọn · tác giả + nội dung của một đánh giá · cụm chữ giá · dòng thời
gian có thứ tự · hành động cụm xếp dọc khi thu hẹp.

---

## `GAP-3` — một phần sở hữu phần kế tiếp

**Tình huống.** Phần đầu **gọi tên, điều khiển hoặc giải thích** phần sau. Quan hệ là **sở hữu**,
không phải ngang hàng.

**Dấu hiệu nhận biết**

- Phần đầu ngắn, phần sau là nội dung thật.
- Bỏ phần đầu đi thì phần sau vẫn hoạt động, chỉ mất tên.
- Bỏ phần sau đi thì phần đầu trở nên vô nghĩa.

**Tự hỏi.** Phần đầu có đang đặt tên, điều khiển hoặc giải thích phần sau không?

**Ranh giới**

- `GAP-2`: `GAP-2` chia nhau một ranh giới; `GAP-3` có một bên **chi phối** bên kia.
- `GAP-4`: nếu **cả hai** bên đều đã là nhóm có cấu trúc riêng thì không còn quan hệ sở hữu — đó
  là `GAP-4`.

**Tình huống nghiệp vụ hay gặp.** Nhãn + ô nhập liệu · tiêu đề + thẻ · thanh công cụ + vùng kết quả · các thẻ thẻ tab +
nội dung thẻ tab · thẻ + chú thích · câu hỏi + vùng trả lời · ô tìm kiếm + dòng tóm tắt kết quả · hộp kiểm
điều khoản + nút gửi.

---

## `GAP-4` — hai phía đều đã là một nhóm

**Tình huống.** Mỗi bên **đã có khoảng cách bên trong của riêng nó**. Hai bên ngang hàng, không bên
nào sở hữu bên nào.

**Dấu hiệu nhận biết**

- Mỗi bên tự gọi tên được như một nhóm hoàn chỉnh.
- Bên trong mỗi bên đã dùng `GAP-1`, `GAP-2` hoặc `GAP-3`.
- Hai bên chưa lớn đến mức thành hai phần nội dung của trang.

**Tự hỏi.** Cả hai phía có thể tự được gọi tên như một nhóm hoàn chỉnh không?

**Ranh giới**

- `GAP-3`: xem trên.
- `GAP-6`: nếu mỗi bên có tiêu đề riêng, mục đích riêng và trạng thái tải riêng thì đã lên `GAP-6`.

**Tình huống nghiệp vụ hay gặp.** Cụm hồ sơ + cụm tiến độ · trường nhập liệu + trường nhập liệu · tóm tắt thanh toán + điều
khoản · cụm tiêu đề + cụm nội dung · địa chỉ + phương thức thanh toán · biểu đồ + cụm chú giải · câu
hỏi + cụm lựa chọn · tóm tắt khoá học + cụm ghi danh.

---

## `GAP-6` — hai phần nội dung lớn của cùng một trang

**Tình huống.** Mỗi phần có tiêu đề, nội dung và mục đích riêng, nhưng vẫn cùng thuộc một trang và
chảy trong cùng một mạch nội dung.

**Dấu hiệu nhận biết**

- Mỗi phần có thể tự đứng thành một phần nội dung độc lập.
- Mỗi phần có trạng thái tải riêng, có thể rỗng riêng.
- Chúng vẫn cuộn cùng nhau trong một luồng, chưa phải hai vùng bố cục.

**Tự hỏi.** Nếu tách một phần ra, nó có thể tự đứng thành một phần nội dung độc lập không?

**Ranh giới**

- `GAP-4`: xem trên.
- `GAP-8`: nếu hai bên tự quyết chiều rộng và cách xếp đặt của mình khi màn hình đổi kích thước,
  chúng là vùng bố cục — `GAP-8`.

**Ví dụ không được chấp nhận.** Phần nội dung chỉ có một tiêu đề và một con số **không** đủ để minh hoạ
`GAP-6`: nó chưa chứng minh được mình tự đứng độc lập. Mỗi phần nội dung trong ví dụ phải có nội dung thật
tương ứng với mục đích của nó.

**Tình huống nghiệp vụ hay gặp.** Tổng quan + hoạt động gần đây · nội dung khoá học + đánh giá học
viên · hồ sơ + cài đặt bảo mật · milestone + phản hồi · phân tích + giao dịch · brief dự án + sản
phẩm bàn giao.

---

## `GAP-8` — hai vùng bố cục

**Tình huống.** Hai bên điều khiển **cách cả vùng trang được tổ chức**. Mỗi bên tự sở hữu hình học
của mình: chiều rộng, vị trí, hành vi khi màn hình đổi kích thước.

**Dấu hiệu nhận biết**

- Một bên có thể được ghim, cuộn độc lập, hoặc biến mất trên thiết bị di động.
- Chiều rộng của mỗi bên là một quyết định bố cục, không phải hệ quả của nội dung.

**Tự hỏi.** Hai phía có điều khiển cách cả vùng trang được tổ chức không?

**Ranh giới**

- `GAP-6`: xem trên. Kích thước của thành phần **không** biến nó thành bố cục vùng — một thẻ to
  vẫn chỉ là thẻ.

**Tình huống nghiệp vụ hay gặp.** Thanh bộ lọc + kết quả · điều hướng + nội dung · vùng vẽ + bảng kiểm tra ·
hộp thư + khung hội thoại · catalog + khung giỏ hàng · cây tệp + trình soạn thảo.

---

## Luật

1. Chỉ xét các con **trực tiếp** của cùng một phần tử cha.
2. Phần tử cha sở hữu `gap`; phần tử con **không** dùng `margin` để đẩy phần tử cùng cấp.
3. Một phần tử cha chỉ diễn đạt **một** quan hệ. Quan hệ khác nhau phải tạo phần tử cha lồng nhau.
4. Đổi hàng thành cột, đổi khung nhìn hoặc đổi trạng thái tải **không** tự làm đổi bậc.
5. Đường phân cách và khoảng cách không diễn đạt cùng một ranh giới hai lần.
6. Nếu còn hai bậc liền kề cùng hợp lý, mặc định chọn **bậc nhỏ hơn**; chỉ hỏi khi yêu cầu bắt buộc
   quan hệ lớn hơn.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Tính đồng nhất trạng thái.** Khung chờ và nội dung thật dùng chung một mã. Đổi khoảng cách khi đang tải là nói dối
  về quan hệ.
- **Chronology.** Mốc thời gian cạnh sự kiện là `GAP-2` **chỉ khi** hai thứ tạo thành một tài liệu có thứ
  tự. Mốc thời gian chỉ để ghi ngày cho một khối riêng thì không thuộc tài liệu đó.
- **Phần tử cha phẳng trộn nhiều quan hệ.** Phải tách phân cấp **trước**, rồi mới chọn. Một vùng chứa
  chứa cả danh tính, cả số liệu đo, cả tiêu đề phần nội dung thì không có đáp án đúng nào, và lấy trung bình là
  cách chọn ra đáp án sai.
- **Hai bậc liền kề cùng khớp.** Chọn bậc nhỏ hơn. Chỉ hỏi **một** câu phân định khi bên yêu cầu nói
  rõ họ cần quan hệ lớn hơn.
- **Đã có đường phân cách.** Danh sách có đường kẻ và hàng tự thêm khoảng đệm là `GAP-0`, kể cả khi các hàng đọc như ngang hàng.
- **Thiết kế đáp ứng.** Chỉ đổi bậc khi phần tử cha hoặc vai trò bố cục **thật sự** thay đổi, không phải khi
  màn hình hẹp đi.
