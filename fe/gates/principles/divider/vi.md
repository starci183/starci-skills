---
id: fe-principles-divider-vi
title: vi.md
slug: /gates/principles/divider/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống DIVIDER-N, nhận diện bằng nghiệp vụ và bằng quyền sở hữu đường kẻ, không bằng mắt.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `divider`

# Đường phân cách

Đường phân cách là ranh giới được **vẽ thành đường kẻ**. Khoảng trống là **cùng ranh giới đó** được vẽ bằng
sự vắng mặt. Hai cách vẽ, một sự thật — và một sự thật thì chỉ nói **một lần**.

Vì vậy đừng bao giờ hỏi "chỗ này có cần một đường kẻ cho rõ không". Hãy nhìn vào cái khoảng cách giữa các phần tử và hỏi:

> Ranh giới này đã được nói bằng khoảng trống chưa?

Nếu rồi — không kẻ. Nếu hai bên buộc phải **dính sát nhau** (vì mật độ, vì phải căn thẳng hàng, vì
chúng nằm trên một mặt liền), thì khoảng trống đã bị tiêu hết, và lúc đó đường kẻ là thứ **duy nhất**
còn lại để nói ranh giới. Đó là lúc kẻ.

Và mỗi đường kẻ có **đúng một chủ sở hữu**: cái tập sở hữu các đường giữa các thành viên của nó, cái
dải sở hữu cạnh nơi nó kết thúc, còn khoảng cách giữa các phần tử giữa hai vùng thì được khai báo **một lần, bởi vế đứng
sau**. Hai phần tử cạnh nhau mà mỗi bên tự vẽ cạnh của mình thì ra **hai** đường và **không ai** chịu
trách nhiệm.

**Đây là luật bắt buộc.** Mọi chỗ tiếp giáp hiển thị ra đều rơi vào đúng một mã dưới đây, kể cả — và
nhất là — những chỗ không kẻ gì cả. Không có kích thước nào nhỏ đến mức được miễn: hai thẻ cách nhau
bằng khoảng trống là `DIVIDER-0`, đúng cùng một lý do mà danh sách cài đặt là `DIVIDER-1`. Câu "có
mỗi cái gạch mảnh thôi mà" là chỗ luật này bị bỏ qua nhiều nhất, vì thêm một ranh giới thừa thì không
tốn gì và không ai thấy — cho tới khi một trang có mười một cái.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `DIVIDER-0` | Khoảng trống đã nói ranh giới; hai bên **không** dính nhau | *không khai báo đường phân cách* |
| `DIVIDER-1` | Một tập các thành viên **cùng loại**, cần đường kẻ lặp lại giữa chúng | `divide-y divide-border` (`divide-x divide-border` khi tập chạy ngang) |
| `DIVIDER-2` | Một **dải** gọi tên hoặc điều khiển phần phía sau, tự đóng cạnh của mình | `border-b border-border` (`border-t border-border` khi dải nằm phía sau) |
| `DIVIDER-3` | Hai **vùng ngang hàng** dính nhau, chung một khoảng cách giữa các phần tử | `border-l border-border` trên vế sau (`border-t border-border` khi xếp chồng) |
| `DIVIDER-4` | Đường kẻ **bao quanh** một đối tượng chứ không ngăn cách phần tử cùng cấp | *mô-đun này không phát class CSS* |
| `DIVIDER-5` | Một **ma trận ô** so sánh được trên hai trục | `divide-y divide-border` cho ma trận + `divide-x divide-border` cho từng hàng |
| `DIVIDER-6` | Đường kẻ **tự nó là một phần tử** trong dòng chảy, không phải cạnh của ai | `border-t border-border` trên một phần tử ngắt độc lập |

---

## `DIVIDER-0` — khoảng trống đã nói rồi

**Tình huống.** Hai thứ đứng cạnh nhau và giữa chúng đã có khoảng trống do phần tử cha đặt. Ranh giới đã
được phát biểu. Thêm một đường kẻ là nói lại lần thứ hai cùng một câu.

**Dấu hiệu nhận biết**

- Phần tử cha đang giữ một `gap` chạy ngang qua đúng cái khoảng cách giữa các phần tử này.
- Hai bên đã tự có mặt nền, có bóng, hoặc có viền bao riêng — chúng đã tách nhau rồi.
- Nếu bỏ đường kẻ đi, không ai đọc nhầm hai bên thành một khối.
- Lý do duy nhất còn lại để giữ đường kẻ là "trông cho rõ ràng hơn".

**Tự hỏi.** Bỏ đường kẻ này đi thì có ai đọc nhầm hai bên thành một thứ không? Nếu không — `DIVIDER-0`.

**Ranh giới**

- `DIVIDER-1`: `DIVIDER-1` chỉ đúng khi các thành viên **dính sát nhau** trên một mặt liền. Ba thẻ
  rời nhau, mỗi thẻ có nền riêng, **không** phải một liền mạch danh sách.
- `DIVIDER-2`: nếu tiêu đề đứng cách nội dung một khoảng thì tiêu đề không cần cạnh dưới. Dải chỉ
  đóng cạnh khi nội dung **chạy sát** vào nó.
- `DIVIDER-3`: hai vùng có khoảng cách ở giữa thì không có khoảng cách giữa các phần tử để mà kẻ. Đường kẻ không bắc qua khoảng
  trống được.

**Không có class CSS nào cho tình huống này.** Đừng vẽ một viền trong suốt, đừng đặt `border-0` để "ghi
lại là đã cân nhắc". Vắng mặt là câu trả lời, và nó là câu trả lời của **đa số** các bố cục kết hợp.

**Tình huống nghiệp vụ hay gặp.** Lưới thẻ khoá học · hai phần nội dung của một trang có `gap` · biểu mẫu có
các trường nhập liệu cách nhau · nhóm nút · bảng điều khiển nhiều ô số liệu · danh sách bài viết dạng thẻ · hai vùng
bố cục đã cách nhau bằng khoảng trống · nội dung hộp thoại cách phần cuối một khoảng.

---

## `DIVIDER-1` — một tập thành viên cùng loại, kẻ lặp lại

**Tình huống.** Nhiều mục **cùng loại** nằm liền nhau trên một mặt duy nhất: mỗi mục có khoảng đệm bên trong riêng,
không có khoảng trống giữa chúng. Ranh giới giữa mục này và mục kế chỉ còn đường kẻ để nói.

**Dấu hiệu nhận biết**

- Các mục là **những phiên bản của cùng một thứ** — cùng vai trò, cùng cách đọc, cùng loại hành động.
- Chúng dính sát nhau; toàn bộ khoảng đệm nằm **bên trong** mỗi mục.
- Số lượng mục là dữ liệu, không phải một quyết định thiết kế.
- Chèn khoảng trống vào sẽ làm chúng đọc thành nhiều khối rời thay vì một danh sách.

**Tự hỏi.** Các mục này có phải là những phiên bản của **cùng một loại**, đang nằm sát nhau trên một
mặt liền không?

**Ranh giới**

- `DIVIDER-0`: nếu các mục cách nhau bằng khoảng trống thì tập không có khoảng cách giữa các phần tử. Đây là chỗ hay sai
  nhất — vừa `gap` vừa `divide-y`.
- `DIVIDER-2`: một phần đầu của danh sách **không** phải một thành viên của danh sách. Cạnh dưới của
  nó là `DIVIDER-2`, các đường bên dưới nó là `DIVIDER-1`. Hai mã, hai chủ sở hữu, một cây.
- `DIVIDER-3`: `DIVIDER-3` là **hai** vùng **khác loại**; `DIVIDER-1` là **N** thành viên **cùng
  loại**.
- `DIVIDER-5`: nếu các ô so sánh được cả theo hàng **và** theo cột thì đó là ma trận.

**Chủ sở hữu là phần tử cha.** Không bao giờ đặt `border-b` lên từng mục: mục cuối sẽ mọc thêm một đường
kẻ dưới đáy, và đường đó là một ranh giới **ngoài** mà không ai yêu cầu.

**Tình huống nghiệp vụ hay gặp.** Danh sách cài đặt · lịch sử giao dịch · thông báo · kết quả tìm
kiếm · danh sách thành viên · bảng xếp hạng · lệnh trình đơn · các mục chương trong một khoá học ·
dòng thời gian hoạt động · danh sách tệp đính kèm · các dòng trong tóm tắt đơn hàng.

---

## `DIVIDER-2` — một dải tự đóng cạnh của nó

**Tình huống.** Một dải **gọi tên hoặc điều khiển** phần phía sau nó — phần đầu, thanh công cụ, thanh thẻ tab,
phần cuối hành động — và nội dung chạy **sát** vào dải đó. Đường kẻ nói: dải này ở **trên** nội dung,
không nằm **trong** nội dung.

**Dấu hiệu nhận biết**

- Dải ngắn, phần sau là nội dung thật.
- Nội dung có thể trượt, đổi, rỗng hoặc dài vô hạn, còn dải thì đứng yên.
- Nếu bỏ đường kẻ, dải bị đọc như dòng đầu tiên của nội dung.
- Cạnh này thuộc về **dải**, không thuộc về nội dung: nội dung không biết mình đứng sau ai.

**Tự hỏi.** Dải này có đang điều khiển hoặc gọi tên phần đứng sau nó, và phần đó có chạy sát vào nó
không?

**Ranh giới**

- `DIVIDER-0`: nếu giữa dải và nội dung có một khoảng trống thật thì quyền sở hữu đã được nói bằng
  khoảng trống rồi. Đừng nói thêm lần nữa.
- `DIVIDER-1`: dải **không** phải một thành viên của tập. Đây là lý do một danh sách có phần đầu lại
  mang **hai** mã, chứ không phải một `divide-y` phủ hết.
- `DIVIDER-3`: `DIVIDER-2` là quan hệ **sở hữu** (dải chi phối nội dung); `DIVIDER-3` là quan hệ
  **ngang hàng**.
- `DIVIDER-6`: `DIVIDER-2` là **cạnh của một phần tử có nội dung**; `DIVIDER-6` là một phần tử chỉ
  có mỗi đường kẻ.

**Trạng thái bám dính.** Dải ghim giữ nguyên `DIVIDER-2` ở **mọi** trạng thái, kể cả khi chưa cuộn.
Cho đường kẻ hiện ra lúc cuộn là biến ranh giới thành hệ quả của vị trí cuộn.

**Tình huống nghiệp vụ hay gặp.** Phần đầu của hộp thoại · thanh công cụ phía trên bảng dữ liệu · thanh thẻ tab ·
phần cuối chứa nút của một biểu mẫu dài · phần đầu cột của một danh sách · thanh đường dẫn phân cấp sát nội dung ·
thanh bộ lọc ghim trên vùng kết quả · thanh tiêu đề của khung bên.

---

## `DIVIDER-3` — hai vùng ngang hàng chung một khoảng cách giữa các phần tử

**Tình huống.** Hai vùng **khác loại**, không bên nào sở hữu bên kia, nằm dính nhau vì chúng chia
nhau một mặt liền hoặc vì bố cục không cho phép khoảng trống. Chỉ có **một** khoảng cách giữa các phần tử, và nó được khai
báo **một lần**.

**Dấu hiệu nhận biết**

- Mỗi bên tự gọi tên được, mỗi bên có nội dung riêng.
- Không bên nào là "phiên bản" của bên kia — chúng không cùng một loại.
- Hai bên chạm nhau; không có khoảng cách nào giữa chúng.
- Đúng **một** ranh giới, không lặp lại.

**Tự hỏi.** Hai bên có ngang hàng nhau và có thật sự **chạm nhau** không, hay giữa chúng đã có
khoảng trống?

**Ranh giới**

- `DIVIDER-0`: đây là ranh giới quan trọng nhất của mã này. Hai vùng cách nhau bằng `gap` thì
  **không** kẻ. Đường kẻ không bắc qua khoảng trống được.
- `DIVIDER-1`: hai vùng khác loại là `DIVIDER-3`; N mục cùng loại là `DIVIDER-1`. Dùng `divide-x`
  cho hai vùng khác loại là mượn cơ chế của một tập để nói một chuyện không phải tập.
- `DIVIDER-2`: bên nào **chi phối** bên nào thì lên `DIVIDER-2`.

**Khai báo một lần, bởi vế sau.** Vế trước không mọc `border-r`, vế sau mang `border-l`. Cả hai cùng
khai thì ra hai đường sát nhau, và trên màn hình mật độ cao chúng dày gấp đôi các đường còn lại.

**Tình huống nghiệp vụ hay gặp.** Cây thư mục cạnh vùng soạn thảo · danh sách hội thoại cạnh khung
trò chuyện · nội dung bài học cạnh khung ghi chú · vùng chính cạnh thanh bên ghim · vùng nhập cạnh vùng xem
trước · khung bộ lọc dính vào vùng kết quả · cụm số liệu tổng cạnh cụm số liệu chi tiết trong cùng
một thẻ.

---

## `DIVIDER-4` — đường kẻ bao quanh chứ không ngăn cách

**Tình huống.** Đường kẻ chạy **hết một vòng** quanh một đối tượng. Nó không nói "bên này khác bên kia";
nó nói "những thứ bên trong tôi là **một nhóm gọi được tên**, và nhóm đó khác với nhóm bao quanh".

**Dấu hiệu nhận biết**

- Đường kẻ khép kín, thường kèm bo góc.
- Bỏ nó đi thì không có khoảng cách giữa các phần tử nào bị mất — chỉ có một nhóm bị mất tên.
- Nó không nằm **giữa** hai thứ nào cả.

**Tự hỏi.** Đường này đang **ngăn cách** hai thứ, hay đang **gom** một nhóm lại?

**Ranh giới**

- `DIVIDER-1`, `DIVIDER-2`, `DIVIDER-3`: cả ba mã kia đều là **một cạnh nằm giữa hai bên**. Mã này
  là **bốn cạnh nằm quanh một bên**.
- `DIVIDER-5`: khung ngoài của một ma trận là `DIVIDER-4`; các đường **bên trong** ma trận là
  `DIVIDER-5`. Một ma trận thường mang cả hai, và chúng có hai chủ sở hữu khác nhau.

**Mô-đun này không trả lời.** Câu hỏi "nhóm này có đáng được gọi tên bằng một đường bao không" là câu
hỏi về **tư cách thành viên**, và nó phải được cân với hai lựa chọn khác mà mô-đun này không nhìn
thấy: nâng lên thành một mặt riêng, hoặc để phẳng hoàn toàn. Trả lời ở đây là chính bộ quy tắc nói một
ranh giới hai lần — đúng cái lỗi mà mô-đun này tồn tại để chặn. Mã này có mặt để đường bao được
**phân loại và chuyển đi**, chứ không phải để nó bị lẳng lặng xử lý như một đường phân cách.

**Tình huống nghiệp vụ hay gặp.** Thẻ khoá học · hộp cảnh báo · ô nhập liệu · một mặt phẳng chứa
danh sách · khung ảnh · thẻ tóm tắt thanh toán · khung mã nguồn · viền của một nút phụ.

---

## `DIVIDER-5` — ma trận ô, so sánh trên hai trục

**Tình huống.** Các ô so sánh được **theo hàng** và cũng so sánh được **theo cột**. Một ô có nghĩa
nhờ vị trí của nó trên cả hai trục, nên cả hai trục đều cần được nói.

**Dấu hiệu nhận biết**

- Đọc dọc một cột là so sánh được; đọc ngang một hàng cũng so sánh được.
- Các ô dính nhau, khoảng đệm nằm bên trong ô.
- Cột có tiêu đề riêng, hoặc mỗi cột là một đối tượng đem ra so sánh.

**Tự hỏi.** Một ô ở đây có nghĩa nhờ **cả hàng lẫn cột** của nó, hay chỉ nhờ thứ tự trong một danh
sách?

**Ranh giới**

- `DIVIDER-1`: danh sách chỉ có **một** trục. Một hàng nhiều cột nhưng các cột không so sánh được
  với nhau thì vẫn là `DIVIDER-1` — cột lúc đó chỉ là bố cục bên trong hàng.
- `DIVIDER-4`: khung ngoài không thuộc mã này.
- `DIVIDER-0`: một lưới thẻ có `gap` **không** phải ma trận theo nghĩa này. Nó đã nói ranh giới
  bằng khoảng trống.

**Chỉ kẻ bên trong.** Ô đầu và ô cuối không mọc thêm cạnh ngoài. Nếu khung ngoài là cần thiết, nó
thuộc về mặt chứa ma trận, không thuộc về các ô.

**Tình huống nghiệp vụ hay gặp.** Bảng so sánh gói dịch vụ · bảng điểm theo tuần · lịch dạng lưới ·
ma trận quyền theo vai trò · bảng đối chiếu tính năng · bảng tồn kho theo kho và theo mặt hàng ·
bảng giờ học theo ngày.

---

## `DIVIDER-6` — đường kẻ tự nó là một phần tử

**Tình huống.** Đường kẻ **không phải cạnh của ai cả**. Nó tự đứng trong dòng chảy như một phần tử,
vì hai bên nó là những khối tuỳ ý mà không bên nào có tư cách sở hữu cái khoảng cách giữa các phần tử — hoặc vì đường kẻ còn
phải **mang một nhãn**.

**Dấu hiệu nhận biết**

- Hai bên là nội dung dạng dòng chảy tự do: đoạn văn, khối nội dung sinh ra từ dữ liệu, các phần
  không đoán trước được.
- Không có vùng chứa nào ôm riêng từng bên để mà gắn cạnh vào.
- Hoặc: giữa đường kẻ có chữ — "hoặc", "hôm nay", "tin chưa đọc".

**Tự hỏi.** Có phần tử nào ở đây sở hữu được cái cạnh này không? Nếu không có ai — `DIVIDER-6`.

**Ranh giới**

- `DIVIDER-2`: `DIVIDER-2` là cạnh của một dải **có nội dung**. `DIVIDER-6` là một phần tử **chỉ**
  có đường kẻ.
- `DIVIDER-3`: nếu hai bên là hai vùng có vùng chứa riêng thì khoảng cách giữa các phần tử có chủ, và chủ là vế sau.
- `DIVIDER-1`: một mốc chia trong danh sách ("Hôm nay") **không** phải một thành viên của danh
  sách; nó là `DIVIDER-6` nằm giữa các thành viên.

**Ngữ nghĩa là một phần của mã.** Một ngắt chủ đề trong văn bản dài là một sự kiện có nghĩa, không
phải một cái gạch trang trí; nó phải được viết bằng phần tử mang đúng nghĩa đó.

**Tình huống nghiệp vụ hay gặp.** Ngắt chủ đề trong bài viết dài · "hoặc" giữa đăng nhập bằng mật
khẩu và đăng nhập bằng nhà cung cấp · mốc ngày trong luồng tin nhắn · vạch "tin chưa đọc" · ngắt giữa
hai phần của một trang điều khoản · vạch chia trong một trình đơn thả xuống giữa nhóm hành động thường và
hành động phá huỷ.

---

## Luật

1. Một ranh giới **chỉ được nói một lần**: hoặc bằng khoảng trống, hoặc bằng đường kẻ, không bao giờ
   bằng cả hai.
2. Mỗi đường kẻ có **một** chủ sở hữu. Hai phần tử cạnh nhau không cùng vẽ cạnh đối diện của nhau.
3. Tập dùng `divide-*` trên phần tử cha, **không** dùng `border-b` trên từng thành viên.
4. Đường kẻ cần một **cạnh có thật** để chạy dọc theo. Không có đường kẻ nào bắc qua khoảng trống.
5. Trục là **hệ quả** của trục cái tập, không phải tiêu chí chọn mã.
6. Đường kẻ dừng ở chỗ bề mặt chứa dừng: bề mặt chứa bo góc thì phải cắt nội dung, nếu không đường kẻ chạy quá góc.
7. Mô-đun này không chọn biến thiết kế màu, không chọn khoảng đệm bên trong, không chọn bo góc, không chọn khoảng cách.
8. Nếu còn hai mã cùng hợp lý, mặc định chọn `DIVIDER-0`.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Dải ghim.** `DIVIDER-2` giữ nguyên ở mọi trạng thái cuộn. Đường kẻ xuất hiện khi cuộn là biến
  ranh giới thành hệ quả của vị trí.
- **Điểm ngắt đổi chủ sở hữu.** Khoảng cách giữa các phần tử của `DIVIDER-3` khi xếp chồng thì chuyển từ cạnh dọc sang cạnh
  ngang và **giữ nguyên mã**. Nó chỉ được rơi về `DIVIDER-0` khi chính điểm ngắt đó đưa khoảng trống
  vào thay thế — ranh giới vẫn được nói đúng một lần ở cả hai phía điểm ngắt.
- **Tính đồng nhất trạng thái.** Khung chờ mang đúng những đường kẻ mà nội dung thật sẽ mang. Danh sách chỉ
  mọc đường kẻ khi có dữ liệu là danh sách sẽ nhảy bố cục khi dữ liệu về.
- **Tập rỗng hoặc chỉ có một thành viên.** Giữ nguyên `divide-*`. Class CSS nói về **quan hệ giữa các
  thành viên**, không nói về số lượng; một thành viên thì không có khoảng cách giữa các phần tử nào để vẽ, và đó là hành vi
  đúng chứ không phải may mắn.
- **Cạnh ngoài của ma trận.** `DIVIDER-5` chỉ kẻ **bên trong**. Khung ngoài là ranh giới của mặt
  chứa, thuộc về luật quan hệ nhóm.
- **Đường kẻ mang nghĩa khác** — thanh tiến độ, gạch chân đánh dấu thẻ tab đang chọn, gạch ngang giá cũ,
  trục biểu đồ — **không** phải đường phân cách và không thuộc mô-đun này. Chúng được đặt tên bởi thứ mang
  cái nghĩa đó.
- **Hai mã cùng khớp.** Chọn `DIVIDER-0`. Chỉ thêm đường kẻ khi bên yêu cầu nêu rõ tình trạng dính
  sát khiến khoảng trống không còn dùng được; "nhìn hơi trống" không phải một dữ kiện.
